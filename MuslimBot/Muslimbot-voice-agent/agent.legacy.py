"""
Muslimbot Voice Agent — livekit-agents 1.x (AgentSession) + Gemini Live realtime.

Migrated from the deprecated 0.11.x `MultimodalAgent` API to the 1.x `AgentSession`
pipeline. Key properties of this build:

- **Gemini Live speech-to-speech** via `google.beta.realtime.RealtimeModel` — native
  server-side VAD / turn detection, so no separate Silero VAD is configured.
- **21 ERP tools** ported verbatim as direct `@function_tool` methods on an `Agent`
  subclass, reusing the unchanged `services/` layer (ERPNext + n8n).
- **Knowledge base = Vertex AI RAG** (`services.rag_vertex` → orchestrator
  `/v1/kb/retrieve`), exposed as the `search_knowledge_base` tool. We deliberately do
  NOT use a Postgres/Qdrant MCP for KB — the sovereign Vertex path already works.
- **MCP is opt-in**: set `N8N_MCP_URL` to attach an n8n (or any) MCP server via
  `mcp_servers=`. The direct tools above remain the reliable default either way.

API verified against livekit-agents 1.6.5 / livekit-plugins-google 1.x.
"""

import os
import sys
import json
import asyncio
import datetime
import logging
from typing import Optional

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
    mcp,
)
from livekit.plugins import google

from services.config import (
    AGENT_TIMEZONE,
    GOOGLE_CALENDAR_ENABLED,
    TENANT_ID,
    GEMINI_VOICE_MODEL,
)
from services.erp_client import (
    erp_call,
    erp_create_doc,
    erp_get_list,
    erp_submit_doc,
    n8n_webhook,
)
from services import rag_vertex, voice_brief
from services.memory import get_conversation_memory, append_conversation_memory

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("muslimbot")

REQUIRED_ENVS = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "GOOGLE_API_KEY"]
missing_envs = [env for env in REQUIRED_ENVS if not os.getenv(env)]
if missing_envs:
    logger.critical("FATAL: Missing required environment variables: %s", ", ".join(missing_envs))
    sys.exit(1)


