# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Repository Overview

**Small ERP (liteERP)** — An AI-driven ERP system for small organizations (pharma, tech retail). The primary application is a standalone HTMX frontend on top of ERPNext that SMB users interact with exclusively at `/ops`. They never see the ERPNext desk.

### Directory Structure

```
liteERP/                          ← Repository root
├── CLAUDE.md                     ← This file (canonical reference)
├── COMPOSE.md                    ← Canonical Docker Compose reference
├── Dockerfile                    ← Builds the production image (bakes small_erp into ERPNext)
├── docker-compose.yml            ← Demo VM (baked image + Postiz + Chatwoot + generative-ui)
├── docker-compose.local.yml      ← Local dev (volume-mounted app + Vite generative-ui)
├── docker-compose.mvp.yml        ← Legacy minimal MVP
├── .env.template                 ← Environment template (all modes)
├── scripts/
│   ├── setup.sh                  ← SaaS first-time setup (Traefik; saas compose not in tree)
│   └── provision-tenant.sh       ← Multi-tenant: provision a new tenant site
├── configs/                      ← Shared config (mariadb, n8n, postgres init)
├── generative-ui/                ← React chat-to-dashboard (Vite dev / nginx demo)
│
├── small_erp/                    ← PRIMARY PROJECT — where daily development happens
│   ├── scripts/
│   │   ├── install-local.sh      ← Local first-time setup
│   │   ├── install-demo.sh       ← Demo VM first-time setup
│   │   ├── deploy.sh             ← Production deployment + hardening
│   │   └── backup.sh             ← Automated backup (MariaDB, Frappe files, n8n, S3)
│   ├── finish_setup.py           ← Bypasses ERPNext setup wizard
│   ├── seed_demo.py              ← Seeds demo company, items, customers, invoices
│   ├── small_erp_app/            ← Frappe app package root
│   │   ├── setup.py
│   │   └── small_erp/            ← Frappe app module (hooks.py, api/, www/, etc.)
│   │       ├── hooks.py
│   │       ├── api/              ← Backend API (one file per domain)
│   │       ├── www/ops/          ← HTMX frontend pages (9 routes)
│   │       ├── templates/
│   │       ├── public/
│   │       └── utils/
│   └── configs/                  ← MariaDB + n8n workflow configs
│
├── Muslimbot-voice-agent/        ← LiveKit-only Gemini voice worker
│   ├── agent.py                  ← Voice tools via Go /v1/agent/*
│   ├── services/                 ← Orchestrator client, memory, tool helpers
│   ├── Dockerfile
│   └── docker-compose.yml        ← Standalone worker (liteerp_smb-net)
├── go-orchestrator/              ← Unified backend orchestrator (Go/Gin, port 8080)
│                                   Owns KB, voice-session, ToolAction confirmation
├── erp-flutter/                  ← Flutter mobile client (iOS/Android) against Frappe API
├── traefik/                      ← Traefik dynamic config (Authentik ForwardAuth)
├── docs/                         ← architecture/, production/, testing/ design docs
├── test-silos/                   ← Isolated QA stacks + silo test plans (silo1–8)
├── mcp-servers/                  ← AI dev integration (may be absent from checkout)
└── seed-varient/                 ← Demo data bootstrapper (standalone)
```

**Compose files**: `docker-compose.local.yml` (dev), `docker-compose.yml` (demo VM), `docker-compose.mvp.yml` (legacy), `docker-compose.extended.yml` (platform layer: Authentik + Traefik + go-orchestrator + shared Postgres/Redis).

**Frappe double-directory convention**: `small_erp_app/` is the Python package root (`setup.py` lives here). `small_erp_app/small_erp/` is the actual Frappe module (`hooks.py`, `api/`, `www/`, etc.). This is intentional and required by Frappe.

## Working Constraints (from AGENTS.md / .cursorrules)

These are hard rules enforced across AI tooling in this repo — honor them:

- **Do not modify front-end files unless explicitly told to.** "Front-end" = `small_erp_app/small_erp/www/`, `public/js/`, `public/css/`, and the `generative-ui/` / `erp-flutter/` clients.
- **Business logic belongs in the service layer**, not in routes/whitelisted endpoints. Thin `@frappe.whitelist()` functions in `api/` should delegate to `small_erp_app/small_erp/services/` (`ai_assistant_service.py`, `ai_voice_service.py`, `gemini_service.py`, `erp_agent_tools.py`).
- **Strict typing is expected**; snake_case for Python variables and functions.
- **Never read `.env` or secret files** — they contain live credentials and are token-leak risks.

## Quick Start

> **Compose reference:** see [COMPOSE.md](COMPOSE.md) for ports, profiles, and env matrix.

### Development (volume-mounted, hot reload)

