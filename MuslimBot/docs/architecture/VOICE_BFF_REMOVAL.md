# FastAPI KB BFF removed — LiveKit-only voice worker

**Date:** 2026-07-18

## Change

`Muslimbot-voice-agent` no longer runs a FastAPI Knowledge Base BFF on port 8787.
The Go orchestrator is the sole owner of:

- Knowledge ingestion (`/v1/kb/sources/*`)
- RAG retrieve/chat (`/v1/kb/retrieve`, `/v1/kb/chat`)
- Voice session minting + named agent dispatch (`/v1/kb/voice/session`)
- Voice briefs (`/v1/kb/voice-brief`)
- Durable confirmed ERP tools for voice (`/v1/agent/tool-actions`)

The Python package is a LiveKit + Gemini Live worker only. It authenticates to
Go with a session-bound workload JWT embedded in LiveKit dispatch metadata.

## Callers

| Old | New |
|-----|-----|
| `http://muslimbot-kb-bff:8787/*` | `http://go-orchestrator:8080/v1/kb/*` |
| `/kb-api/*` GenUI proxy | `/v1/kb/*` via GenUI rewrite / `NEXT_PUBLIC_API_URL` |
| `KB_BFF_API_KEY` / `X-KB-API-Key` | `ORCHESTRATOR_SERVICE_API_KEY` / `X-Service-API-Key` (services) |
| Worker direct Frappe calls | `/v1/agent/tool-actions` with confirmation |

## Rollback

Restore the previous `Muslimbot-voice-agent` FastAPI routes from git history and
re-add the `muslimbot-kb-bff` compose service only as an emergency measure.
Prefer fixing Go KB/voice endpoints instead.
