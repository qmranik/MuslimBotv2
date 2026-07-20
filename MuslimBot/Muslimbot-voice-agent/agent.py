"""
Muslimbot LiveKit voice worker — LiveKit Agents 1.x + Gemini Live.

This package is LiveKit-only. Knowledge ingestion, chat, voice-session minting,
and voice briefs are owned by the Go orchestrator. All ERP/KB tool calls go
through /v1/agent/* using a session-bound workload JWT from dispatch metadata.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from typing import Any, Optional

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    ConversationItemAddedEvent,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import google

from services.config import (
    AGENT_TIMEZONE,
    GEMINI_VOICE_MODEL,
    GO_ORCHESTRATOR_URL,
    LIVEKIT_AGENT_NAME,
    TENANT_ID,
)
from services.kb_update_service import KBUpdateWatcher, compose_instructions
from services.memory import append_conversation_memory, get_conversation_memory
from services.orchestrator_client import OrchestratorClient
from services.tool_service import (
    confirm_write_tool,
    prepare_write_tool,
    run_read_tool,
    search_knowledge,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("muslimbot")

REQUIRED_ENVS = [
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "GOOGLE_API_KEY",
]
missing_envs = [env for env in REQUIRED_ENVS if not os.getenv(env)]
if missing_envs:
    logger.critical("FATAL: Missing required environment variables: %s", ", ".join(missing_envs))
    sys.exit(1)


SYSTEM_INSTRUCTIONS = f"""You are Muslimbot, a highly efficient enterprise voice assistant for Small ERP.
You help users manage their business through natural conversation.

READ operations (instant):
- Search products/items and check stock
- Search the knowledge base for policies and FAQs (search_knowledge_base)
- Look up customers, orders, receivables, and sales summaries
- Check system status

WRITE operations (ALWAYS prepare first, then ask for confirmation):
- Create orders, customers, items, stock entries, payments
- Trigger workflows / notifications
When a write tool returns an Action ID, read the summary aloud and ask the user to say yes or no.
Only call confirm_pending_action after an explicit yes/no. Never invent Action IDs.

