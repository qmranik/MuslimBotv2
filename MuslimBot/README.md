# MuslimBot

AI-agentic business OS for SMBs — a "single pane of glass" over ERPNext + every sub-system, driven by
an AI agent. Built on ERPNext v15 + `small_erp`, a Go orchestrator (`/v1/*`), generative-ui, voice + KB,
Chatwoot support, and TryPost social — unified behind Traefik + Authentik SSO on a single-host stack.

## Components

| Component | Description |
|-----------|-------------|
| **ERPNext v15 + small_erp** | System of record (Frappe backend, `/ops`) |
| **go-orchestrator** | Unified `/v1/*` BFF + AI brain + MCP host (behind Traefik/Authentik) |
| **generative-ui** | Next.js single control plane (agent chat, embedded portals) |
| **Authentik + Traefik** | SSO (OIDC + ForwardAuth) + edge routing |
| **n8n** | AI workflows, webhooks, RAG orchestration |
| **voice worker** | LiveKit + Gemini Live worker (tools via Go `/v1/agent/*`) |
| **Chatwoot** | Omnichannel support (agent-driven via `mcp-chatwoot`, 129 tools) |
| **TryPost** | Social scheduling (MCP-native; agent automates via TryPost MCP) |

Compose reference: **[../COMPOSE.md](../COMPOSE.md)**

---

## 📚 Documentation

Full docs index: **[docs/README.md](docs/README.md)**. Highlights:

- [System overview](docs/architecture/SYSTEM_OVERVIEW.md) · [Orchestrator spec](docs/architecture/PLATFORM_ORCHESTRATOR_SPEC.md)
- [Master implementation plan](docs/production/MASTER_IMPLEMENTATION_PLAN.md) · [Runbook](docs/production/RUNBOOK.md) · [Unified experience plan](docs/production/UNIFIED_EXPERIENCE_PLAN.md)
- [Production readiness / gap register](docs/production/PRODUCTION_READINESS_PLAN.md) · [ADR-0001 (TryPost + Chatwoot MCP)](docs/architecture/ADR-0001-social-trypost-and-chatwoot-mcp.md)
- Scripts catalog: **[scripts/README.md](scripts/README.md)** · one-command setup: **[`setup.sh`](setup.sh)**

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
| http://localhost:8000/app | ERPNext Desk |
| http://localhost:3000 | Generative UI (canonical Next.js) |
| http://localhost:5678 | n8n |
| http://localhost:8080/v1/sys/health | Go orchestrator |

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

See [wayToDemo.md](docs/business/wayToDemo.md) for full VM prep, prerequisites, and demo script.

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
   /app (Desk)      generative-ui        Chatwoot / Postiz
        |                  |                  |
        v                  v                  v
   [ frappe-web :8000 ]  /v1 → Go :8080    webhooks
        |                  |  KB / voice / ERP
        +--------+---------+---------+
                 |                   |
            [ MariaDB ]         [ n8n :5678 ]
            [ Redis x3 ]              |
                 |              [ LiveKit + Muslimbot voice worker ]
            [ Workers ]
```



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

LiveKit-only Gemini voice worker. Knowledge Hub APIs and voice-session minting
are owned by the Go orchestrator (`POST /v1/kb/voice/session`). The worker joins
dispatched rooms and calls `/v1/agent/*` with a signed workload JWT.

```bash
# Local or demo — after core stack + Go orchestrator are up:
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
├── generative-ui/                  # React chat-to-dashboard (canonical at repo root)
├── go-orchestrator/                # Go BFF: KB, voice session, agent tools, ERP proxy
├── Muslimbot-voice-agent/          # LiveKit-only voice worker
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
| `FRAPPE_API_KEY` / `FRAPPE_API_SECRET` | API token (post-setup) for Go → Frappe |
| `FRAPPE_SITE_HOST` | Frappe Host header (`small.localhost:8000`) |
| `ORCHESTRATOR_SERVICE_API_KEY` | Trusted internal service auth for Go |
| `WORKLOAD_JWT_SECRET` | Signs LiveKit worker JWTs |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Same Google AI Studio key |
| `LIVEKIT_*` / `LIVEKIT_PUBLIC_URL` | Voice profile + browser WSS URL |
| `POSTGRES_SHARED_PASSWORD` | Demo: Chatwoot + Postiz + Temporal |

Full list: [`.env.template`](.env.template)

---

## MCP Servers (optional)

AI-assisted development via Claude Code. Configured in `mcp-servers/config/mcp-settings.json` when that directory is present in your checkout.

---

## License

MIT
