# Muslimbot Voice Agent (LiveKit-only)

Real-time enterprise voice assistant for Small ERP. This package is a **LiveKit
worker only** — it joins dispatched rooms, runs Gemini Live speech-to-speech, and
calls the Go orchestrator for every ERP and knowledge-base tool.

Knowledge ingestion, RAG chat, voice-session minting, and voice briefs are **not**
implemented here. They live in the Go orchestrator under `/v1/kb/*`.

## Architecture

```
Browser / GenUI
   │  POST /v1/kb/voice/session  (Authentik)
   ▼
Go Orchestrator
   │  LiveKit token + named dispatch + workload JWT
   ▼
LiveKit  ◄──WebRTC──►  Browser
   │
   ▼
Python worker (this package)
   │  Bearer workload JWT
   ▼
Go /v1/agent/*  →  Small ERP / Vertex RAG / n8n
```

## Features

### Realtime knowledge context (ADR-0002)
- Warm brief at join via `GET /v1/agent/kb/voice-brief`
- Live retrieve per question via `POST /v1/agent/kb/retrieve` (tenant CEL filter)
- Mid-call refresh: Redis Stream `kb:events:<tenant>` → refetch `/v1/agent/kb/context` → `agent.update_instructions`
- Session heartbeat/end: `POST /v1/agent/sessions/heartbeat|end`

### Read tools (instant via Go)
- Inventory / stock / sales / customers / receivables / low stock
- Knowledge-base retrieve (`search_knowledge_base`)
- System status / business AI webhook

### Write tools (server-confirmed via Go ToolAction)
- Create order / customer / item / stock entry / payment
- Worker speaks the Go confirmation summary, then calls
  `confirm_pending_action` only after an explicit yes/no

## Quick start

### Prerequisites
- Running Go orchestrator with LiveKit env (`LIVEKIT_*`, `WORKLOAD_JWT_SECRET`)
- LiveKit server (or Cloud)
- `GOOGLE_API_KEY` for Gemini Live
- Core ERP stack reachable from Go (not from this worker)

### Configure

```bash
cp ../.env.template .env
# Required:
# LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
# GOOGLE_API_KEY
# GO_ORCHESTRATOR_URL=http://go-orchestrator:8080
# REDIS_URL=redis://redis-cache:6379/2
```

### Run with the platform compose

```bash
# From MuslimBot/
docker compose --profile voice up -d muslimbot-voice-worker
```

### Standalone (external liteerp_smb-net)

```bash
cd Muslimbot-voice-agent
docker compose up -d
```

### Local dev

```bash
pip install -r requirements.txt
python agent.py dev
```

## Connecting from GenUI

1. Open the canonical generative-ui Knowledge Hub.
2. Click **Call Muslimbot**.
3. GenUI calls `POST /v1/kb/voice/session` on Go.
4. Go returns a browser LiveKit token + public WSS URL and dispatches agent
   `muslimbot` with a signed workload JWT in room/job metadata.
5. This worker joins the room and uses that JWT for `/v1/agent/*`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LIVEKIT_URL` | Yes | LiveKit WebSocket URL for the worker |
| `LIVEKIT_API_KEY` | Yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | Yes | LiveKit API secret |
| `LIVEKIT_AGENT_NAME` | No | Dispatch name (default `muslimbot`) |
| `GOOGLE_API_KEY` | Yes | Gemini Live API key |
| `GO_ORCHESTRATOR_URL` | Yes | Go base URL (default `http://go-orchestrator:8080`) |
| `REDIS_URL` | No | Short-lived voice memory (default redis DB 2) |
| `GEMINI_VOICE_MODEL` | No | Default `gemini-2.0-flash-live-001` |
| `AGENT_TIMEZONE` | No | Default `Asia/Dhaka` |

## What was removed

- FastAPI KB BFF (`bff_main.py`, `routes/`, port 8787)
- Local SQLite ingestion / scrape adapters
- Direct Frappe / n8n HTTP clients from the worker
- Python voice-session token minting

Use Go endpoints instead:

- `POST /v1/kb/sources/*` — ingestion
- `POST /v1/kb/retrieve`, `POST /v1/kb/chat` — RAG
- `POST /v1/kb/voice/session` — browser token + dispatch
- `GET /v1/kb/voice-brief` — warm context
- `POST /v1/agent/tool-actions` — confirmed ERP tools
