# Production-Grade Voice Agent: Full Implementation & Improvisation Plan

This document outlines the architecture, improvements, and implementation steps required to transform the MVP voice agent into a seamless, production-grade Customer Support & Order Management Agent.

## 1. Seamless User Experience Improvements

To make the Voice Agent feel like a natural, high-fidelity human assistant, several UX and technical improvements must be implemented.

### 1.1 Web Call Button (MVP Delivered)
- **Implementation:** We added a `<VoiceCallButton />` in `generative-ui` utilizing `@livekit/components-react`.
- **Next Step:** Implement a dynamic token exchange. The `generative-ui` must call `go-orchestrator` at `GET /v1/voice/token`, which uses the LiveKit Server SDK to mint a secure, short-lived WebRTC token tied to the user's browser session.

### 1.2 "Barge-in" and Interruption Handling
- **Mechanism:** Gemini Live natively handles turn detection. However, to make it seamless, the frontend `RoomAudioRenderer` and the Python worker must be configured to prioritize low-latency audio chunks.
- **Improvement:** Implement LiveKit's `TrackPublication` priorities so that agent audio is deprioritized the moment user microphone activity spikes (barge-in).

### 1.3 Context Injection (Source Tracking)
- **Concept:** When a user connects, the agent should already know *where* they are calling from and *who* they are.
- **Implementation:**
  - Pass `metadata` inside the LiveKit connection token (e.g., `{"source": "website", "device": "mobile", "user_id": "optional_id"}`).
  - In `agent.py`, read `ctx.room.metadata` upon connection and inject it into the Gemini system prompt dynamically: *"You are talking to a user who just called from our Website on a Mobile device."*

## 2. Order Taking & ERP Integrations

The Voice Agent acts as a front-end to the ERP system via MCP (n8n Master Controller).

### 2.1 The Order Flow
1. **Intent Recognition:** User says, "I'd like to order 5 bags of coffee."
2. **Inventory Check:** Agent invokes the `check_inventory` MCP tool.
3. **Data Collection:** If in stock, the agent naturally asks for missing data: "Great, we have that in stock. Can I get your full name, shipping address, and phone number to complete the order?"
4. **Customer Record Creation:** Agent invokes the `create_customer` MCP tool. The system records the user's data and tags the source as `Voice Agent (Website)`.
5. **Order Finalization:** Agent invokes the `submit_order` MCP tool. 

### 2.2 System Prompt Engineering
The system prompt has been aggressively tuned to handle this specific state machine:
```text
"CRITICAL WORKFLOWS: "
"1. CHECKING INVENTORY & TAKING ORDERS: Always verify item stock using the erp-system before confirming an order. "
"If an item is in stock, ask for the required information to complete the order (e.g., Shipping Address, Contact Number). "
"2. CUSTOMER ONBOARDING: If the caller is a new customer, use the erp-system to create a new Customer Record, noting their source (e.g., Website Voice Call, Mobile). "
```

## 3. RAG Knowledge & Support Escalation

### 3.1 Tiered Knowledge Architecture
The agent has access to two distinct knowledge bases:
- **`knowledge-base` (Nextcloud/Local):** Used for fast, standard operating procedures (SOPs) like return policies and business hours.
- **`vertex-rag` (Enterprise Docs):** Used for deep, complex corporate knowledge. 

### 3.2 Human Handoff (Escalation)
If the user is frustrated or the agent cannot fulfill the request:
- **Implementation:** The agent is instructed to use the `escalate_ticket` MCP tool.
- **Flow:** Agent says, "I'm sorry I couldn't resolve this. Let me create an urgent support ticket for you right now, and a human agent will call you back within 10 minutes." It then invokes the tool which creates a Helpdesk Ticket in Frappe.

## 4. Implementation Steps & Roadmap

### Step 1: Token Minting Backend
- **Action:** Add a `/v1/voice/token` endpoint in `go-orchestrator`.
- **Logic:** Validate the user session, generate a LiveKit token using the LiveKit Go SDK, and embed source metadata (Browser/OS).

### Step 2: MCP Tool Expansion
- **Action:** Ensure the n8n HTTP MCP server exposes specific, atomic endpoints:
  - `check_inventory(item_name)`
  - `create_customer(name, phone, address, source)`
  - `submit_order(customer_id, items)`
  - `escalate_ticket(issue_summary, priority)`

### Step 3: Observability & Quality Assurance
- **Action:** Route LiveKit Webhook events (e.g., `participant_joined`, `track_published`) to the `go-orchestrator`.
- **Monitoring:** Log the `TURN_METRIC` (latency per turn) from `agent.py` directly into Loki to ensure the agent maintains sub-500ms response times. If it spikes above 1000ms, trigger an alert.

### Step 4: PSTN Fallback
- **Action:** Re-enable the Twilio SIP trunking configuration outlined in `VOICE_IMPLEMENTATION_AND_TESTING_PLAN.md` so the agent can take real phone calls simultaneously with web calls.
