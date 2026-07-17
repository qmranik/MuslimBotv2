# Voice Agent Implementation & Testing Plan

This document outlines the step-by-step implementation plan to test the MuslimBot Voice Agent locally, interact with it via voice-first web interfaces, and connect it to a real Twilio phone number for PSTN calling.

The architecture relies on **LiveKit** as the WebRTC/SIP bridge, **Gemini 2.5 Flash Realtime** for the AI brain, and **MCP** for dynamic data fetching (ERPNext, Vertex RAG, Nextcloud).

---

## Phase 1: Prerequisites & Environment Setup

Before starting the agent, you need to configure your local environment and external cloud providers.

### 1.1 Cloud Accounts & Keys
You will need the following API keys:
1. **Gemini API Key:** Get this from Google AI Studio. Ensure you have access to the `gemini-2.5-flash` realtime model.
2. **LiveKit Cloud Project:** Create a free project at [LiveKit Cloud](https://cloud.livekit.io/). This is highly recommended for testing because handling WebRTC NAT traversal and SIP trunks locally on a laptop is extremely difficult. 
    * Get your `LIVEKIT_URL` (wss://...), `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`.
3. **Twilio Account:** For testing PSTN (real phone) calls. You need a funded account and a phone number.

### 1.2 Local Environment Setup
Navigate to the voice agent directory and set up your Python environment:

```bash
cd MuslimBot/Muslimbot-voice-agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create or update your `.env` file:
```env
LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=<your_api_key>
LIVEKIT_API_SECRET=<your_api_secret>
GOOGLE_API_KEY=<your_gemini_api_key>
```

---

## Phase 2: Running the Voice Agent Locally

The agent script (`agent.py`) connects to your LiveKit project as a worker. It sits idle until a user connects to a room, at which point it joins and begins listening and speaking using Gemini.

### 2.1 Mocking MCP Servers (For initial testing)
If your n8n or Vertex RAG servers are not running locally, the agent will crash when trying to connect to the MCP endpoints. For isolated testing, you can comment out the `tools=[kb_mcp, erp_mcp, vertex_rag_mcp]` line in `agent.py` or ensure those local HTTP/Stdio MCP servers are actively running.

### 2.2 Starting the Worker
Run the agent in development mode:

```bash
python agent.py dev
```
*Expected Output:* You should see logs indicating the worker successfully connected to LiveKit and is waiting for jobs.

---

## Phase 3: Web-Based "Call Button" Testing

To test the agent directly from a browser (e.g., embedding a "Call Support" button on your Generative UI or website).

### 3.1 Use the LiveKit Sandbox (Fastest Method)
LiveKit provides a hosted web sandbox to instantly test your agent.
1. Go to [LiveKit Agents Sandbox](https://agents-playground.livekit.io/).
2. Click the gear icon (Settings) and enter your LiveKit URL, API Key, and API Secret.
3. Click **Connect**. 
4. Your local terminal running `agent.py` will show that a room was created and the agent joined. 
5. Start speaking into your browser microphone! The agent will process your speech natively via Gemini and respond with sub-500ms latency.

### 3.2 Embedding in Generative-UI (Next.js)
To integrate the call button into your `generative-ui`:
1. Install `@livekit/components-react`.
2. Create a React component that fetches a token from your Go Orchestrator (which uses the LiveKit Server SDK to mint a token for the user).
3. Render the `<LiveKitRoom>` component with voice support enabled.

---

## Phase 4: Twilio SIP Integration (Phone Calling)

To allow users to call your Twilio phone number and speak to the local agent.

### 4.1 Create a SIP Trunk in LiveKit
Instead of configuring a complex Asterisk server locally, use LiveKit's managed SIP Inbound feature.
1. Install the LiveKit CLI: `brew install livekit-cli`
2. Create a SIP Inbound Trunk pointing to your Twilio numbers:
   ```bash
   livekit-cli create sip-inbound-trunk \
     --name "Twilio Inbound" \
     --numbers "+1234567890" \
     --api-key <your_key> --api-secret <your_secret> --url <your_url>
   ```

### 4.2 Create a SIP Dispatch Rule
Tell LiveKit what to do when a call comes in. We want it to create a room (e.g., `muslimbot-call`) which our worker will detect and join.
```bash
livekit-cli create sip-dispatch-rule \
  --name "Route to Agent" \
  --rule-dispatch-room-prefix "muslimbot-call-" \
  --api-key <your_key> --api-secret <your_secret> --url <your_url>
```

### 4.3 Configure Twilio
1. Go to your Twilio Console -> Phone Numbers.
2. Select your number.
3. Under **Voice & Fax**, set "A call comes in" to **SIP Trunk** or use a Twilio Studio Flow with a TwiML `<Dial><Sip>` verb pointing to LiveKit's SIP endpoint (usually provided in your LiveKit Cloud dashboard under SIP).
   * Example TwiML: `<Response><Dial><Sip>sip:+1234567890@<your-project>.sip.livekit.cloud</Sip></Dial></Response>`

### 4.4 Test the Phone Call
1. Ensure your local `agent.py dev` is running.
2. Call your Twilio phone number from your cell phone.
3. Twilio routes the call via SIP to LiveKit.
4. LiveKit creates a room `muslimbot-call-<id>`.
5. Your local Python agent detects the room creation, joins the room, and says "You are the MuslimBot Voice Assistant...".
6. Ask a question like, "What is the status of my order?" 
7. Gemini will trigger the MCP tool, query the ERP, and speak the answer back into your ear.

---

## Phase 5: End-to-End MCP Testing

Once voice connectivity is proven (via Web or Twilio), test the data layer:
1. **ERP Query:** Say, "Can you check if we have any Premium Organic Dates in stock?"
   * *Expected:* Agent pauses, terminal shows `mcp.MCPServerHTTP` execution, agent synthesizes the response based on the returned JSON.
2. **Vertex RAG Query:** Say, "What is our company policy on remote work?"
   * *Expected:* Agent triggers the `vertex-rag` tool, retrieves context from the orchestrator, and answers based *only* on the retrieved document.
3. **Action/Write:** Say, "Please escalate ticket number 102 to priority."
   * *Expected:* Agent triggers the ERP MCP to escalate the ticket.

## Troubleshooting
- **Agent doesn't join room:** Ensure `LIVEKIT_URL` matches the project you are using for the Sandbox or SIP trunk.
- **MCP Connection Refused:** Ensure the local MCP servers (Nextcloud Postgres stdio, n8n HTTP, Vertex RAG HTTP) are actually running and accessible from the Python environment.
- **Latency is high (>1s):** Ensure you are using `gemini-2.5-flash` via `google.realtime.RealtimeModel` and not a legacy transcribe -> LLM -> TTS pipeline.