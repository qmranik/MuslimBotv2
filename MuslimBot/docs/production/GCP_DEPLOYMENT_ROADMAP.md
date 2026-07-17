# MuslimBot — GCP Deployment & Configuration Roadmap

**Goal:** take MuslimBot from its current state to a **production-grade, single-host deployment on
GCP** that can serve real digital businesses (multi-tenant SMB OS), configured properly for
identity, data safety, and agentic automation (ERPNext + GenUI + orchestrator + TryPost/Chatwoot MCP).

**Ceiling (do not violate / do not oversell):** single-VM Docker Compose. **No HA / multi-region**
is claimed — see `PRODUCTION_READINESS_PLAN.md` §8. HA is a separate, host-budget decision.

---

## 0. Current state (as of this branch)

- Monorepo consolidated under `MuslimBot/` (restructure Phase 1 done; Phase 2 pending — CI repoint).
- App tier solid: Go orchestrator (`/v1/*`) builds clean; GenUI shell; ERPNext + `small_erp`; KB BFF; voice.
- **New:** social = **TryPost** (MCP-native) with a deployable Compose stack; **MCP host** in the
  orchestrator ingesting TryPost (HTTP) + fazer-ai/mcp-chatwoot (stdio); GenUI relabeled to TryPost.
- **Gaps blocking a production claim** (from the gap register): no backups (P1), prod compose lacks the
  edge/identity tier (G3), default secrets (G6), CI breaks on the move (P2), no TLS/ACME (P4),
  Secret Manager not wired (P5), tenant fallback not fail-closed (G10).

## 1. Target GCP architecture (single VM)

```
                       Cloud DNS  (smb.<domain>, *.smb.<domain>)
                            │
                    ┌───────▼─────────────────────────────────────────┐
                    │  GCE VM  (e2-standard-8 / 8 vCPU, 32 GB, Ubuntu) │
                    │  Docker Compose: base + prod + edge overlays      │
                    │                                                   │
   Let's Encrypt ── │  Traefik :443 ─ ForwardAuth ─ Authentik (OIDC)   │
   (ACME, DNS-01)   │     ├─ erp.<d>      → Frappe/ERPNext (+ /ops)    │
                    │     ├─ app.<d>      → generative-ui              │
                    │     ├─ api.<d>      → go-orchestrator ─ MCP host │
                    │     ├─ chat.<d>     → Chatwoot                    │
                    │     ├─ social.<d>   → TryPost (+ /mcp/trypost)   │
                    │     ├─ workflow.<d> → n8n                         │
                    │     └─ files.<d>    → Nextcloud                   │
                    └───────┬───────────────────────┬──────────────────┘
                            │                        │
              GCP managed (optional upgrade):   Local volumes (default):
              Cloud SQL (PG/MySQL), Memorystore  MariaDB, Postgres, Redis
              Secret Manager, GCS, Artifact Reg.  (docker volumes on PD-SSD)
```

**Networks:** `platform-net` (edge/identity/orchestrator/TryPost) + `smb-net` (app data plane).
**Persistent disk:** all stateful volumes on a dedicated PD-SSD, snapshotted (see §5).

## 2. GCP services used

| Concern | Default (single-VM) | Managed upgrade (optional) |
|---|---|---|
| Compute | 1× GCE VM (Compose) | + MIG for the VM (still not HA app-wise) |
| Secrets | `.env` from Secret Manager at boot | Secret Manager + workload identity (P5) |
| Object storage | GCS (backups, KB, RAG corpus) | same |
| Container images | Artifact Registry | same |
| DB | in-VM MariaDB/Postgres | Cloud SQL (MySQL + PG) |
| Cache/queue | in-VM Redis | Memorystore |
| DNS/TLS | Cloud DNS + Traefik ACME (DNS-01) | Cloud DNS + certs |
| CI/CD | Cloud Build → Artifact Registry → VM pull | + Cloud Deploy |
| Observability | Ops Agent + Traefik/app logs | Cloud Logging/Monitoring, uptime checks |

## 3. Roadmap (phased; maps to PRODUCTION_READINESS_PLAN.md)

### Phase 0 — Restructure finish (blocks GCP work)
Complete restructure **Phase 2** (converge `apps/services/infra`, repoint CI — P2), Compose single
source of truth in `infra/compose/` (base + `local`/`prod`/`edge`), regenerate `COMPOSE.md`.
**Exit:** `docker compose -f infra/compose/docker-compose.yml -f ...prod.yml config` validates; CI green.

### Phase 1 — Provision GCP (IaC)
Terraform (extend `terraform/`): project, VPC, GCE VM + PD-SSD, firewall (80/443 only), Cloud DNS
zone, Artifact Registry, GCS buckets (backups + KB), Secret Manager secrets (DB, Authentik, Gemini,
`TRYPOST_APP_KEY`, `TRYPOST_API_TOKEN`, `CHATWOOT_API_TOKEN`, Frappe keys), service account with least
privilege. **Exit:** `terraform apply` yields a reachable VM + DNS; secrets exist (empty values set by owner).