class MuslimbotAgent(Agent):
    """Muslimbot enterprise voice agent — all tools are 1.x @function_tool methods."""

    def __init__(self, tenant_id: str, instructions: str) -> None:
        super().__init__(instructions=instructions)
        self.tenant_id = tenant_id or TENANT_ID
        self.participant_identity = "unknown"

    # ─── READ tools ──────────────────────────────────────────────────────
    @function_tool(description="Search for items/products in inventory by name, category, or description. Use for POS lookups, stock checks, or when the user asks about products.")
    async def search_items(self, query: str, limit: int = 5) -> str:
        try:
            result = await erp_call("small_erp.api.pos.search_pos_items", {"query": query, "limit": limit})
            if isinstance(result, dict) and "error" not in result:
                items = result.get("items", result) if isinstance(result, dict) else result
                if isinstance(items, list) and items:
                    lines = []
                    for item in items[:limit]:
                        name = item.get("item_name", item.get("name", "Unknown"))
                        rate = item.get("rate", item.get("standard_rate", "N/A"))
                        qty = item.get("actual_qty", item.get("available_qty", "N/A"))
                        lines.append(f"- {name}: price {rate}, stock {qty}")
                    return f"Found {len(items)} items:\n" + "\n".join(lines)

            items = await erp_get_list(
                "Item",
                filters={"item_name": ["like", f"%{query}%"]},
                fields=["name", "item_name", "standard_rate", "item_group"],
                limit=limit,
            )
            if items:
                lines = [
                    f"- {i.get('item_name', i['name'])} ({i.get('item_group', '')}): ₹{i.get('standard_rate', 'N/A')}"
                    for i in items
                ]
                return f"Found {len(items)} items:\n" + "\n".join(lines)
            return f"No items found matching '{query}'."
        except Exception as exc:
            return f"Error searching items: {exc}"

    @function_tool(description="Check stock level for a specific item. Returns available quantity across warehouses.")
    async def check_stock(self, item_name: str) -> str:
        try:
            result = await erp_call("small_erp.api.inventory.get_item_detail", {"item_code": item_name})
            if isinstance(result, dict) and "error" not in result:
                levels = result.get("levels", result)
                if isinstance(levels, list):
                    lines = [
                        f"- {l.get('warehouse', 'Default')}: {l.get('actual_qty', 0)} {l.get('stock_uom', 'units')}"
                        for l in levels
                    ]
                    return f"Stock for {item_name}:\n" + "\n".join(lines)
                return f"Stock info: {json.dumps(result)}"

            bins = await erp_get_list(
                "Bin",
                filters={"item_code": item_name},
                fields=["warehouse", "actual_qty", "stock_uom"],
            )
            if bins:
                lines = [f"- {b['warehouse']}: {b['actual_qty']} {b.get('stock_uom', '')}" for b in bins]
                return f"Stock for {item_name}:\n" + "\n".join(lines)
            return f"No stock data found for '{item_name}'."
        except Exception as exc:
            return f"Error checking stock: {exc}"

    @function_tool(description="Get recent sales invoices. Optionally filter by customer name or status (Paid, Unpaid, Overdue).")
    async def get_recent_orders(self, customer: Optional[str] = None, status: Optional[str] = None, limit: int = 5) -> str:
        filters = {}
        if customer:
            filters["customer_name"] = ["like", f"%{customer}%"]
        if status:
            filters["status"] = status

        invoices = await erp_get_list(
            "Sales Invoice",
            filters=filters or None,
            fields=["name", "customer_name", "grand_total", "status", "posting_date"],
            limit=limit,
        )
        if not invoices:
            return "No recent orders found."

        lines = [
            f"- {inv['name']}: {inv.get('customer_name', 'N/A')} — ₹{inv.get('grand_total', 0)} "
            f"({inv.get('status', 'Unknown')}) on {inv.get('posting_date', '')}"
            for inv in invoices
        ]
        return "Recent orders:\n" + "\n".join(lines)

    @function_tool(description="Get today's sales summary — total revenue, number of invoices, top items sold.")
    async def sales_summary(self) -> str:
        try:
            result = await erp_call("small_erp.api.dashboard.get_dashboard_kpis")
            if isinstance(result, dict) and "error" not in result:
                revenue = result.get("revenue_today", result.get("total_revenue", 0))
                orders = result.get("orders_today", result.get("total_orders", 0))
                return f"Today's summary: Revenue ₹{revenue}, Orders: {orders}"

            today = datetime.date.today().isoformat()
            invoices = await erp_get_list(
                "Sales Invoice",
                filters={"posting_date": today, "docstatus": 1},
                fields=["grand_total"],
            )
            total = sum(i.get("grand_total", 0) for i in invoices)
            return f"Today's summary: {len(invoices)} invoices totaling ₹{total:.2f}"
        except Exception as exc:
            return f"Error getting summary: {exc}"

    @function_tool(description="Search for a customer by name or phone number.")
    async def search_customer(self, query: str) -> str:
        customers = await erp_get_list(
            "Customer",
            filters={"customer_name": ["like", f"%{query}%"]},
            fields=["name", "customer_name", "mobile_no", "customer_group"],
            limit=5,
        )
        if not customers:
            return f"No customers found matching '{query}'."

        lines = [
            f"- {c.get('customer_name', c['name'])} (Group: {c.get('customer_group', 'N/A')}, Mobile: {c.get('mobile_no', 'N/A')})"
            for c in customers
        ]
        return "Customers found:\n" + "\n".join(lines)

    @function_tool(description="Get a customer's purchase history — recent invoices and total spending.")
    async def customer_history(self, customer_name: str, limit: int = 5) -> str:
        invoices = await erp_get_list(
            "Sales Invoice",
            filters={"customer_name": ["like", f"%{customer_name}%"], "docstatus": 1},
            fields=["name", "grand_total", "posting_date", "status"],
            limit=limit,
        )
        if not invoices:
            return f"No purchase history for '{customer_name}'."

        total = sum(i.get("grand_total", 0) for i in invoices)
        lines = [
            f"- {i['name']}: ₹{i['grand_total']} on {i['posting_date']} ({i['status']})"
            for i in invoices
        ]
        return f"Purchase history for {customer_name} (total: ₹{total:.2f}):\n" + "\n".join(lines)

    @function_tool(description="Get outstanding receivables — unpaid invoices that customers owe.")
    async def get_receivables(self, limit: int = 5) -> str:
        invoices = await erp_get_list(
            "Sales Invoice",
            filters={"status": ["in", ["Unpaid", "Overdue"]], "docstatus": 1},
            fields=["name", "customer_name", "outstanding_amount", "due_date"],
            limit=limit,
        )
        if not invoices:
            return "No outstanding receivables. All invoices are paid!"

        total = sum(i.get("outstanding_amount", 0) for i in invoices)
        lines = [
            f"- {i.get('customer_name', 'N/A')}: ₹{i['outstanding_amount']} (due {i.get('due_date', 'N/A')})"
            for i in invoices
        ]
        return f"Outstanding receivables (₹{total:.2f} total):\n" + "\n".join(lines)

    @function_tool(description="Search the organization knowledge base for policies, FAQs, delivery info, and product descriptions. Uses Vertex AI RAG.")
    async def search_knowledge_base(self, query: str) -> str:
        """Vertex AI RAG lookup via the shared orchestrator retrieval endpoint."""
        try:
            chunks = await rag_vertex.retrieve(self.tenant_id, query, top_k=3)
            if not chunks:
                return "No matching knowledge found in indexed sources."
            return "\n\n".join(c.get("text", "") for c in chunks if c.get("text"))
        except Exception as exc:
            return f"Knowledge search failed: {exc}"

    @function_tool(description="Ask a complex business question that requires AI analysis.")
    async def ask_business_ai(self, question: str) -> str:
        try:
            from services.config import N8N_URL
            import aiohttp

            url = f"{N8N_URL}/webhook/ai-assistant"
            payload = {"question": question, "context": "general", "source": "voice-agent"}
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("answer", data.get("response", data.get("text", json.dumps(data))))
                    return f"AI service returned status {resp.status}"
        except Exception as exc:
            return f"AI assistant unavailable: {exc}. Try asking a simpler question."

    @function_tool(description="Get low stock alerts.")
    async def low_stock_alerts(self) -> str:
        try:
            result = await erp_call("small_erp.api.inventory.get_low_stock_items")
            if isinstance(result, dict) and "error" not in result:
                items = result.get("items", result)
                if isinstance(items, list) and items:
                    lines = [
                        f"- {i.get('item_name', i.get('item_code', '?'))}: {i.get('actual_qty', 0)} remaining"
                        for i in items[:10]
                    ]
                    return f"Low stock alerts ({len(items)} items):\n" + "\n".join(lines)
                return "No low stock alerts. Inventory levels are healthy."

            bins = await erp_get_list(
                "Bin",
                filters={"actual_qty": ["<", 10]},
                fields=["item_code", "actual_qty", "warehouse"],
                limit=10,
            )
            if bins:
                lines = [f"- {b['item_code']}: {b['actual_qty']} in {b['warehouse']}" for b in bins]
                return f"Items with low stock:\n" + "\n".join(lines)
            return "No low stock items detected."
        except Exception as exc:
            return f"Error checking stock alerts: {exc}"

    @function_tool(description="Get current date, time, and basic system status.")
    async def system_status(self) -> str:
        now = datetime.datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")
        try:
            await erp_call("frappe.client.get_count", {"doctype": "Sales Invoice"})
            erp_status = "connected"
        except Exception:
            erp_status = "disconnected"
        return f"Current time: {now}. ERP status: {erp_status}."

    # ─── WRITE tools (model is instructed to confirm before calling) ─────
    @function_tool(description="Create a sales invoice (order) for a customer. Provide the customer name and list of items with quantities.")
    async def create_order(self, customer: str, items: str, is_pos: bool = False) -> str:
        try:
            item_list = json.loads(items) if isinstance(items, str) else items
        except json.JSONDecodeError:
            return "Invalid items format. Provide JSON array like: [{'item_code':'ITM001','qty':2}]"

        if not item_list:
            return "No items provided. Please specify at least one item with item_code and qty."

        invoice = {
            "customer": customer,
            "posting_date": datetime.date.today().isoformat(),
            "due_date": datetime.date.today().isoformat(),
            "is_pos": 1 if is_pos else 0,
            "update_stock": 1 if is_pos else 0,
            "items": [{"item_code": i.get("item_code", i.get("name", "")), "qty": i.get("qty", 1)} for i in item_list],
        }
        if is_pos:
            invoice["payments"] = [{"mode_of_payment": "Cash", "amount": 0}]

        result = await erp_create_doc("Sales Invoice", invoice)
        if isinstance(result, dict) and "error" in result:
            return f"Failed to create order: {result['error']}"

        inv_name = result.get("name", "Unknown")
        total = result.get("grand_total", result.get("total", 0))

        if is_pos:
            submit_result = await erp_submit_doc("Sales Invoice", inv_name)
            if isinstance(submit_result, dict) and "error" in submit_result:
                return f"Order {inv_name} created (₹{total}) but failed to submit: {submit_result['error']}"
            return f"POS order {inv_name} completed! Total: ₹{total}. Payment recorded."

        return f"Order {inv_name} created as draft. Total: ₹{total}. Say 'submit order {inv_name}' to finalize."

    @function_tool(description="Submit (finalize) a draft sales invoice by its ID.")
    async def submit_order(self, invoice_name: str) -> str:
        result = await erp_submit_doc("Sales Invoice", invoice_name)
        if isinstance(result, dict) and "error" in result:
            return f"Failed to submit {invoice_name}: {result['error']}"
        return f"Invoice {invoice_name} submitted successfully. It's now finalized."

    @function_tool(description="Record a payment against an unpaid invoice.")
    async def record_payment(self, invoice_name: str, amount: float, mode_of_payment: str = "Cash") -> str:
        try:
            result = await erp_call(
                "small_erp.api.orders.record_payment",
                {"invoice_name": invoice_name, "amount": amount, "mode_of_payment": mode_of_payment},
                http_method="POST",
            )
            if isinstance(result, dict) and "error" not in result:
                return f"Payment of ₹{amount} recorded against {invoice_name} via {mode_of_payment}."

            payment = {
                "payment_type": "Receive",
                "party_type": "Customer",
                "party": "",
                "paid_amount": amount,
                "received_amount": amount,
                "mode_of_payment": mode_of_payment,
                "references": [
                    {"reference_doctype": "Sales Invoice", "reference_name": invoice_name, "allocated_amount": amount}
                ],
            }
            inv_list = await erp_get_list("Sales Invoice", filters={"name": invoice_name}, fields=["customer"])
            if inv_list:
                payment["party"] = inv_list[0].get("customer", "")

            pe_result = await erp_create_doc("Payment Entry", payment)
            if isinstance(pe_result, dict) and "error" in pe_result:
                return f"Payment failed: {pe_result['error']}"

            pe_name = pe_result.get("name", "")
            await erp_submit_doc("Payment Entry", pe_name)
            return f"Payment of ₹{amount} recorded against {invoice_name}. Payment Entry: {pe_name}"
        except Exception as exc:
            return f"Payment error: {exc}"

    @function_tool(description="Create a new customer in the system.")
    async def create_customer(self, customer_name: str, mobile_no: str = "", customer_group: str = "Individual") -> str:
        doc = {
            "customer_name": customer_name,
            "customer_type": "Individual" if customer_group == "Individual" else "Company",
            "customer_group": customer_group,
        }
        if mobile_no:
            doc["mobile_no"] = mobile_no

        result = await erp_create_doc("Customer", doc)
        if isinstance(result, dict) and "error" in result:
            return f"Failed to create customer: {result['error']}"
        return f"Customer '{customer_name}' created successfully."

    @function_tool(description="Create a new item/product in inventory.")
    async def create_item(self, item_name: str, rate: float, item_group: str = "Products", stock_uom: str = "Nos") -> str:
        doc = {
            "item_name": item_name,
            "item_code": item_name.replace(" ", "-").upper()[:20],
            "item_group": item_group,
            "stock_uom": stock_uom,
            "standard_rate": rate,
            "is_stock_item": 1,
        }
        result = await erp_create_doc("Item", doc)
        if isinstance(result, dict) and "error" in result:
            return f"Failed to create item: {result['error']}"
        code = result.get("name", doc["item_code"])
        return f"Item '{item_name}' created with code {code}, price ₹{rate}."

    @function_tool(description="Record a stock entry — add stock to a warehouse.")
    async def add_stock(self, item_code: str, qty: float, warehouse: str = "Stores - LDI") -> str:
        doc = {
            "stock_entry_type": "Material Receipt",
            "items": [{"item_code": item_code, "qty": qty, "t_warehouse": warehouse}],
        }
        result = await erp_create_doc("Stock Entry", doc)
        if isinstance(result, dict) and "error" in result:
            return f"Stock entry failed: {result['error']}"

        se_name = result.get("name", "")
        submit = await erp_submit_doc("Stock Entry", se_name)
        if isinstance(submit, dict) and "error" in submit:
            return f"Stock entry {se_name} created but submit failed: {submit['error']}"
        return f"Added {qty} units of {item_code} to {warehouse}. Entry: {se_name}"

    @function_tool(description="Trigger an n8n automation workflow by name.")
    async def trigger_workflow(self, workflow: str, params: str = "{}") -> str:
        try:
            extra = json.loads(params) if isinstance(params, str) else params
        except json.JSONDecodeError:
            extra = {}

        payload = {
            "event": workflow,
            "data": {"source": "voice-agent", "triggered_at": datetime.datetime.now().isoformat(), **extra},
        }
        result = await n8n_webhook("erp-event", payload)
        if isinstance(result, dict) and "error" in result:
            return f"Workflow trigger failed: {result['error']}"
        return f"Workflow '{workflow}' triggered successfully. {result.get('message', '')}"

    @function_tool(description="Send a notification or alert via n8n.")
    async def send_notification(self, message: str, channel: str = "email", recipient: str = "") -> str:
        payload = {
            "action": "notify",
            "message": message,
            "channel": channel,
            "recipient": recipient,
            "source": "voice-agent",
        }
        result = await n8n_webhook("erp-event", payload)
        if isinstance(result, dict) and "error" in result:
            return f"Notification failed: {result['error']}"
        return f"Notification sent via {channel}."

    @function_tool(description="List upcoming calendar events.")
    async def list_events(self, max_results: int = 5) -> str:
        if not GOOGLE_CALENDAR_ENABLED:
            return "Calendar integration is not enabled."
        try:
            from googleapiclient.discovery import build
            from google.oauth2.credentials import Credentials

            creds_file = os.getenv("GOOGLE_CREDENTIALS_FILE", "/app/credentials.json")
            if not os.path.exists(creds_file):
                return "Google Calendar credentials not configured."

            creds = Credentials.from_authorized_user_file(creds_file)
            service = build("calendar", "v3", credentials=creds)
            now = datetime.datetime.utcnow().isoformat() + "Z"
            events_result = service.events().list(
                calendarId="primary",
                timeMin=now,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            ).execute()
            events = events_result.get("items", [])
            if not events:
                return "No upcoming events found."
            lines = [f"- {e.get('summary', 'Untitled')} at {e['start'].get('dateTime', e['start'].get('date'))}" for e in events]
            return "Upcoming events:\n" + "\n".join(lines)
        except Exception as exc:
            return f"Calendar error: {exc}"

    @function_tool(description="Create a new calendar event.")
    async def create_event(self, summary: str, start_time: str, end_time: str) -> str:
        if not GOOGLE_CALENDAR_ENABLED:
            return "Calendar integration is not enabled."
        try:
            from googleapiclient.discovery import build
            from google.oauth2.credentials import Credentials

            creds_file = os.getenv("GOOGLE_CREDENTIALS_FILE", "/app/credentials.json")
            creds = Credentials.from_authorized_user_file(creds_file)
            service = build("calendar", "v3", credentials=creds)
            event = {
                "summary": summary,
                "start": {"dateTime": start_time, "timeZone": AGENT_TIMEZONE},
                "end": {"dateTime": end_time, "timeZone": AGENT_TIMEZONE},
            }
            service.events().insert(calendarId="primary", body=event).execute()
            return f"Event '{summary}' created successfully."
        except Exception as exc:
            return f"Failed to create event: {exc}"


