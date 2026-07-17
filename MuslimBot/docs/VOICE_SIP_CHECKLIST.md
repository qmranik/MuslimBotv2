# Twilio ↔ LiveKit SIP checklist (MuslimBot voice → order)

Voice RAG already uses Go orchestrator Vertex retrieve (`Muslimbot-voice-agent/services/rag_vertex.py` → `POST /v1/kb/retrieve`). Do not point voice at Python KB BFF or local SQLite chunks.

## Prerequisites

- LiveKit Cloud (or self-hosted) project with SIP enabled
- Twilio phone number + Elastic SIP Trunk
- `muslimbot-voice-worker` running (`docker compose --profile voice`)
- Orchestrator reachable as `http://go-orchestrator:8080` with `KBBFF_API_KEY` / `X-KB-API-Key`
- Vertex env on orchestrator: `GCP_PROJECT_ID`, `GCP_LOCATION`, `GCP_RAG_CORPUS_ID`, `GCS_BUCKET_NAME`

## Wire-up

1. Create Twilio Elastic SIP Trunk; allow LiveKit SIP signaling IPs.
2. In LiveKit, create inbound SIP trunk mapped to a dispatch rule for room prefix `muslimbot-`.
3. Point trunk destination to LiveKit SIP URI from the LiveKit dashboard.
4. Ensure voice worker env has `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `GEMINI_API_KEY`, `KBBFF_API_KEY`, `TENANT_ID`.
5. Confirm tool path for orders still hits orchestrator `/v1/ai/tool/execute` or Frappe via existing agent tools (not a second RAG stack).

## Acceptance call

1. Dial the Twilio test number.
2. Ask for stock of a known item → agent uses ERP tools.
3. Ask a policy question → agent uses `/v1/kb/retrieve` (Vertex).
4. Place a small order → Sales Order / invoice appears in ERPNext.
5. Optional: WhatsApp receipt via n8n webhook from the same tool/workflow path.

## Fail closed

If Vertex is unset, retrieve returns 503 — agent should say knowledge is unavailable, not invent policy text from local chunks.