### Phase 2 — Secrets & config (close G6, P5)
Boot-time `.env` rendered from Secret Manager (no literals in repo, no `changeme`). Prod overlay
**fails loud** on any unset required secret. `TRYPOST_DB_PASSWORD`, `TRYPOST_APP_KEY` required.
**Exit:** stack refuses to start with a missing secret; no default secret anywhere in prod.

### Phase 3 — Edge & identity (close G3, G2, G4, G5, P4)
Deploy Traefik + Authentik on the VM; real ACME (DNS-01 via Cloud DNS). ForwardAuth for
GenUI/n8n/tools; **ERPNext + TryPost `/mcp/trypost` stay reachable for token/API clients** (no
ForwardAuth on those paths — bearer/OIDC instead). Trusted-proxy enforcement; bypass fails closed;
drop Traefik `--api.insecure`. **Exit:** blueprint §7 Phase-0 auth checks pass; forged `X-authentik-*` → 401.

### Phase 4 — Data safety (close P1) — *before onboarding any business*
`scripts/backup.sh`: `mysqldump` (MariaDB SoR), `pg_dump` (platform PG + Chatwoot + **TryPost**),
tar app/KB/media volumes → GCS with lifecycle + retention; encrypt at rest. `scripts/restore.sh`
with a **documented, executed restore drill**. **Exit:** full restore into a scratch stack reproduces
seeded ERP data, Authentik logins, and TryPost schedules.

### Phase 5 — Agentic layer (TryPost + Chatwoot MCP) go-live
Vendor `trypostit/trypost`, `fazer-ai/mcp-chatwoot`, `fazer-ai/chatwoot-skills` as submodules; build
images to Artifact Registry; **bundle `bun` into the orchestrator image** (for the stdio Chatwoot MCP).
Set `TRYPOST_MCP_ENABLED`/`CHATWOOT_MCP_ENABLED=true` with real tokens. Run the
`TEST_PLAN_GENUI_ORCHESTRATOR.md` suite (esp. section E). **Exit:** agent drives Chatwoot + TryPost
tools from GenUI chat; E1–E4 pass.

### Phase 6 — Tenant onboarding for digital businesses (close G10)
Tenant resolution **fails closed** (no silent `"default"`). Per-tenant: ERPNext site/company seed,
Authentik group, Chatwoot account, TryPost workspace, KB corpus. MCP tool calls carry tenant context
so one business can never touch another's Chatwoot/TryPost state. `/v1/tenants/*` onboarding automated
+ idempotent. **Exit:** two isolated tenants provisioned; cross-tenant access denied (verified).

### Phase 7 — Observability, CI/CD, hardening
Cloud Ops Agent; uptime checks on each `*.smb.<domain>`; real `vertex_rag` probe; rate-limit
`/v1/ai/*` (P8). Cloud Build pipeline: test → build → scan (SBOM) → push → VM pull + `compose up`.
**Exit:** dashboards + alerts live; CI enforces lint/tests/compose-validate/image-scan.

## 4. "Support all digital businesses" — the multi-tenant story
- **One shell, any vertical:** GenUI + ERPNext `/ops` cover retail/POS, services, pharma, etc.; seed
  packs (`tests/legacy/seed-varient`) bootstrap vertical demo data.
- **Agentic ops:** the MCP host means new capabilities are *tools*, not code — Chatwoot (129 tools) for
  support/CRM/inbox automation, TryPost for social across 12 networks, n8n for glue, KB/RAG for grounded
  answers. Adding a vendor = registering its MCP server in `mcp-servers/registry.yaml`.
- **Isolation is the product:** host-derived tenant + fail-closed resolution + per-tenant service
  accounts. This is the line between "demo" and "a platform businesses trust."

## 5. Backups, RPO/RTO, cost — owner inputs required
| Decision | Needed for |
|---|---|
| Production domain + Cloud DNS delegation | Phase 3 (ACME) |
| VM size (default e2-standard-8/32 GB; TryPost adds ~1–2 GB) | Phase 1 |
| Managed vs in-VM DB/cache (Cloud SQL/Memorystore) | Phase 1/2 cost |
| **RPO/RTO targets** (drives snapshot cadence + retention) | Phase 4 |
| Nextcloud / Helpdesk / Gameball in scope? | Phase 6 footprint |

## 6. Residual risks
- Single-VM = no failover; a VM/disk loss is an outage until restore. Snapshots make it recoverable, not HA.
- TryPost has no official image — we build from source; pin a commit and scan the image.
- Chatwoot stdio MCP requires `bun` + vendored server inside the orchestrator image; if absent, the
  agent silently loses Chatwoot tools (TryPost HTTP still works). Health-check `/v1/mcp/servers` in CI.
- Secrets are only as safe as Secret Manager wiring (P5) — until then, `.env` on the VM is the weak link.