```bash
cp .env.template .env
docker compose -f docker-compose.local.yml up -d
bash small_erp/scripts/install-local.sh

# Optional: Chatwoot
docker compose -f docker-compose.local.yml --profile support up -d

# Optional: voice worker (requires LiveKit + Go orchestrator)
docker compose -f docker-compose.local.yml --profile voice up -d
```

### Demo VM (baked image)

```bash
docker build -t small-erp:latest .
docker compose up -d
bash small_erp/scripts/install-demo.sh
docker compose --profile voice up -d   # optional
```

### Common Commands

```bash
# All commands from repository root with -f docker-compose.local.yml

docker compose -f docker-compose.local.yml exec frappe-web bench build --app small_erp
docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost migrate
docker compose -f docker-compose.local.yml restart frappe-web frappe-scheduler frappe-worker-default frappe-worker-short frappe-worker-long frappe-socketio
docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost console

# Backups / deploy (from small_erp/)
bash small_erp/scripts/backup.sh
bash small_erp/scripts/deploy.sh
```

## Architecture

### Stack

| Component | Image / Tech | Purpose |
|-----------|-------------|---------|
| frappe-web | ERPNext v15 + small_erp | Application server, serves `/ops` frontend |
| mariadb | MariaDB 10.11 | Database |
| redis-cache | Redis 7 Alpine | Frappe cache |
| redis-queue | Redis 7 Alpine | Background job queue |
| redis-socketio | Redis 7 Alpine | Realtime events |
| frappe-worker-* | Same as frappe-web | Background job processing (default, short, long) |
| frappe-scheduler | Same as frappe-web | Cron-like scheduled tasks |
| frappe-socketio | Same as frappe-web | Socket.IO realtime server |
| n8n | n8nio/n8n:1.64.3 | AI workflow automation, webhooks (`http://n8n:5678`) |
| generative-ui | Next.js (canonical) | Chat-to-dashboard; calls Go `/v1/*` |
| go-orchestrator | Go/Gin | KB ingestion/RAG, voice session, agent tools (:8080) |
| muslimbot-voice-worker | LiveKit + Gemini | Voice ERP assistant (`--profile voice`) |
| chatwoot | Chatwoot | Omnichannel support (demo always on; local `--profile support`) |
| postiz | Postiz + Temporal | Social scheduling (demo compose only) |
| postgres-shared | pgvector/pg16 | Chatwoot + Postiz + Temporal (demo only) |

### Request Flow

```
Browser → /ops/<page>
  → Frappe web server (bench serve :8000)
  → Jinja template from small_erp/www/ops/<page>/index.html
  → Extends templates/includes/base.html (app shell: sidebar, topbar, drawer)
  → JavaScript calls frappeCall() → /api/method/small_erp.api.<module>.<function>
  → Python @frappe.whitelist() → queries ERPNext doctypes → returns JSON
  → JS renders response into DOM

AI queries → n8n webhooks (http://n8n:5678/webhook/...)
  → n8n fetches ERPNext data, calls LLM, returns structured response

generative-ui → /v1 → go-orchestrator:8080 (KB, voice session, ERP gateway)
voice worker → /v1/agent/* → go-orchestrator (workload JWT)
```

### Standalone Mode

Small ERP runs as a **standalone application**. SMB users are restricted to `/ops` via session hooks:

| Role | Desk Access | /ops Access | Login Redirect |
|------|------------|-------------|----------------|
| SMB Operator | Blocked | Full | `/ops` |
| SMB Manager | Blocked | Full | `/ops` |
| Administrator / System Manager | Full | Full | `/app` |

The `boot_session` hook (`utils/routing.py`) intercepts requests and redirects SMB users away from `/app`, `/desk`, and unauthorized API paths. Only `small_erp.*`, `erpnext.*`, and auth endpoints are allowed.

## Key Files

### Backend API (`small_erp_app/small_erp/api/`)

| Module | Doctypes | Purpose |
|--------|----------|---------|
| `dashboard.py` | Sales Invoice, Sales Order, Bin, Item | KPI cards, revenue chart, activity feed |
| `pos.py` | Sales Invoice (is_pos=1), Item, Bin | POS search, cart, checkout with payment |
| `orders.py` | Sales Invoice, Payment Entry, Sales Order | Create/list invoices, record payments |
| `inventory.py` | Item, Bin, Stock Entry, Warehouse | Item CRUD, stock levels, stock entries |
| `customers.py` | Customer, Sales Invoice | Customer CRUD, purchase history |
| `accounting.py` | GL Entry, Sales/Purchase Invoice, Payment Entry | P&L, receivables, payables, expenses |
| `settings.py` | User, Company | Profile/company edit, password change, system info |
| `ai_agent.py` | — | n8n AI assistant proxy, chat RAG |
| `genui.py` | — | generative-ui ERP snapshot + write APIs |
| `events.py` | — | Doc event hooks → n8n webhook notifications |
| `scheduled.py` | — | Daily summary, weekly inventory check |
| `admin.py` | — | Tenant onboarding, multi-tenant admin |
| `openwebui_tools.py` | — | Tool endpoints exposed to Open WebUI |

