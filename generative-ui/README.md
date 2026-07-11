# Generative UI

Chat-to-dashboard React app for Small ERP. Users describe what they want in natural language; Gemini routes the intent and the app renders live charts and tables from real ERP data.

Two top-level views:

| View | Purpose |
|------|---------|
| **Command Center** | ERP chat-to-dashboard (Frappe `/api`) |
| **Knowledge Hub** | KB upload/URL ingest, RAG test chat, **Call Muslimbot** voice |

## Stack

- **React + Vite** — dev server with HMR
- **nginx** — production/demo image (baked bundle + runtime API proxy)
- **Gemini** — browser-side NLP router (`VITE_GEMINI_API_KEY`)
- **Frappe API** — ERP data via `small_erp.api.genui` and related endpoints
- **KB BFF** — Knowledge Hub via Muslimbot `muslimbot-kb-bff:8787`
- **livekit-client** — in-browser WebRTC voice calls (`VITE_LIVEKIT_URL`)

## Proxy behavior

| Path | Target (dev) | Target (demo nginx) |
|------|--------------|---------------------|
| `/api/*` | `FRAPPE_URL` (localhost:8000) | `frappe-web:8000` with `Host: FRAPPE_SITE_HOST` |
| `/kb-api/*` | `KB_BFF_URL` (localhost:8787) | `muslimbot-kb-bff:8787` |

Dev proxy: [`vite.config.js`](vite.config.js). Demo proxy: [`nginx.conf`](nginx.conf).

## Local development

### Option A — Docker (with full stack)

From repo root (KB BFF must be running):

```bash
docker compose -f docker-compose.local.yml up -d
bash small_erp/scripts/install-local.sh
```

Open http://localhost:5173 → toggle **Knowledge** for Knowledge Hub.

### Option B — Host Vite

```bash
cp .env.template .env
# Set FRAPPE_API_KEY/SECRET, VITE_GEMINI_API_KEY, KB_BFF_API_KEY, VITE_LIVEKIT_URL
npm install
npm run dev
```

Ensure Frappe is on :8000 and KB BFF on :8787 (`docker compose -f docker-compose.local.yml up -d muslimbot-kb-bff`).

## Demo / production image

Built by root `docker-compose.yml`. Rebuild after changing build-time vars:

```bash
docker compose build generative-ui
docker compose up -d generative-ui
```

Build args (from root `.env`):

- `VITE_GEMINI_API_KEY` — browser Gemini router
- `VITE_LIVEKIT_URL` — from `LIVEKIT_URL` for voice calls

Runtime env (nginx): `FRAPPE_SITE_HOST`, `FRAPPE_API_KEY`, `FRAPPE_API_SECRET`, `KB_BFF_API_KEY`.

## Knowledge Hub features

- **Upload** — PDF, Excel, MD, TXT
- **Add URL** — websites (trafilatura scrape), YouTube transcripts, social/oEmbed
- **Bulk** — paste markdown or JSON pages
- **Test Knowledge Chat** — `POST /kb-api/chat`
- **Call Muslimbot** — `POST /kb-api/voice/session` → LiveKit WebRTC

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `FRAPPE_URL` | `.env` (Vite only) | Frappe base URL for dev proxy |
| `FRAPPE_SITE_HOST` | root `.env` / nginx | Host header for Frappe (e.g. `small.localhost:8000`) |
| `FRAPPE_API_KEY` / `FRAPPE_API_SECRET` | root `.env` | Server-side Frappe auth in proxy |
| `VITE_GEMINI_API_KEY` | root + `generative-ui/.env` | Browser Gemini router |
| `VITE_LIVEKIT_URL` | root / `generative-ui/.env` | LiveKit WebSocket URL for voice panel |
| `KB_BFF_URL` | `generative-ui/.env` | Dev proxy target for KB API |
| `KB_BFF_API_KEY` | root `.env` | Auth header for `/kb-api` proxy |

Copy [`generative-ui/.env.template`](.env.template) → `.env` for local Vite. Root [`.env.template`](../.env.template) has the shared keys (use the same Google AI Studio key for `VITE_GEMINI_API_KEY`, `GEMINI_API_KEY`, and `GOOGLE_API_KEY`).

## Related docs

- [wayToDemo.md](../wayToDemo.md) — **VM prep, prerequisites, full demo script**
- [COMPOSE.md](../COMPOSE.md) — ports, profiles, compose modes
- [Muslimbot-voice-agent/README.md](../Muslimbot-voice-agent/README.md) — KB BFF + voice worker
- [docs/PLATFORM_ORCHESTRATOR_SPEC.md](../docs/PLATFORM_ORCHESTRATOR_SPEC.md) — Unified Backend Orchestrator specifications

---

## Unified Backend Orchestrator (Go)

The `go-orchestrator` acts as the central API Gateway, Identity Provider (SSO), and State Manager. It is designed to be the primary backend system supporting the generative-ui frontend project.

### Frontend Integration with Go Orchestrator

To use the Orchestrator with the Generative UI:
1. **Remove Client-Side Keys:** Remove `GEMINI_API_KEY` and direct Frappe/KB API keys from the frontend configuration.
2. **Update API Routes:** Point frontend requests to the orchestrator:
   - ERPNext calls: `/v1/erp/*` (proxied securely)
   - Knowledge Hub calls: `/v1/kb/*`
   - AI Chat: `POST /v1/ai/chat`
   - Embedded Portals: `GET /v1/portals/:app/url`
   - Tenants Lifecycle: `POST /v1/tenants`, `POST /v1/tenants/:id/onboard`
   - Event Outbox Ingestion: `POST /v1/events/ingest`
3. **Authentication:** Use `POST /v1/auth/login` to authenticate. Other options include `POST /v1/auth/logout` and `POST /v1/auth/exchange/frappe`.

*For more details on the architecture, see the Orchestrator Specifications in the root `docs/` folder.*