SYSTEM_INSTRUCTIONS = f"""You are Muslimbot, a highly efficient enterprise voice assistant for Small ERP.
You help users manage their business operations through natural conversation.

Your capabilities:
READ operations (instant, no confirmation needed):
- Search products/items in inventory and check stock levels
- Search knowledge base for policies and FAQs (search_knowledge_base)
- Look up customers and their purchase history
- Review recent orders and sales summaries
- Check outstanding receivables and low stock alerts
- Answer complex business questions via AI analysis
- Check calendar events

WRITE operations (ALWAYS confirm before executing):
- Create sales orders/invoices (regular or POS)
- Submit draft invoices to finalize them
- Record payments against invoices
- Create new customers
- Create new items/products
- Add stock to inventory (material receipt)
- Trigger automation workflows (daily-summary, alerts, reminders)
- Send notifications via email/SMS/Slack
- Create calendar events

Communication style:
- Be concise and professional. Speak naturally.
- For lists, summarize the key points — don't read raw data dumps.
- ALWAYS confirm write operations before executing.
- If a query returns no results, suggest alternatives.
- Use the local currency symbol (₹) for amounts.
- Current timezone: {AGENT_TIMEZONE}
- Current date: {datetime.date.today().isoformat()}

Never output raw JSON or markdown formatting. Speak as if talking to a busy business owner.
"""


