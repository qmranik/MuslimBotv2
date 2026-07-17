# MuslimBot Workflows

This document outlines practical, realistic workflows based on the current architecture of the MuslimBot System (`go-orchestrator`, `small_erp`, `generative-ui`, `Muslimbot-voice-agent`, and `n8n`).

## 1. Omnichannel Customer Support Workflow
**Problem:** Businesses need a unified way to handle support across various channels (WhatsApp, Webchat, Email) without manual triage.
**Current State:** Chatwoot is embedded via SecurePortal; `go-orchestrator` has a webhook aggregator to route events to `n8n`.
**Workflow:**
1. **Trigger:** Customer sends a message via Chatwoot (e.g., Web Widget or WhatsApp).
2. **Ingress:** `go-orchestrator` receives the Chatwoot webhook at `POST /v1/webhooks/:source`.
3. **Routing:** Orchestrator resolves the tenant and forwards the payload to the tenant's `n8n` instance.
4. **Processing (n8n):**
   - n8n triggers a loop-guard check (to prevent infinite AI replies).
   - n8n extracts customer intent and context.
   - n8n queries the `go-orchestrator` AI brain (`/v1/ai/generate` or `/v1/ai/tool/execute`) and Vertex RAG KB.
5. **Action:**
   - **Scenario A (Resolved):** AI brain generates a structured response. n8n posts the reply back to the Chatwoot conversation.
   - **Scenario B (Handoff):** AI detects negative sentiment or complex issues (`[HANDOFF_REQUIRED]`). n8n updates the Chatwoot conversation status to "Open" and assigns a human agent.

## 2. Voice-to-Order (Telephony Automation)
**Problem:** Small businesses miss orders via phone calls because they lack dedicated phone operators.
**Current State:** `Muslimbot-voice-agent` runs LiveKit + Gemini Multimodal Agent with 21 connected ERP tools.
**Workflow:**
1. **Trigger:** Customer calls the business's SIP trunk (e.g., Twilio).
2. **Bridge:** Twilio routes the SIP call to the self-hosted Asterisk/LiveKit SIP bridge.
3. **Agent Activation:** `Muslimbot-voice-agent` joins the dispatched LiveKit room (prefix `muslimbot-`).
4. **Interaction:** Gemini Live handles realtime audio conversation with the customer (sub-800ms latency).
5. **Tool Execution:** 
   - Customer says, "I'd like to order 5 bags of coffee."
   - Agent triggers `@function_tool` mapped to `submit_order`.
   - Request goes to `go-orchestrator`'s `/v1/ai/tool/execute`.
   - Orchestrator hits `small_erp.api.*` to create a Sales Invoice/Order in Frappe.
6. **Completion:** Call ends. LiveKit Egress (if enabled) saves the `.wav` recording to MinIO/GCS, and an n8n webhook attaches the recording link to the ERPNext Sales Invoice.

## 3. Autonomous Social Media / Marketing Publishing
**Problem:** Consistent social media and marketing presence is time-consuming and often neglected.
**Current State:** Postiz/Mautic portals are available; `n8n` is used for cron automation.
**Workflow:**
1. **Trigger:** n8n cron job fires daily at 9:00 AM.
2. **Data Fetch:** n8n queries `go-orchestrator` to fetch top-selling products or recent ERP trends from `small_erp`.
3. **Content Generation:** n8n sends the data to the AI Brain (`/v1/ai/tool/execute` -> CMS/Marketing tool) to generate engaging, platform-specific copy.
4. **Publishing:** 
   - n8n pushes the generated content to Postiz API queue for social media scheduling.
   - Or, n8n triggers a Mautic campaign for email marketing based on customer segments.

## 4. VIP Ticket Escalation & HRMS Leave Approval (Master Controller)
**Problem:** Internal administrative tasks (leaves, ticketing) require manual portal navigation and manager bottlenecks.
**Current State:** `generative-ui` acts as the Command Center.
**Workflow:**
1. **Trigger:** Manager uses the `generative-ui` Chat Command Center (or voice).
2. **Intent:** "Show me pending leave requests" or "Escalate ticket #102 to VIP".
3. **Action:** 
   - Generative UI sends NLP intent to `go-orchestrator` `/v1/ai/generate-ui`.
   - Server brain maps intent to Frappe Master Controller tools (e.g., `small_erp.api.hr.decide_leave` or `small_erp.api.helpdesk.escalate_ticket`).
   - If it's a high-stakes write action, orchestrator returns a `UiDescriptor` prompting the manager with a "Confirm-before-write" card in the GenUI.
4. **Execution:** Manager clicks "Confirm", action executes securely against `small_erp` using tenant contexts.

## 5. RAG / Knowledge Hub Ingestion & Retrieval
**Problem:** Employees waste time searching for standard operating procedures (SOPs) or company policies.
**Current State:** Vertex RAG backend via `/v1/kb/retrieve`; `generative-ui` Knowledge Hub interface.
**Workflow:**
1. **Ingestion (Nextcloud):** Admin uploads a PDF policy to Nextcloud.
2. **Processing:** Nextcloud webhook triggers n8n, which chunks the document and pushes to the KB ingest API (Vertex AI or Qdrant).
3. **Retrieval:** Employee asks the GenUI chatbot "What's our refund policy?"
4. **Resolution:** AI Brain queries `/v1/kb/retrieve`, fetches the relevant document snippets, and synthesizes a direct answer in the GenUI, citing the source document.
