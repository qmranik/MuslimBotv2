# LiteERP Silo Testing Framework (4GB RAM)

This directory contains standalone `docker-compose` files to test specific components (silos) of the LiteERP system independently. This strategy prevents memory exhaustion on low-RAM machines (e.g. 4GB Mac M1) by spinning up only the services required for a specific testing flow.

**8GB M1 / OrbStack:** use [docs/MVT_8GB_M1.md](../docs/MVT_8GB_M1.md), compose `docker-compose.mvt-a.yml` / `docker-compose.mvt-b.yml`, and skills `mvt-cloud-offload` / `mvt-silo-verify`.

### MVT A/B (8GB)

| Compose | Runbook | Goal |
|---------|---------|------|
| `docker-compose.mvt-a.yml` (+ optional `mvt-a.cloud.override.yml`) | [mvt-a_erp_genui.md](mvt-a_erp_genui.md) | ERP + GenUI + Go `ENV=local` |
| `docker-compose.mvt-b.yml` (+ optional `mvt-b.cloud.override.yml`) | [mvt-b_chatwoot_n8n.md](mvt-b_chatwoot_n8n.md) | Chatwoot + n8n (ERP mocked) |

Cloud DB setup: [docs/MVT_CLOUD_OFFLOAD.md](../docs/MVT_CLOUD_OFFLOAD.md).

## How to Use Silo Testing

Before running numbered silos 1–5 on Docker Desktop, cap the VM at **2GB RAM and 1.5GB Swap.** On OrbStack + 8GB, prefer the MVT A/B path instead.

**Important**: Make sure you bring down any currently running containers before switching silos:
```bash
docker compose down
```

### Silo 1: Authentication & Go Orchestrator (`docker-compose.silo1.yml`)
Tests SSO, API Gateway routing, and the Generative UI Command Center interface.
- **Run**: `docker compose -f docker-compose.silo1.yml up -d`
- **Native Services to start**: Go Orchestrator, Generative UI

### Silo 2: Core ERP & HTMX (`docker-compose.silo2.yml`)
Tests standard ERP workflows (POS, Inventory, Accounting) and HTMX interfaces in small_erp.
- **Run**: `docker compose -f docker-compose.silo2.yml up -d`
- **Native Services to start**: None required (navigate to `/ops`)

### Silo 3: Knowledge Hub & RAG (`docker-compose.silo3.yml`)
Tests MuslimBot Knowledge Base ingest and RAG chat.
- **Run**: `docker compose -f docker-compose.silo3.yml up -d`
- **Native Services to start**: Generative UI

### Silo 4: Automation / n8n (`docker-compose.silo4.yml`)
Tests webhooks and AI workflow integrations with n8n.
- **Run**: `docker compose -f docker-compose.silo4.yml up -d`
- **Native Services to start**: None required

### Silo 5: Voice Assistant (`docker-compose.silo5.yml`)
Tests LiveKit WebRTC connection and voice tool dispatch.
- **Run**: `docker compose -f docker-compose.silo5.yml up -d`
- **Native Services to start**: Generative UI

---

## 🔑 Saved Credentials

Save your local development API keys and credentials below for quick reference when configuring native services or .env files. Do not commit real production secrets here.

### API Keys
| Service | Variable Name | Value |
|---------|---------------|-------|
| Frappe | `FRAPPE_API_KEY` | _<insert-your-key-here>_ |
| Frappe | `FRAPPE_API_SECRET` | _<insert-your-secret-here>_ |
| KB BFF | `KB_BFF_API_KEY` | `change-me-in-production` |
| LiveKit | `LIVEKIT_API_KEY` | _<insert-your-key-here>_ |
| LiveKit | `LIVEKIT_API_SECRET`| _<insert-your-secret-here>_ |

### Service Passwords
| Service | Variable Name | Value |
|---------|---------------|-------|
| MariaDB | `DB_ROOT_PASSWORD`| _<insert-your-db-pass>_ |
| n8n | `N8N_USER` | _<insert-your-user>_ |
| n8n | `N8N_PASSWORD` | _<insert-your-pass>_ |
| n8n | `N8N_ENCRYPTION_KEY`| _<insert-your-key>_ |

---

## 🧪 Comprehensive MVP QA Testing

The complete system testing process is divided into isolated runbooks corresponding to each silo. This allows you to rigorously test all capabilities (Health Checks, Orchestrator APIs, Generative UI, Knowledge Hub, Embedded Workspaces) without running all containers simultaneously.

For full testing procedures, refer to the following guides:
- [Silo 1: Orchestrator & GenUI Test](file:///Users/qmranik/development/DOS/liteERP/test-silos/silo1_orchestrator_test.md)
- [Silo 2: Core ERP Test](file:///Users/qmranik/development/DOS/liteERP/test-silos/silo2_erp_test.md)
- [Silo 3: Knowledge Hub Test](file:///Users/qmranik/development/DOS/liteERP/test-silos/silo3_knowledge_hub_test.md)
- [Silo 4: Automation Test](file:///Users/qmranik/development/DOS/liteERP/test-silos/silo4_automation_test.md)
- [Silo 5: Voice Test](file:///Users/qmranik/development/DOS/liteERP/test-silos/silo5_voice_test.md)

### Audit Screenshots Automation
The `@/audit-screenshots` directory contains Playwright node scripts (e.g., `01-login-flow.js`, `02-genui-management.js`) that automate flows and capture screenshots. Each silo guide indicates when to execute these scripts.
