# Scripts

Operational scripts for MuslimBot. The **single entrypoint** is the root orchestrator
[`../setup.sh`](../setup.sh), which chains most of these into one phased process — prefer it over
running scripts individually. See [`../docs/production/MASTER_IMPLEMENTATION_PLAN.md`](../docs/production/MASTER_IMPLEMENTATION_PLAN.md).

```bash
../setup.sh preflight | provision | deploy | stack | init | seed | verify | tenant <sub> "<Co>"
```

---

## Orchestration
| Script | Purpose |
|---|---|
| [`../setup.sh`](../setup.sh) | **Root orchestrator** — preflight → provision (Terraform) → deploy → stack → init → seed → verify; multi-tenant; backup/restore. Context-aware (workstation vs VM). Billable/destructive phases confirm unless `MUSLIMBOT_YES=1`. |

## Provisioning & infrastructure (workstation → VM)
| Script | Purpose |
|---|---|
| [`../terraform/single-host/deploy-on-vm.sh`](../terraform/single-host/deploy-on-vm.sh) | Runs **on the VM**: clone repo, root Docker on the SSD, generate the env-file, build, and bring up the merged stack. Invoked by `setup.sh deploy`. |
| [`gcp-vm.sh`](gcp-vm.sh) | GCP VM lifecycle helper (create/start/stop/ssh). |
| [`gcp-budget-setup.sh`](gcp-budget-setup.sh) | Configure a GCP billing budget + alerts. |

## App install & deploy (Frappe / ERPNext / small_erp)
| Script | Purpose |
|---|---|
| [`../small_erp/scripts/deploy.sh`](../small_erp/scripts/deploy.sh) | Production app init: create site, install ERPNext + `small_erp`, build assets, wire n8n, backup cron. (`setup.sh init`) |
| [`../small_erp/scripts/install-local.sh`](../small_erp/scripts/install-local.sh) | First-time **local dev** setup (volume-mounted). |
| [`../small_erp/scripts/install-demo.sh`](../small_erp/scripts/install-demo.sh) | First-time **demo/VM** setup (baked image). |
| [`../small_erp/scripts/install.sh`](../small_erp/scripts/install.sh) | Backward-compat wrapper → `install-local.sh`. |

## Data, backup & DR
| Script | Purpose |
|---|---|
| [`../small_erp/scripts/backup.sh`](../small_erp/scripts/backup.sh) | Back up MariaDB + Frappe files + n8n (extend for platform-pg/chatwoot/trypost). (`setup.sh backup`) |
| [`../small_erp/scripts/restore.sh`](../small_erp/scripts/restore.sh) | Restore a backup set (destructive; `setup.sh restore <ts>`). See [`../docs/production/BACKUP_RESTORE_DR.md`](../docs/production/BACKUP_RESTORE_DR.md). |
| [`configure-postgres-multidb.sh`](configure-postgres-multidb.sh) | Idempotent multi-DB setup on the shared Postgres volume. |

## Multi-tenant
| Script | Purpose |
|---|---|
| [`provision-tenant.sh`](provision-tenant.sh) | Onboard a business: Cloudflare DNS + `bench new-site` (isolated DB) + install apps + onboard API. `provision-tenant.sh <subdomain> "<Company>" [admin_pass]` (`setup.sh tenant`). |

## MCP servers (agent tool runtimes)
| Script | Purpose |
|---|---|
| [`mcp/run-chatwoot-mcp.sh`](mcp/run-chatwoot-mcp.sh) | Launch **fazer-ai/mcp-chatwoot** (stdio, 129 Chatwoot tools). See [`../mcp-servers/chatwoot-mcp/README.md`](../mcp-servers/chatwoot-mcp/README.md). |
| [`mcp/run-postgres-mcp.sh`](mcp/run-postgres-mcp.sh) | Postgres MCP for dev DB agents. |

## QA & dev helpers
| Script | Purpose |
|---|---|
| [`run-qa.sh`](run-qa.sh) | Smoke: install, seed, generate API keys against a local stack. |
| [`start_orchestrator.sh`](start_orchestrator.sh) | Run `go-orchestrator` locally (dev). |

## Optional: cloud-offload (Neon/Upstash) & SaaS
> Not part of the default single-host deploy — kept as an optional track.

| Script | Purpose |
|---|---|
| [`install-mvt-cloud-clis.sh`](install-mvt-cloud-clis.sh) | Install `neonctl` + `@upstash/cli`. |
| [`mvt-neon-setup.sh`](mvt-neon-setup.sh) | Provision a Neon Postgres branch. |
| [`mcp/run-neon-mcp.sh`](mcp/run-neon-mcp.sh) · [`mcp/run-upstash-mcp.sh`](mcp/run-upstash-mcp.sh) | Neon / Upstash MCP launchers. |
| [`setup.sh`](setup.sh) | Legacy SaaS first-time setup (superseded by the root `../setup.sh` for single-host). |