### Service Layer (`small_erp_app/small_erp/services/`)

Reusable business logic invoked by `api/` endpoints — keep logic here, not in whitelisted routes. `ai_assistant_service.py`, `ai_voice_service.py`, `gemini_service.py` (Gemini calls), `erp_agent_tools.py` (ERP tool implementations shared with the voice agent).

### Custom DocTypes (`small_erp_app/small_erp/doctype/`)

`ai_knowledge_source` and `ai_knowledge_chunk` back the Knowledge Hub RAG store.

### Frontend Pages (`small_erp_app/small_erp/www/ops/`)

| Route | Page | Description |
|-------|------|-------------|
| `/ops` | Dashboard | KPI cards, revenue chart, activity feed, quick actions |
| `/ops/pos` | Point of Sale | Item grid search, cart, one-tap checkout |
| `/ops/orders` | Orders | Sales invoice list, create invoice, record payment |
| `/ops/inventory` | Inventory | Item list, stock levels, create items, stock entries, low stock |
| `/ops/customers` | Customers | Customer directory, profiles, purchase history |
| `/ops/accounting` | Accounting | P&L summary, receivables/payables, expense breakdown |
| `/ops/ai` | AI Assistant | Natural language business queries |
| `/ops/settings` | Settings | Profile edit, password change, company info, system info |

Knowledge Hub (upload, URL scrape, RAG test chat, voice call) lives in **generative-ui** — not `/ops`.

### Core Infrastructure

| File | Purpose |
|------|---------|
| `hooks.py` | App registration, doc event hooks, scheduler, Jinja helpers, role redirects |
| `utils/routing.py` | Session role redirect + desk access blocking |
| `utils/formatters.py` | Jinja filters: `currency`, `short_date`, `status_badge`, `role_has` |
| `setup_permissions.py` | DocType permission seeder for SMB roles |
| `templates/includes/base.html` | App shell (sidebar, topbar, drawer, toast, mobile nav) |
| `public/js/small-erp.js` | Core JS: frappeCall(), toast, drawer, sidebar toggle, HTMX guards |
| `public/css/small-erp.css` | All component styles, responsive breakpoints |
| `www/login.html` | Branded standalone login page |
| `www/404.html` | Branded error page |

### Adding API Endpoints

1. Add a function to `small_erp_app/small_erp/api/<module>.py`
2. Decorate with `@frappe.whitelist()`
3. Guard with `frappe.has_permission("DocType", throw=True)`
4. Call from frontend: `frappeCall('small_erp.api.<module>.<function>', {args})`

### n8n Integration

n8n runs at `http://n8n:5678` (internal Docker hostname) / `http://localhost:5678` (host). The `_notify_n8n()` helper in `events.py` is fire-and-forget (2s timeout). The `ai_agent.py` functions use 30s timeout and return structured error dicts on failure.

Import workflows from `configs/n8n/`:
- **workflow-ai-assistant.json** — POST `/webhook/ai-assistant`
- **workflow-erp-events.json** — POST `/webhook/erp-event`

n8n authenticates to Frappe via `Authorization: token <FRAPPE_API_KEY>:<FRAPPE_API_SECRET>`.

## Docker Image

The `Dockerfile` at repo root builds a production image that bakes `small_erp` into the ERPNext v15 base:

```dockerfile
FROM frappe/erpnext:v15
# Copies small_erp app source → /home/frappe/frappe-bench/apps/small_erp/
# Runs pip install, registers in apps.txt, bench build
```

Build: `docker build -t small-erp:latest .` (from repo root)

The image is used by:
- Root `docker-compose.yml` (demo VM)
- `docker-compose.mvp.yml` (legacy minimal)

## Environment Variables

Primary template: `.env.template` at repo root. generative-ui local overrides: `generative-ui/.env.template`.

Critical variables:
- `DB_ROOT_PASSWORD` — MariaDB root password
- `ADMIN_PASSWORD` — ERPNext Administrator password
- `FRAPPE_API_KEY` / `FRAPPE_API_SECRET` — generated post-deploy for n8n ↔ Frappe
- `FRAPPE_SITE_HOST` — generative-ui nginx Host header (e.g. `small.localhost:8000`)
- `ORCHESTRATOR_SERVICE_API_KEY` — trusted internal service auth for Go (`X-Service-API-Key`)
- `WORKLOAD_JWT_SECRET` — signs LiveKit worker JWTs for `/v1/agent/*`
- `VITE_GEMINI_API_KEY` / `GEMINI_API_KEY` / `GOOGLE_API_KEY` — same Google AI Studio key
- `LLM_PROVIDER` / `OPENAI_API_KEY` — optional OpenAI path in n8n
- `LIVEKIT_INTERNAL_URL` / `LIVEKIT_PUBLIC_URL` — Go dispatch vs browser WSS URL