Communication style:
- Be concise and professional. Speak naturally.
- Never output raw JSON or markdown.
- Use the local currency symbol (₹) for amounts.
- Current timezone: {AGENT_TIMEZONE}
"""


def _parse_dispatch_context(ctx: JobContext) -> dict[str, Any]:
    """Extract trusted tenant/session/workload token from LiveKit job/room metadata."""
    raw_candidates: list[str] = []
    job = getattr(ctx, "job", None)
    if job is not None:
        meta = getattr(job, "metadata", None) or ""
        if meta:
            raw_candidates.append(meta)
    room_meta = getattr(ctx.room, "metadata", None) or ""
    if room_meta:
        raw_candidates.append(room_meta)

    for raw in raw_candidates:
        try:
            data = json.loads(raw)
            if isinstance(data, dict) and data.get("workload_token"):
                return data
        except json.JSONDecodeError:
            logger.warning("Ignoring non-JSON dispatch metadata")
    return {}


class MuslimbotAgent(Agent):
    """Voice agent whose tools call the Go orchestrator exclusively."""

    def __init__(
        self,
        *,
        tenant_id: str,
        session_id: str,
        instructions: str,
        client: OrchestratorClient,
    ) -> None:
        super().__init__(instructions=instructions)
        self.tenant_id = tenant_id
        self.session_id = session_id
        self.client = client
        self.participant_identity = "unknown"
        self._pending_action_id: Optional[str] = None

    @function_tool(description="Search inventory items by name or description.")
    async def search_items(self, query: str, limit: int = 5) -> str:
        return await run_read_tool(self.client, "search_items", query=query, limit=limit)

    @function_tool(description="Check stock levels for an item.")
    async def check_stock(self, item_name: str) -> str:
        return await run_read_tool(self.client, "check_stock", item_name=item_name)

    @function_tool(description="Get today's sales summary.")
    async def sales_summary(self) -> str:
        return await run_read_tool(self.client, "sales_summary")

    @function_tool(description="Get recent sales orders/invoices.")
    async def get_recent_orders(self, status: str = "", customer: str = "", limit: int = 5) -> str:
        return await run_read_tool(
            self.client, "get_recent_orders", status=status, customer=customer, limit=limit
        )

    @function_tool(description="Search customers by name or phone.")
    async def search_customer(self, query: str) -> str:
        return await run_read_tool(self.client, "search_customer", query=query)

    @function_tool(description="Get a customer's purchase history.")
    async def customer_history(self, customer_name: str) -> str:
        return await run_read_tool(self.client, "customer_history", customer_name=customer_name)

    @function_tool(description="Get outstanding receivables.")
    async def get_receivables(self) -> str:
        return await run_read_tool(self.client, "get_receivables")

    @function_tool(description="List low stock alerts.")
    async def low_stock_alerts(self, limit: int = 20) -> str:
        return await run_read_tool(self.client, "low_stock_alerts", limit=limit)

    @function_tool(description="Search the organization knowledge base for policies and FAQs.")
    async def search_knowledge_base(self, query: str) -> str:
        return await search_knowledge(self.client, query, session_id=self.session_id)

    @function_tool(description="Ask a complex business question via automation.")
    async def ask_business_ai(self, query: str) -> str:
        return await run_read_tool(self.client, "ask_business_ai", query=query)

    @function_tool(description="Get current time and system status.")
    async def system_status(self) -> str:
        return await run_read_tool(self.client, "system_status")

    @function_tool(description="Prepare creating a sales order. Requires later confirmation.")
    async def create_order(self, customer: str, items: str, is_pos: bool = False) -> str:
        try:
            item_list = json.loads(items) if isinstance(items, str) else items
        except json.JSONDecodeError:
            return "Invalid items format. Provide a JSON array like [{'item_code':'ITM001','qty':2}]."
        result = await prepare_write_tool(
            self.client, "create_order", customer=customer, items=item_list, is_pos=is_pos
        )
        self._capture_pending(result)
        return result

    @function_tool(description="Prepare recording a payment. Requires later confirmation.")
    async def record_payment(
        self, invoice_name: str, amount: float, mode_of_payment: str = "Cash"
    ) -> str:
        result = await prepare_write_tool(
            self.client,
            "record_payment",
            invoice_name=invoice_name,
            amount=amount,
            mode_of_payment=mode_of_payment,
        )
        self._capture_pending(result)
        return result

    @function_tool(description="Prepare creating a customer. Requires later confirmation.")
    async def create_customer(
        self, customer_name: str, mobile_no: str = "", customer_group: str = "Individual"
    ) -> str:
        result = await prepare_write_tool(
            self.client,
            "create_customer",
            customer_name=customer_name,
            mobile_no=mobile_no,
            customer_group=customer_group,
        )
        self._capture_pending(result)
        return result

    @function_tool(description="Prepare creating an inventory item. Requires later confirmation.")
    async def create_item(self, item_name: str, rate: float, item_group: str = "Products") -> str:
        result = await prepare_write_tool(
            self.client, "create_item", item_name=item_name, rate=rate, item_group=item_group
        )
        self._capture_pending(result)
        return result

    @function_tool(description="Prepare adding stock. Requires later confirmation.")
    async def add_stock(self, item_code: str, qty: float, warehouse: str = "Stores - LDI") -> str:
        result = await prepare_write_tool(
            self.client, "add_stock", item_code=item_code, qty=qty, warehouse=warehouse
        )
        self._capture_pending(result)
        return result

    @function_tool(description="Approve or reject the pending write Action ID after user confirmation.")
    async def confirm_pending_action(
        self, approve: bool, action_id: str = "", transcript: str = ""
    ) -> str:
        target = (action_id or self._pending_action_id or "").strip()
        if not target:
            return "There is no pending write action to confirm."
        result = await confirm_write_tool(self.client, target, approve=approve, transcript=transcript)
        if approve:
            self._pending_action_id = None
        return result

    def _capture_pending(self, spoken: str) -> None:
        marker = "Action ID "
        if marker in spoken:
            self._pending_action_id = spoken.split(marker, 1)[1].split(".", 1)[0].strip()


async def entrypoint(ctx: JobContext) -> None:
    logger.info("Connecting to room %s", ctx.room.name)
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    dispatch = _parse_dispatch_context(ctx)
    tenant_id = str(dispatch.get("tenant_id") or TENANT_ID)
    session_id = str(dispatch.get("session_id") or ctx.room.name)
    workload_token = str(dispatch.get("workload_token") or "")
    if not workload_token:
        logger.error(
            "No workload_token in dispatch metadata; refusing session. "
            "Ensure Go /v1/kb/voice/session dispatched this room."
        )
        return

    client = OrchestratorClient(workload_token=workload_token, base_url=GO_ORCHESTRATOR_URL)
    watcher: Optional[KBUpdateWatcher] = None

    voice_context = ""
    initial_generation = 0
    try:
        brief = await client.voice_brief()
        voice_context = str(brief.get("context") or "")
        initial_generation = int(brief.get("kb_generation") or 0)
    except Exception as exc:
        logger.warning("Failed to load voice brief: %s", exc)

    participant_identity = (
        next(iter(ctx.room.remote_participants.values())).identity
        if ctx.room.remote_participants
        else "unknown"
    )
    memory_block = ""
    try:
        memory_turns = await get_conversation_memory(tenant_id, session_id)
        if memory_turns:
            memory_block = "\n\nRECENT CONVERSATION HISTORY:\n"
            for turn in memory_turns:
                memory_block += f"{turn['role'].upper()}: {turn['text']}\n"
    except Exception as exc:
        logger.warning("Failed to load conversation memory: %s", exc)

    instructions = compose_instructions(SYSTEM_INSTRUCTIONS, voice_context) + memory_block

    agent = MuslimbotAgent(
        tenant_id=tenant_id,
        session_id=session_id,
        instructions=instructions,
        client=client,
    )
    agent.participant_identity = participant_identity

    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model=GEMINI_VOICE_MODEL,
            voice="Puck",
            temperature=0.7,
        ),
    )

    async def _update_instructions(new_instructions: str) -> None:
        # LiveKit Agents API — update warm context without ending the call.
        if hasattr(agent, "update_instructions"):
            await agent.update_instructions(new_instructions + memory_block)
        else:
            agent.instructions = new_instructions + memory_block
            logger.warning("agent.update_instructions missing; set instructions attribute only")

    async def _notify_browser(payload: dict[str, Any]) -> None:
        try:
            data = json.dumps(payload).encode("utf-8")
            await ctx.room.local_participant.publish_data(
                data, reliable=True, topic="kb-context"
            )
        except Exception as exc:
            logger.debug("kb-context data packet failed: %s", exc)

    watcher = KBUpdateWatcher(
        tenant_id=tenant_id,
        session_id=session_id,
        client=client,
        update_instructions=_update_instructions,
        notify=_notify_browser,
    )
    watcher.base_instructions = SYSTEM_INSTRUCTIONS
    watcher.start(initial_generation=initial_generation)

    @session.on("conversation_item_added")
    def _on_item(ev: ConversationItemAddedEvent) -> None:
        item = getattr(ev, "item", None)
        if item is None:
            return
        role = getattr(item, "role", "")
        text = getattr(item, "text_content", None) or ""
        if role in ("user", "assistant") and text:
            mapped = "user" if role == "user" else "agent"
            asyncio.create_task(append_conversation_memory(tenant_id, session_id, mapped, text))

    @ctx.room.on("participant_disconnected")
    def _on_disconnect(participant) -> None:  # type: ignore[no-untyped-def]
        # Keep OrchestratorClient alive across participant disconnects; end on job exit.
        logger.info("Participant %s disconnected", participant.identity)

    try:
        await client.session_heartbeat()
        await session.start(agent=agent, room=ctx.room)
        await session.generate_reply(
            instructions=(
                "Greet the user briefly: say you are Muslimbot, their business assistant, "
                "and that you can help search products, check stock, review orders, look up "
                "customers, or answer knowledge-base questions. Then ask how you can help."
            )
        )
    finally:
        if watcher is not None:
            await watcher.stop()
        try:
            await client.session_end(reason="session_closed")
        except Exception as exc:
            logger.debug("session_end failed: %s", exc)
        await client.close()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=LIVEKIT_AGENT_NAME or "muslimbot",
        )
    )
