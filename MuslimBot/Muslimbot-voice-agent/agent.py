import asyncio
import json
import logging
import datetime
from dotenv import load_dotenv
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, mcp, llm
from livekit.agents import AgentSession
from livekit.plugins import google
from services.erp_client import erp_call, erp_create_doc, erp_get_list, erp_submit_doc

load_dotenv()
logger = logging.getLogger("voice-agent")
logger.setLevel(logging.INFO)

class ERPTools(llm.FunctionContext):
    @llm.ai_callable(description="Check stock level for a specific item. Returns available quantity across warehouses.")
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

    @llm.ai_callable(description="Search for a customer by name or phone number.")
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

    @llm.ai_callable(description="Create a sales invoice (order) for a customer. Provide the customer name and list of items with quantities.")
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

    @llm.ai_callable(description="Create a new customer profile.")
    async def create_customer(self, customer_name: str, mobile_no: str = "", customer_group: str = "Individual") -> str:
        doc = {
            "customer_name": customer_name,
            "customer_type": "Individual",
            "customer_group": customer_group,
            "mobile_no": mobile_no,
        }
        result = await erp_create_doc("Customer", doc)
        if isinstance(result, dict) and "error" in result:
            return f"Failed to create customer: {result['error']}"
        return f"Customer {customer_name} created successfully with ID {result.get('name', 'Unknown')}."

async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to room {ctx.room.name}")
    
    # Initialize native ERP tools
    erp_fnc_ctx = ERPTools()
    tools = []
    
    try:
        # 1. Connect to Knowledge Base (Standard IO execution)
        kb_mcp = mcp.MCPToolset(
            id="knowledge-base",
            mcp_server=mcp.MCPServerStdio(
                command="npx",
                args=["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:pass@localhost/nextcloud_vectors"]
            )
        )
        tools.append(kb_mcp)
    except Exception as e:
        logger.warning(f"Failed to initialize knowledge-base MCP: {e}")

    try:
        # 2. Connect to Vertex AI RAG Engine (Remote HTTP endpoint via Orchestrator)
        vertex_rag_mcp = mcp.MCPToolset(
            id="vertex-rag",
            mcp_server=mcp.MCPServerHTTP(
                url="http://localhost:8080/mcp/vertex-rag",
                transport_type="streamable_http"
            )
        )
        tools.append(vertex_rag_mcp)
    except Exception as e:
        logger.warning(f"Failed to initialize vertex-rag MCP: {e}")

    # 3. Connect to LiveKit Room and start listening
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # 4. Extract Room Metadata for Context Injection
    source_context = ""
    if ctx.room.metadata:
        try:
            metadata = json.loads(ctx.room.metadata)
            source = metadata.get("source", "Unknown")
            user_id = metadata.get("user_id", "Unknown")
            source_context = f"\n\nUSER CONTEXT:\n- The user is calling from: {source}\n- User ID: {user_id}\nUse this context to personalize your greeting and know their origin."
            logger.info(f"Loaded room metadata: source={source}, user_id={user_id}")
        except json.JSONDecodeError:
            logger.error(f"Failed to decode room metadata as JSON. Raw metadata: {ctx.room.metadata}")

    # 5. Initialize Gemini Real-Time with Tools
    session = AgentSession(
        llm=google.realtime.RealtimeModel(
            model="gemini-2.5-flash",
            voice="Puck",
            temperature=0.6,
            instructions=(
                "You are the MuslimBot Voice Assistant, a production-grade, highly professional Customer Support Agent. "
                "Your primary goal is to assist customers seamlessly, place orders, and provide highly accurate information based exclusively on your knowledge base. "
                "You have direct access to the company's Knowledge Base and ERP System via your tools. "
                "CRITICAL WORKFLOWS: "
                "1. PROACTIVE GREETING: When the conversation starts, proactively greet the user, acknowledging their source (e.g., 'Thank you for calling from our website'). "
                "2. CONTEXTUAL KNOWLEDGE RETRIEVAL: Always use the 'knowledge-base' and 'vertex-rag' tools to retrieve context before answering any questions about company policies, SOPs, products, or guidelines. Never guess or hallucinate. Base your responses strictly on the retrieved knowledge. "
                "3. CHECKING INVENTORY & TAKING ORDERS: Always verify item stock using the 'erp-system' before confirming an order. "
                "If an item is in stock, politely ask for the required information to complete the order (e.g., Shipping Address, Contact Number). "
                "4. CUSTOMER ONBOARDING: If the caller is a new customer, use the 'erp-system' to gracefully collect their details and create a new Customer Record, noting their source (e.g., Website Voice Call, Mobile). "
                "5. SUPPORT ESCALATION: If a user has a complex issue, sounds frustrated, or asks about a helpdesk ticket, use the 'erp-system' to fetch or escalate tickets, ensuring the customer feels heard and supported. "
                "TONE AND ETIQUETTE: "
                "- Be immensely polite, grateful, and professional at all times. Use phrases like 'Thank you for reaching out', 'I would be happy to help with that', and 'I appreciate your patience.' "
                "- Keep your answers conversational, concise, and empathetic. Do not sound robotic. "
                "- Be proactive in asking clarifying questions to fulfill orders or solve problems. "
                f"{source_context}"
            )
        ),
        fnc_ctx=erp_fnc_ctx,
        tools=tools
    )

    logger.info(f"Session starting for room: {ctx.room.name}. Active MCP Tools: {len(tools)}, Native Tools loaded.")
    
    await session.start(room=ctx.room)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
