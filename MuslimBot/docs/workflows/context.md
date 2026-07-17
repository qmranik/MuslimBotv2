# MuslimBot System Context: History & User Flows

This document provides the historical context of the MuslimBot System's evolution and details realistic, step-by-step user flows that demonstrate how the system operates in real-world scenarios.

---

## 1. System History & Evolution

### 1.1 The Fragmented Era (Pre-Unified System)
Initially, SME operations using our stack were siloed. Businesses relied on standard ERPNext for accounting and inventory, which required extensive training to navigate complex nested menus. Customer support lived separately in a standalone Chatwoot instance. Automations were hardcoded in basic n8n scripts that lacked deep context, and telephony was entirely disconnected, relying on expensive external SaaS providers or manual operators.
*   **The Problem:** Users suffered from "context switching fatigue." Performing a simple task, like updating a support ticket based on a delayed shipment, required logging into three different systems.

### 1.2 The "Headless" Shift
Recognizing the friction of the standard ERP interface, the development team initiated the "headless" shift. The standard ERPNext desk was blocked for SMB users via `/ops` routing, and a dedicated HTMX-based frontend (`small_erp`) was built to simplify the presentation layer. While simpler, it still required manual navigation and lacked an intelligent integration with external communications.

### 1.3 The Birth of the Single Pane of Glass (Current Era)
To solve the fragmentation, the system was re-architected around the **MuslimBot Agent** philosophy—a unified Generative UI. 
*   **The `go-orchestrator`** was introduced as the central Backend-for-Frontend (BFF), sitting between the user and all services. It provided zero-trust security via Authentik and a centralized API for 21 core AI tools.
*   **Generative UI (Next.js)** became the sole command center. Instead of filling out forms, users now typed intents ("Show me recent orders"). The Go Brain returned `UiDescriptors` that dynamically rendered custom UI components (Charts, Tables, Confirmation Cards) directly in the chat stream.
*   **Voice Integration:** The LiveKit + Gemini Multimodal Agent was integrated, allowing real-time voice calls to trigger the exact same tools that the web UI used, achieving true omnichannel automation.

Today, MuslimBot stands as a sovereign, AI-first operating system where the underlying silos (Frappe, Chatwoot, Nextcloud, Mautic) are invisible to the user, accessed entirely through conversational commands and secure embedded portals.

---

## 2. Realistic User Flows

These flows illustrate how users navigate the MuslimBot ecosystem in practice.

### 2.1 Flow: The Morning Briefing & Autonomous Marketing
**Persona:** Amina, Small Business Owner
**Context:** Amina wants to check her business health and launch a quick marketing push without spending hours looking at spreadsheets.

1.  **Login:** Amina logs into the `generative-ui` portal. Authentik verifies her identity and routes her to her tenant's workspace.
2.  **Intent:** In the Chat Command Center, she types: *"Give me a summary of yesterday's sales and what our top-selling item is right now."*
3.  **Processing:** 
    *   The GenUI sends the prompt to the `go-orchestrator` (`/v1/ai/generate-ui`).
    *   The AI Brain uses the `get_sales_metrics` tool to query `small_erp`.
4.  **Generative Response:** The UI renders a rich **Metrics Card** showing total sales, and a **Bar Chart** highlighting that "Premium Organic Dates" are the top seller.
5.  **Follow-up Intent:** Amina types: *"Draft a social media post promoting the dates and schedule it."*
6.  **Execution via n8n:** 
    *   The AI drafts the copy.
    *   The Go Brain routes the action to the tenant's n8n instance via the webhook aggregator.
    *   n8n pushes the content to the Postiz API queue.
    *   The UI displays a "Confirm-before-write" card. Amina reviews the drafted post and clicks **Confirm**.
7.  **Result:** The post is scheduled. Amina completed a multi-system task in under 2 minutes using only natural language.

### 2.2 Flow: Omnichannel Triage & RAG Support
**Persona:** Bilal, Support Team Lead
**Context:** A customer messages the business via WhatsApp regarding a complicated return policy question.

1.  **Ingress:** The WhatsApp message hits the embedded Chatwoot inbox.
2.  **Webhook Trigger:** Chatwoot sends a webhook to `go-orchestrator`, which routes it to n8n.
3.  **Autonomous RAG Lookup:** 
    *   n8n triggers the AI brain, asking it to evaluate the query.
    *   The AI queries the Knowledge Base (`/v1/kb/retrieve`), which fetches snippets from a PDF uploaded to Nextcloud last week.
4.  **Sentiment Shift:** The customer is confused and the sentiment drops to negative.
5.  **Handoff:** n8n detects the negative sentiment. It stops the autonomous AI loop and flags the Chatwoot conversation with `[HANDOFF_REQUIRED]`.
6.  **Human Intervention:** 
    *   Bilal, monitoring the SecurePortal iframe in the MuslimBot GenUI, sees the flagged conversation.
    *   He clicks into it, reviews the AI's previous context, and resolves the issue manually, ensuring the customer feels heard.

### 2.3 Flow: Zero-Touch Voice Ordering
**Persona:** Tariq, Customer
**Context:** Tariq is driving and wants to place a quick reorder of coffee beans by calling the business directly.

1.  **Call Initiation:** Tariq dials the business's SIP number.
2.  **Agent Answers:** The call routes through Asterisk to the self-hosted LiveKit server. The `Muslimbot-voice-agent` joins the room.
3.  **Conversation:** Tariq hears a natural voice (Gemini Live): *"Welcome back to Roastery Co. How can I help you today?"*
4.  **Intent:** Tariq says, *"Hey, I'd like to order 3 more bags of the Ethiopian roast to my usual address."*
5.  **Tool Execution:** 
    *   The Voice Agent triggers the `@function_tool` for `submit_order`.
    *   The request is passed to the `go-orchestrator`'s `/v1/ai/tool/execute` endpoint.
    *   The orchestrator securely creates a Sales Invoice in the headless `small_erp`.
6.  **Confirmation:** The Voice Agent replies instantly, *"Got it, Tariq. I've placed the order for 3 bags of Ethiopian roast. You'll receive an email confirmation shortly."*
7.  **Post-Call:** Tariq hangs up. LiveKit Egress saves the `.wav` recording to MinIO, and an n8n webhook attaches the recording link directly to the newly created Sales Invoice in Frappe for quality assurance.

### 2.4 Flow: The "Master Controller" HR Action
**Persona:** Sarah, Operations Manager
**Context:** Sarah needs to quickly approve an employee's leave request while navigating other tasks.

1.  **Intent:** Sarah opens the GenUI Command Center and types: *"Show me pending leave requests."*
2.  **Retrieval:** The AI queries the `small_erp` HR module and renders a **Table Component** listing three pending leaves.
3.  **Action:** Sarah types: *"Approve the leave request for John Doe."*
4.  **Security Gate:** The Go orchestrator maps this to the `small_erp.api.hr.decide_leave` tool. Because this mutates state, the GenUI renders a strict **Confirmation Card**.
5.  **Execution:** Sarah clicks **Approve**. The API call executes, the ERP is updated, and the GenUI updates the chat stream with a success message.