async def build_system_instructions(tenant_id: str, voice_context: str = "") -> str:
    base_instructions = SYSTEM_INSTRUCTIONS

    # Try to fetch dynamic system prompt from RAG
    try:
        chunks = await rag_vertex.retrieve(tenant_id, "type=system_prompt", top_k=1)
        for chunk in chunks:
            text = chunk.get("text", "").strip()
            if text and len(text) > 50:
                base_instructions = text
                break
    except Exception as exc:
        logger.warning(f"Failed to fetch dynamic system prompt: {exc}")

    kb_block = ""
    if voice_context and voice_context.strip():
        kb_block = (
            "\n\nORGANIZATION KNOWLEDGE (use for FAQs; use tools for live stock/orders):\n"
            f"{voice_context.strip()}\n"
        )
    return base_instructions + kb_block


async def _maybe_start_recording(ctx: JobContext) -> None:
    """Opt-in call recording via LiveKit Egress (audio-only OGG → MinIO/GCS).

    Requires the `egress` service + a Redis shared with the LiveKit server (WS-9).
    Storage credentials are passed per-request, so egress itself needs no storage
    config. Object storage is **MinIO (S3) locally / GCS in prod** — deliberately
    NOT Azure, to match the GCP/sovereign storage direction (WS-6).

    Fail-soft: if egress is not deployed or storage is misconfigured, the call
    continues without a recording. We trigger here (agent side) because the worker
    *joins* dispatched rooms rather than creating them; for centrally-created rooms
    the more robust option is attaching `RoomEgress` at room-creation time in the
    orchestrator (see WS-9).
    """
    if os.getenv("EGRESS_ENABLED", "").lower() not in ("1", "true", "yes"):
        return

    backend = os.getenv("EGRESS_STORAGE", "s3").lower()
    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    filepath = f"call-recordings/{ctx.room.name}-{ts}.ogg"
    try:
        from livekit import api

        if backend == "gcp":
            upload = {
                "gcp": api.GCPUpload(
                    credentials=os.getenv("EGRESS_GCP_CREDENTIALS", ""),
                    bucket=os.getenv("EGRESS_GCP_BUCKET", "muslimbot-recordings"),
                )
            }
        else:  # s3 / MinIO (S3-compatible)
            upload = {
                "s3": api.S3Upload(
                    access_key=os.getenv("EGRESS_S3_ACCESS_KEY", ""),
                    secret=os.getenv("EGRESS_S3_SECRET", ""),
                    bucket=os.getenv("EGRESS_S3_BUCKET", "muslimbot-recordings"),
                    endpoint=os.getenv("EGRESS_S3_ENDPOINT", ""),
                    region=os.getenv("EGRESS_S3_REGION", "us-east-1"),
                    force_path_style=True,
                )
            }

        req = api.RoomCompositeEgressRequest(
            room_name=ctx.room.name,
            audio_only=True,  # audio receipt — avoids video rendering overhead
            file_outputs=[
                api.EncodedFileOutput(
                    file_type=api.EncodedFileType.OGG,  # audio-only → OGG, not MP4
                    filepath=filepath,
                    **upload,
                )
            ],
        )
        lkapi = api.LiveKitAPI()  # reads LIVEKIT_URL / API_KEY / API_SECRET from env
        try:
            info = await lkapi.egress.start_room_composite_egress(req)
            logger.info(
                "Recording started: egress_id=%s room=%s file=%s backend=%s",
                info.egress_id, ctx.room.name, filepath, backend,
            )
        finally:
            await lkapi.aclose()
    except Exception as e:
        logger.warning("Egress start failed; continuing without recording: %s", e)