## Roles & Permissions

Two custom roles are fixtures in `hooks.py`: **SMB Manager** and **SMB Operator**. Both redirect to `/ops` on login.

Run permission setup after first install:
```bash
docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost execute small_erp.setup_permissions.run
```

This grants granular read/create/write/submit permissions for all required doctypes (Sales Invoice, Item, Customer, Stock Entry, GL Entry, etc.) without desk access.

## Sub-projects

### Muslimbot-voice-agent

LiveKit-only Gemini voice worker (`--profile voice`). It does **not** expose HTTP
KB APIs. GenUI calls Go `POST /v1/kb/voice/session`; Go dispatches named agent
`muslimbot` with a workload JWT; the worker joins the room and calls
`/v1/agent/*` for ERP reads and confirmed writes.

```bash
# Local
docker compose -f docker-compose.local.yml --profile voice up -d

# Demo
docker compose --profile voice up -d

# Standalone
cd Muslimbot-voice-agent && docker compose up -d
```

See [docs/architecture/VOICE_BFF_REMOVAL.md](docs/architecture/VOICE_BFF_REMOVAL.md).

### go-orchestrator (Platform Orchestrator)

A Go/Gin unified backend (`module muslimbot-orchestrator`, Go 1.26) that sits behind **Traefik** + **Authentik** and fronts all clients with one tenant-aware `/v1/*` API. Full design in [docs/PLATFORM_ORCHESTRATOR_SPEC.md](docs/architecture/PLATFORM_ORCHESTRATOR_SPEC.md). Runs via `docker-compose.extended.yml` (with `platform-postgres`, `platform-redis`, `authentik-server/worker`, `traefik`). Entrypoint `cmd/server/main.go`, listens on `PORT` (default `8080`).

- **Auth**: Authentik forward-auth for browsers; workload JWT for LiveKit workers; service API key for n8n.
- **Structure**: `internal/gateway/proxy.go` (read-only Frappe proxy), `internal/ai/` (KB + Gemini), `internal/actions/` (durable ToolAction confirmations), `internal/auth/workload.go`, `internal/store/` (VoiceSession/ToolAction audit).

```bash
cd go-orchestrator && go run ./cmd/server   # or via docker-compose.extended.yml
```

### erp-flutter (Mobile client)

Flutter iOS/Android app (`provider` + `http`) talking to the Frappe API. Feature-first layout under `lib/features/` (auth, dashboard, pos_checkout, inventory, customers) with shared `lib/core/` (`api/frappe_api_client.dart`, `providers/`, `routing/`, `theme/`).

```bash
cd erp-flutter && flutter pub get && flutter run
```

### test-silos

Eight isolated QA stacks (`docker-compose.silo1.yml`–`silo5.yml`) each paired with a test plan (`silo1_orchestrator_test.md` … `silo8_pharma_intelligence_test.md`) that exercise one subsystem end-to-end. See `test-silos/readme.md`. Root helper `run-qa.sh` installs, seeds, and generates API keys against the local stack.

### mcp-servers

MCP servers for AI-assisted development via Claude Code. The `mcp-servers/` directory may be absent from some checkouts; when present, configured in `mcp-servers/config/mcp-settings.json`:

- **frappe-dev-mcp** — 22 tools: bench commands, CRUD, SQL queries, file management, Docker control
- **playwright-mcp** — 5 tools: navigate, click, fill, evaluate DOM, capture screenshots for visual review
- **postgres-mcp** — State seeding
- **codebase-mcp** — Git diff codebase delta-testing analyzer
- **frappe-state-mcp** — Python bench CLI state seeding tool
- **mcp-erpnext** — Community package for ERPNext data (configured in `config/mcp-settings.json`)
- **n8n MCP** — Native n8n MCP server for workflow management

```bash
cd mcp-servers/frappe-dev-mcp && npm install
# Configured in mcp-servers/config/mcp-settings.json — load in Open WebUI or Claude Code
```

### seed-varient

Demo data bootstrapper — spins up ERPNext + Open WebUI + Ollama with realistic business data for two variants (`tech/` and `pharma/`). Standalone, not used by small_erp in production.

```bash
cd seed-varient
cp .env.template .env && docker compose up -d
cd tech/seed_erpNext && pip install -r requirements.txt
python seed.py --url http://localhost:8080 --user Administrator --password admin
```
