# Small ERP (liteERP)

AI-driven ERP for small organizations, built on ERPNext v15 with a standalone HTMX frontend at `/ops`, n8n automation, generative-ui chat-to-dashboard, Muslimbot voice + knowledge hub, and optional Chatwoot / Postiz in the demo stack.

## Components

| Component | Description |
|-----------|-------------|
| **Small ERP** (`/ops`) | HTMX UI — POS, orders, inventory, accounting, AI assistant |
| **ERPNext v15** | System of record (Frappe backend) |
| **generative-ui** | React chat-to-dashboard (Gemini NLP router) |
| **n8n** | AI workflows, webhooks, RAG orchestration |
| **Muslimbot** | LiveKit voice worker + KB BFF (port 8787) |
| **Chatwoot** | Omnichannel support (demo always on; local via `--profile support`) |
| **Postiz** | Social scheduling (demo compose only) |

Canonical compose reference: **[COMPOSE.md](COMPOSE.md)**

---

## Quick Start — Local Development

From the **repository root**:

```bash
cp .env.template .env   # edit passwords; set Google AI keys if using AI features
docker compose -f docker-compose.local.yml up -d
bash small_erp/scripts/install-local.sh
```

| URL | Service |
|-----|---------|
| http://localhost:8000/ops | Small ERP (HTMX) |
| http://localhost:5173 | Generative UI (Vite dev server) |
| http://localhost:5678 | n8n |
| http://localhost:8787/health | Muslimbot KB BFF |

Login: `Administrator` / value of `ADMIN_PASSWORD` in `.env`

Optional Chatwoot:

```bash
docker compose -f docker-compose.local.yml --profile support up -d
```

Optional voice agent (requires LiveKit + Google keys in `.env`):

```bash
docker compose -f docker-compose.local.yml --profile voice up -d
```

---

## Quick Start — Demo VM

For a GCP demo VM with baked image, Postiz, Chatwoot, and nginx-served generative-ui:

See [wayToDemo.md](wayToDemo.md) for full VM prep, prerequisites, and demo script.

```bash
cp .env.template .env
# Set POSTGRES_SHARED_PASSWORD, POSTIZ_JWT_SECRET, DEMO_PUBLIC_URL to VM IP
docker build -t small-erp:latest .
docker compose up -d
bash small_erp/scripts/install-demo.sh
docker compose --profile voice up -d   # optional
```

---

## Architecture (demo / local stack)

```
                    Browser / Customers
                           |
        +------------------+------------------+
        |                  |                  |
   /ops (HTMX)      generative-ui:5173    Chatwoot / Postiz
        |                  |                  |
        v                  v                  v
   [ frappe-web :8000 ]  /api → Frappe    webhooks
        |                  /kb-api → KB BFF:8787
        +--------+---------+---------+
                 |                   |
            [ MariaDB ]         [ n8n :5678 ]
            [ Redis x3 ]              |
                 |              [ Muslimbot voice worker ]
            [ Workers ]
```

SMB users are restricted to `/ops` (see [Standalone Mode](#standalone-mode) below). Administrators retain `/app` desk access.

---

## Standalone Mode

| Role | Desk (`/app`) | `/ops` | Login redirect |
|------|---------------|--------|----------------|
| SMB Operator | Blocked | Full | `/ops` |
| SMB Manager | Blocked | Full | `/ops` |
| Administrator / System Manager | Full | Full | `/app` |

---

## SaaS / Multi-Tenant (legacy scripts)

Multi-tenant Traefik deployment is **not** in the current compose tree (`docker-compose.saas.yml` is missing). Scripts remain for future restoration:

```bash
cp .env.template .env
# Fill DOMAIN, CF_DNS_API_TOKEN, passwords
docker build -t small-erp:latest .
bash scripts/setup.sh
bash scripts/provision-tenant.sh acme "Acme Corp" SecurePassword123
```

---

## Muslimbot Voice Agent

Real-time voice assistant with 21 ERP tools. KB BFF serves the Knowledge Hub API on port **8787**; generative-ui proxies `/kb-api` to it and provides in-browser **Call Muslimbot** via LiveKit WebRTC.

```bash
# Local or demo — after core stack is up:
docker compose -f docker-compose.local.yml --profile voice up -d
# or: docker compose --profile voice up -d   (demo)

# Standalone (same Docker network as ERP):
cd Muslimbot-voice-agent && docker compose up -d
```

See [Muslimbot-voice-agent/README.md](Muslimbot-voice-agent/README.md).

---

## Project Structure

```
liteERP/
├── Dockerfile
├── docker-compose.yml              # Demo VM
├── docker-compose.local.yml        # Local dev
├── docker-compose.mvp.yml          # Legacy minimal
├── COMPOSE.md                      # Canonical compose reference
├── .env.template
├── scripts/
│   ├── setup.sh                    # SaaS first-time setup
│   └── provision-tenant.sh       # Multi-tenant provisioning
├── small_erp/
│   ├── small_erp_app/small_erp/    # Frappe app (api/, www/ops/, …)
│   └── scripts/
│       ├── install-local.sh
│       └── install-demo.sh
├── generative-ui/                  # React chat-to-dashboard
├── go-orchestrator/                # Go-based Orchestration API Gateway & Identity Provider
├── Muslimbot-voice-agent/          # Voice worker + KB BFF
├── configs/                        # MariaDB, n8n, Postgres init
├── docs/
│   └── PLATFORM_ORCHESTRATOR_SPEC.md # Unified Backend Orchestrator specifications
└── seed-varient/                   # Standalone demo bootstrapper
```

---

## Configuration

| Variable | Description |
|----------|-------------|
| `DB_ROOT_PASSWORD` | MariaDB root password |
| `ADMIN_PASSWORD` | ERPNext Administrator password |
| `FRAPPE_API_KEY` / `FRAPPE_API_SECRET` | API token (post-setup) |
| `FRAPPE_SITE_HOST` | generative-ui nginx Host header (`small.localhost:8000`) |
| `KB_BFF_API_KEY` | KB BFF + generative-ui proxy auth |
| `VITE_GEMINI_API_KEY` / `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Same Google AI Studio key |
| `LIVEKIT_*` | Voice profile only |
| `POSTGRES_SHARED_PASSWORD` | Demo: Chatwoot + Postiz + Temporal |

Full list: [`.env.template`](.env.template)

---

## MCP Servers (optional)

AI-assisted development via Claude Code. Configured in `mcp-servers/config/mcp-settings.json` when that directory is present in your checkout.

---

## License

MIT
