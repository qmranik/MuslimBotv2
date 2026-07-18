# MuslimBot — Documentation

Documentation for the **MuslimBot** AI-agentic business OS (ERPNext + `small_erp` · Go orchestrator ·
generative-ui · voice/KB · Chatwoot · TryPost · n8n), deployed as a single-host Docker Compose stack.

> **New here?** Read [architecture/SYSTEM_OVERVIEW.md](architecture/SYSTEM_OVERVIEW.md), then to run it
> follow [production/RUNBOOK.md](production/RUNBOOK.md). To operate the whole setup use
> [`../setup.sh`](../setup.sh) (see [`../scripts/README.md`](../scripts/README.md)).

---

## 🧭 Start here

| Doc | What it is |
|---|---|
| [architecture/SYSTEM_OVERVIEW.md](architecture/SYSTEM_OVERVIEW.md) | What MuslimBot is — the "single pane of glass" vision + component map |
| [production/MASTER_IMPLEMENTATION_PLAN.md](production/MASTER_IMPLEMENTATION_PLAN.md) | The ordered runbook: current state → unified GCP VM → multi-business |
| [production/RUNBOOK.md](production/RUNBOOK.md) | Post-VM environment setup, step by step (configs, systems, wiring) |
| [production/UNIFIED_EXPERIENCE_PLAN.md](production/UNIFIED_EXPERIENCE_PLAN.md) | Silos → one unified experience (SSO, GenUI brain, agent+MCP) |

## 🏗 Architecture

| Doc | What it is |
|---|---|
| [architecture/SYSTEM_OVERVIEW.md](architecture/SYSTEM_OVERVIEW.md) | System overview & vision |
| [architecture/PLATFORM_ORCHESTRATOR_SPEC.md](architecture/PLATFORM_ORCHESTRATOR_SPEC.md) | `go-orchestrator` (`/v1/*`) design spec |
| [architecture/UNIFIED_SYSTEM_PLAN.md](architecture/UNIFIED_SYSTEM_PLAN.md) | Unified system master plan (BFF, multi-tenancy, integrations) |
| [architecture/GENUI_UNIFIED_IMPLEMENTATION_PLAN.md](architecture/GENUI_UNIFIED_IMPLEMENTATION_PLAN.md) | generative-ui as the single control plane — impl plan |
| [architecture/ADR-0001-social-trypost-and-chatwoot-mcp.md](architecture/ADR-0001-social-trypost-and-chatwoot-mcp.md) | ADR: social = TryPost (MCP) · Chatwoot MCP layer |
| [architecture/voice/](architecture/voice/) | Voice agent: [implementation & testing](architecture/voice/VOICE_IMPLEMENTATION_AND_TESTING_PLAN.md) · [production plan](architecture/voice/PRODUCTION_VOICE_AGENT_PLAN.md) · [SIP checklist](architecture/voice/VOICE_SIP_CHECKLIST.md) |

## 🚀 Production & Deployment

| Doc | What it is |
|---|---|
| [production/PRODUCTION_READINESS_PLAN.md](production/PRODUCTION_READINESS_PLAN.md) | **Canonical gap register** (G/P items) + phased plan |
| [production/MASTER_IMPLEMENTATION_PLAN.md](production/MASTER_IMPLEMENTATION_PLAN.md) | Current state → unified GCP VM (ordered, gated) |
| [production/MUSLIMBOT_PRODUCTION_PLAN.md](production/MUSLIMBOT_PRODUCTION_PLAN.md) | Production alignment plan for the whole product |
| [production/BLUEPRINT_V2_IMPLEMENTATION_PLAN.md](production/BLUEPRINT_V2_IMPLEMENTATION_PLAN.md) | Blueprint v2 reconciliation → impl (capability→gap map) |
| [production/VM_DEPLOYMENT_PLAN.md](production/VM_DEPLOYMENT_PLAN.md) | Single-VM deployment mechanics |
| [production/GCP_DEPLOYMENT_ROADMAP.md](production/GCP_DEPLOYMENT_ROADMAP.md) | GCP deployment strategy & phasing |
| [production/RUNBOOK.md](production/RUNBOOK.md) | Post-VM environment setup runbook |
| [production/UNIFIED_EXPERIENCE_PLAN.md](production/UNIFIED_EXPERIENCE_PLAN.md) | Silos → unified business solution |
| [production/DEPLOYMENT_LOG.md](production/DEPLOYMENT_LOG.md) | As-deployed record (live host, fixes, current state) |
| [production/BACKUP_RESTORE_DR.md](production/BACKUP_RESTORE_DR.md) | Backup / restore / disaster recovery |
| [../terraform/single-host/AS_BUILT.md](../terraform/single-host/AS_BUILT.md) | Infra as-built (Terraform single-host) |

## 🧪 Testing

| Doc | What it is |
|---|---|
| [testing/TEST_PLAN_GENUI_ORCHESTRATOR.md](testing/TEST_PLAN_GENUI_ORCHESTRATOR.md) | generative-ui ↔ go-orchestrator (incl. MCP) test plan + agent prompt |
| [testing/UI_UX_TEST_PLAN.md](testing/UI_UX_TEST_PLAN.md) | Full-system UI/UX test plan |

## 🔄 Workflows & 💼 Business

| Doc | What it is |
|---|---|
| [workflows/User_Stories.md](workflows/User_Stories.md) · [workflows/Workflows.md](workflows/Workflows.md) | Product user stories & workflow definitions |
| [business/CONTEXT_MARKETING.md](business/CONTEXT_MARKETING.md) | Marketing/context narrative |
| [business/](business/) | [deployment](business/deployment.md) · [landing](business/landing.md) · [wayToDemo](business/wayToDemo.md) · [FULL](business/FULL.md) · pitch-deck/ |

---

## Related references (outside `docs/`)

- [`../README.md`](../README.md) — project overview & quick start
- [`../CLAUDE.md`](../CLAUDE.md) — repo guide for AI tooling
- [`../scripts/README.md`](../scripts/README.md) — scripts catalog
- [`../COMPOSE.md`](../COMPOSE.md) — Compose files, ports, profiles
- [`../terraform/README.md`](../terraform/README.md) — infrastructure modules
- MCP servers: [`../mcp-servers/`](../mcp-servers/) (trypost-mcp, chatwoot-mcp, bench-mcp, frappe-docs-mcp)
