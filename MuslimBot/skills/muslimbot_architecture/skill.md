---
name: muslimbot_architecture
description: Ground-truth map of the MuslimBot agentic system (orchestrator, Gemini brain, 21-tool catalog, surfaces). READ THIS FIRST before implementing any MuslimBot feature — it prevents building against the blueprint's superseded Vercel-maxSteps design instead of the real server-brain architecture.
---

# MuslimBot Architecture (ground truth)

Read this before touching any agentic/Gen-UI feature. The pasted roadmaps describe a
**Vercel AI SDK `streamText` + `maxSteps`** client loop. That is **NOT** how the repo works —
do not build it verbatim. The real design is a **server-side Gemini brain**.

## The three planes

1. **Go Orchestrator** (`go-orchestrator/`, Gin, `:8080`) — the brain + gateway + tool executor.
   Sits behind Traefik + Authentik (`X-authentik-*` headers → `internal/auth/middleware.go`).
2. **Surfaces** — web Gen-UI (`generative-ui/`, Next.js), voice (`Muslimbot-voice-agent/agent.py`,
   LiveKit + Gemini Live), mobile (`erp-flutter/` — see repo status; may be mid-removal).
3. **Backends** — ERPNext/`small_erp` (`/api/method/small_erp.api.*`), KB (Vertex RAG via `kb_bff`),
   n8n (webhooks), portals (Chatwoot/Postiz/n8n iframes via SSO bridge).

## The brain (this is the "Generative UI")

- `POST /v1/ai/generate-ui` → `internal/ai/generate_ui.go:GenerateUIHandler`. Gemini reads a live ERP
  snapshot + prompt and returns **exactly one `UiDescriptor` JSON** (single-shot, not multi-step).
- Component types (do not invent new ones): `metrics | chart | table | card | action | flow | navigate | open_doc | rag | text`.
- Writes → component `action` with `actionType`+`actionParams`; the **frontend confirms**, then calls
  `POST /v1/ai/tool/execute` (`ToolExecuteHandler`) which **rejects writes without `confirm:true`**.
- Frontend wiring: `generative-ui/src/hooks/useGenerativeChat.js` → `services/serverBrain.js`
  → renderers `components/Generative{Chart,Table,Card,Metrics}.jsx` + `chat/GenerativeMessageRenderer.jsx`.

## The tool catalog (the real spine)

`internal/ai/tools.go` — **one Go registry of 21 tools** (`Catalog`), shared by voice/web/mobile so all
surfaces share one audit trail. Each `ToolSpec` has `Kind` (`read`/`write`) and `Route`:
`routeFrappe` (a `small_erp.api.*` method) · `routeKB` (Vertex RAG) · `routeN8N` (webhook) ·
`routeLocal` (synthesized) · `routeUnsupported`. `mapArgs()` adapts canonical arg names to each
`small_erp` endpoint's exact params. See `muslimbot_add_agent_tool` to add one.

## Known gaps vs. the blueprint (see docs/MUSLIMBOT_MASTER_IMPLEMENTATION.md)

- No generic Frappe-doctype bridge yet (Helpdesk/CMS/HRMS) — `routeFrappe` only calls curated
  `small_erp.api.*` methods, not raw `/api/resource/<Doctype>`. → `muslimbot_frappe_bridge`.
- No MCP-client layer in the orchestrator (blueprint's "Go = Nextcloud/browser MCP gateway"). Tracked as
  WS-2/3 in `docs/MUSLIMBOT_OSS_EXPANSION_PLAN.md`.
- `generative-ui/src/app/api/chat/route.ts` is a **dead mock** from the blueprint phase — remove/repoint.
- Multi-step ("fetch policy → fetch ticket → render") is **not** implemented; the brain is single-shot.

## Hard rules (from CLAUDE.md / AGENTS.md)

- Don't modify front-end (`www/`, `public/js|css/`, `generative-ui/`, `erp-flutter/`) unless told to.
- Business logic → `small_erp_app/small_erp/services/`, not whitelisted routes.
- Never read `.env`/secret files. Infra actions (terraform apply, DNS, live PSTN) are the **user's** to run.