async def entrypoint(ctx: JobContext) -> None:
    logger.info("New session connected to room: %s", ctx.room.name)
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Opt-in call recording (LiveKit Egress → MinIO/GCS). No-op unless EGRESS_ENABLED.
    await _maybe_start_recording(ctx)

    voice_context = ""
    try:
        voice_context = await voice_brief.get_cached(TENANT_ID)
        if not voice_context:
            preview = await voice_brief.get_preview(TENANT_ID)
            voice_context = preview.get("context", "") or ""
    except Exception as e:
        logger.warning("Failed to load voice brief: %s", e)

    participant_identity = (
        next(iter(ctx.room.remote_participants.values())).identity
        if ctx.room.remote_participants
        else "unknown"
    )
    try:
        memory_turns = await get_conversation_memory(participant_identity)
        if memory_turns:
            voice_context += "\n\nRECENT CONVERSATION HISTORY:\n"
            for turn in memory_turns:
                voice_context += f"{turn['role'].upper()}: {turn['text']}\n"
    except Exception as e:
        logger.warning("Failed to load conversation memory: %s", e)

    instructions = await build_system_instructions(TENANT_ID, voice_context)

    agent = MuslimbotAgent(tenant_id=TENANT_ID, instructions=instructions)
    agent.participant_identity = participant_identity

    # Optional MCP toolset — opt-in via env. Direct @function_tool tools above
    # remain the reliable default; this only *adds* whatever the n8n MCP exposes.
    extra_tools = []
    n8n_mcp_url = os.getenv("N8N_MCP_URL")
    if n8n_mcp_url:
        extra_tools.append(
            mcp.MCPToolset(
                id="n8n",
                mcp_server=mcp.MCPServerHTTP(url=n8n_mcp_url, transport_type="streamable_http"),
            )
        )
        logger.info("Attached n8n MCP toolset: %s", n8n_mcp_url)

    session_kwargs = dict(
        # Gemini Live realtime — native server-side VAD / turn detection.
        llm=google.beta.realtime.RealtimeModel(
            model=GEMINI_VOICE_MODEL,
            voice="Puck",
            temperature=0.7,
        ),
    )
    if extra_tools:
        session_kwargs["tools"] = extra_tools

    session = AgentSession(**session_kwargs)

    # Conversation memory + per-turn latency telemetry (WS-5). Per-turn latency
    # rides on ChatMessage.metrics (the 1.x-recommended source); memory persists
    # each committed user/assistant turn. Both are defensive via getattr.
    @session.on("conversation_item_added")
    def _on_item(ev: ConversationItemAddedEvent) -> None:
        item = getattr(ev, "item", None)
        if item is None:
            return
        turn_metrics = getattr(item, "metrics", None)
        if turn_metrics is not None:
            logger.info("VOICE_METRICS tenant=%s room=%s %s", TENANT_ID, ctx.room.name, turn_metrics)
        role = getattr(item, "role", "")
        text = getattr(item, "text_content", None) or ""
        if role in ("user", "assistant") and text:
            mapped = "user" if role == "user" else "agent"
            asyncio.create_task(append_conversation_memory(participant_identity, mapped, text))

    await session.start(agent=agent, room=ctx.room)
    await session.generate_reply(
        instructions=(
            "Greet the user briefly: say you are Muslimbot, their business assistant, "
            "and that you can help search products, check stock, review orders, look up "
            "customers, or answer business questions. Then ask how you can help."
        )
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="muslimbot"))
