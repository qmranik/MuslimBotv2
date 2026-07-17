# MuslimBot — Production Readiness Review & Implementation Plan

**Date:** 2026-07-16
**Baseline:** commit `670210c`, branch `feat/voice-agent-livekit-1x`
**Scope:** Blueprint v2.0 §1–§8 → production grade
**Supersedes:** `IMPLEMENTATION_PLAN.md` (gap register G1–G13 carried forward and extended)

---

## 1. Verdict

MuslimBot is **a strong prototype with production ambitions and no production floor**. The application tier is genuinely well-built — the Go orchestrator compiles clean and implements the BFF surface the blueprint calls for; the edge tier (Traefik + Authentik + forward-auth chain) is correctly designed; Terraform provisions GCP Secret Manager; CI covers six components; n8n workflows for Chatwoot RAG support and Nextcloud ingest already exist as JSON.

What's missing is not features. It is the operational substrate that separates a demo from a system a business can run on:

- **There is no backup.** Not for MariaDB, which the blueprint designates the System of Record (§3.1). Not for the platform Postgres that holds Authentik's identity data. No `pg_dump`, no `mysqldump`, no snapshot policy, no restore drill anywhere in `scripts/`. Today, a lost volume is a lost company.
- **Production has no identity layer.** `docker-compose.yml` explicitly excludes Authentik, Traefik, and the orchestrator to save ~6 GB. The blueprint's entire §2 security model is defined only in an overlay that targets *local*.
- **CI is about to break entirely.** All six jobs use root-relative paths (`go-orchestrator`, `erp-flutter`, …). The `MuslimBot/` restructure invalidates every one.
- **The repository lost work.** 69 files, including the whole Flutter app and the only definition of the edge tier, were absent from disk — because the tree is owned by `root` and a `sudo` restructure died halfway.

The gap between blueprint and reality is therefore **not §4 or §6 (the interesting parts, largely built)** but §1, §2, and §7 — perimeter, identity, and proof.

---

## 2. Review — component by component

| Component | State | Production-grade? |
|---|---|---|
| Go orchestrator | Builds clean; AI/tools/portals/webhooks/KB/tenants routes present | **Near** — needs auth hardening, rate limits |
| Edge tier (Traefik/Authentik) | Correctly designed in `docker-compose.extended.yml` | **No** — local-only, insecure API, default secrets |
| generative-ui | Command Center, SecurePortal, serverBrain → generate-ui | **Near** — needs origin/sandbox hardening |
| Chatwoot + n8n | Workflow JSON exists for support-RAG and Nextcloud ingest | **Partial** — not auto-imported or verified |
| LiveKit voice | Agent + SIP checklist; compose services present | **No** — identity bug (G7) makes every caller anonymous |
| Frappe / small_erp | System of record; seed_demo; API-token automation | **Partial** — no backup, OIDC not codified |
| Terraform | Secret Manager, random_password, network, compute | **Partial** — not wired to compose `.env` |
| CI | 6 jobs + gitleaks | **No** — paths break on move; lint advisory only |
| Nextcloud / Postiz | Portal handlers ready; **no services, no MCP server** | **No** |
| Backups / DR | **Nonexistent** | **No** |
| Observability | RequestLogger only | **No** — no metrics, traces, or alerts |

---

## 3. Gap register

Carried forward from `IMPLEMENTATION_PLAN.md` (G1–G13), extended with production gaps (P1–P12) found in this review.

### Blocking — must close before any production claim

| # | Gap | Evidence |
|---|-----|----------|
| **P1** | **No backup or restore for any datastore.** MariaDB (system of record), platform Postgres (Authentik identity), Chatwoot Postgres, all named volumes. No restore drill. | `grep -rli 'backup\|pg_dump\|mysqldump' scripts/` → empty |
| **P2** | **CI breaks completely on the `MuslimBot/` move** — all 6 jobs use root-relative `working-directory` / `git ls-files` globs | `.github/workflows/ci.yml` |
| **G1** | 69 files absent from disk (58 Flutter, 5 silo composes, 6 root/docs incl. `docker-compose.extended.yml`) | verified by blob-hash comparison vs `670210c` |
| **G3** | Production compose has **no edge tier** → no identity layer in prod | `docker-compose.yml:15` — `❌ Authentik / Traefik / Go Orchestrator` |
| **G2** | Orchestrator trusts `X-authentik-*` with no proxy verification; reachable on `smb-net-local` by n8n/Chatwoot/any container | `internal/auth/middleware.go:42` |
| **G4** | `ENV=local` auth bypass **fails open** to Administrator | `internal/auth/middleware.go:18` |
| **G6** | Default secrets: `changeme_in_production`, placeholder `AUTHENTIK_SECRET_KEY` | `docker-compose.extended.yml` |
| **P3** | **Root-owned repo tree** (`MuslimBot/`, `tests/`, `.opencode/` owned by `root`) — root cause of G1, will recur | `ls -ld MuslimBot` |

### High

| # | Gap | Evidence |
|---|-----|----------|
| **G5** | Traefik `--api.insecure=true`, dashboard published on `:8090` | `docker-compose.extended.yml` |
| **G7** | Voice reads `user_id`, which **nothing ever sets** → every caller anonymous, no tenant context | `internal/voice/handler.go:33`; no `c.Set("user_id")` exists |
| **P4** | No TLS/ACME for production — self-signed `.localhost` only | `docker-compose.extended.yml` traefik command |
| **P5** | Terraform Secret Manager exists but is **not wired** to compose `.env` — two disconnected secret systems | `terraform/secrets.tf` vs `.env.template` |
| **P6** | External network hardcoded `liteerp_smb-net-local`; breaks under `MuslimBot/` project name | `docker-compose.extended.yml` networks |
| **P7** | Only 3 healthchecks across the production stack; uneven resource limits | `docker-compose.yml` |
| **G10** | Tenant resolution **falls back to `"default"`** on lookup failure — silent cross-tenant leakage | `internal/auth/middleware.go:93` |
| **P8** | No rate limiting on billable `/v1/ai/*` (Gemini) | `cmd/server/main.go:131` |

### Medium

| # | Gap |
|---|-----|
| **G12** | ERPNext ↔ Authentik OIDC Social Login Key (§2.1/§2.2) not codified — prose only |
| **G9** | Nextcloud not deployed; **no Nextcloud MCP server** (`mcp-servers/` has only `frappe-docs-mcp`, `bench-mcp`) |
| **G11** | Postiz not deployed (~6 GB with Temporal/Elasticsearch) |
| **G13** | Frappe Builder public website (§3.2) unimplemented |
| **P9** | Duplicate/conflicting Flutter CI (`ci.yml` `mobile` job + `flutter_ci.yml`) |
| **P10** | Lint not enforced — `ruff check small_erp \|\| true` |
| **P11** | No image build/publish, no compose validation, no SBOM or image scanning in CI |
| **P12** | No metrics, traces, or alerting; `healthHandler` reports `vertex_rag` as "configured" without probing |
| **G8** | Blueprint §5/§7-Phase-5 specify Retell/Vapi; implementation is LiveKit + Gemini Realtime → **rewrite the doc, not the code** |

---

## 4. Implementation plan

### Phase A — Stabilize (G1, P3, P2)

1. **Fix ownership first.** `sudo chown -R qmranik:staff MuslimBot .opencode`. This is the root cause of G1, not housekeeping.
2. Complete the relocation of the 61 restored files still at repo root (`erp-flutter/`, `docker-compose.extended.yml`, `docker-compose.mvp.yml`, `COMPOSE.md`). The other 8 already landed.
3. Commit rename-aware (stage deletes + adds together; verify Git reports renames, not delete+add). Split: pure move, then the 23 genuinely-edited files.
4. **Repoint CI** — every `working-directory` and `git ls-files` glob gains the `MuslimBot/` prefix. Delete the redundant `flutter_ci.yml` (P9).
5. Configure a remote and push. There is currently no off-machine copy.

**Exit:** `git status` clean; renames in history; `docker compose -f MuslimBot/docker-compose.extended.yml config -q` passes (**already verified passing**); CI green.

### Phase B — Backup & DR (P1) — *do this before features*

This phase does not exist in the original plan and is the single largest production gap.

1. `scripts/backup.sh` — `mysqldump` for MariaDB, `pg_dump` for platform + Chatwoot Postgres, tar for `frappe-sites` / `muslimbot-kb-data` / `authentik_media`.
2. Nightly scheduled job; push to GCS with lifecycle + retention (Terraform already has the project scaffolding).
3. `scripts/restore.sh` with a **documented, executed restore drill** — a backup you have not restored is not a backup.
4. Encrypt at rest; never write dumps into the repo tree.

**Exit:** a full restore into a scratch stack reproduces seeded ERP data and Authentik logins.

### Phase C — Secure edge & hybrid SSO (G2–G6, G12, P4–P7)

1. **Unify compose topology.** Base + overlays: `docker-compose.yml` (shared) / `.local.yml` / `.prod.yml` / `.edge.yml`. Parameterize the network name (P6) and `PLATFORM_BASE_DOMAIN` — config already carries the field.
2. **Traefik routers** for `erp.*`, `chat.*`, `n8n.*`, `social.*`, `files.*`, `api.*`; real ACME resolver (P4).
3. **Middleware chain** — `strip-identity-headers` (blank client-supplied `X-authentik-*`) **then** `authentik-forwardauth`. Order is the whole point.
4. **Trusted-proxy enforcement** (G2). Add `TRUSTED_PROXY_CIDRS`; reject `X-authentik-*` unless `c.RemoteIP()` is trusted. Fail closed. Network isolation alone is insufficient — the orchestrator shares `smb-net-local` with n8n and Chatwoot by design.
5. **Bypass fails closed** (G4): require `AUTH_LOCAL_BYPASS=true` **and** `ENV=local`; refuse to boot if enabled alongside production markers.
6. **Harden Traefik** (G5): drop `--api.insecure`, unpublish `:8090`, dashboard behind the auth chain.
7. **Secrets** (G6, P5): remove every `:-changeme` default so compose fails loudly; wire Terraform Secret Manager → runtime env.
8. **ERPNext stays unblocked at the edge** (§2.3) — no forward-auth on `erp.*`; `/socket.io` upgrade mapped; `Authorization: token` paths reachable for n8n and payment webhooks.
9. **Codify ERPNext OIDC** (G12) as an idempotent `bench` fixture: client ID/secret, `/application/o/authorize/`, token endpoint, redirect `…/frappe.integrations.oauth2_logins.custom_sso_callback`, `Create User if not exists` enabled.
10. Healthchecks + resource limits across all services (P7).

**Exit (blueprint §7 Phase 0):** unauthenticated `n8n.<domain>` → Authentik redirect; SSO into GenUI then `erp.<domain>` provisions an ERP user via OIDC; **n8n → Frappe API token still works with no browser session**; forged `X-authentik-email` → 401 both directly and through Traefik.

### Phase D — Orchestrator hardening (G10, P8, P12)

1. Tenant resolution fails closed, not to `"default"` (G10).
2. Rate limit + budget cap `/v1/ai/*` (P8).
3. Verify `WEBHOOK_SECRET` HMAC is enforced per source on the unauthenticated `/v1/webhooks/:source` (correctly public for external callers — must be signature-gated).
4. OpenTelemetry traces orchestrator → Frappe → KB BFF → LiveKit; real `vertex_rag` probe; uptime alerting (P12).

### Phase E — Voice (G7, G8)

1. Fix G7: derive identity from `user_email`; inject `tenant_id` into LiveKit metadata (the agent is multi-tenant and currently receives no tenant). Regression test asserting a deterministic, identity-derived room.
2. Reduce `SetValidFor(2h)` to session lifetime.
3. Rewrite blueprint §5 / §7-Phase-5 to LiveKit + Gemini Realtime + Twilio SIP (G8). Keep Twilio for PSTN ingress only.

### Phase F — Workflows 2 & 3, Knowledge (G9, G11)

1. **Workflow 2**: auto-import `configs/n8n/workflow-chatwoot-support-vertex.json`; drive via signature-gated `POST /v1/webhooks/chatwoot`; loop guard → RAG → reply or human handoff.
2. **Knowledge**: deploy Nextcloud (OIDC via Authentik); **build the missing Nextcloud MCP server**; activate `workflow-nextcloud-kb-ingest.json`.
3. **Workflow 3 / Postiz** (G11): gated on the owner's footprint decision.

### Phase G — Flutter (§4.2) & Frappe Builder (G13)

Revive `erp-flutter` (58 files restored); point `app_config.dart` at the orchestrator so it inherits SSO + tenant routing; §7 Phase 2 write-back. Frappe Builder catalog + Chatwoot widget (G13).

### Phase H — Executable validation (§7)

`tests/acceptance/` scripting §7 Phases 0–6, emitting one markdown report with PASS/FAIL/**SKIP**, non-zero exit on failure. Silo plans (`tests/legacy/test-silos/`) become optional half-stack modes for constrained hosts. Wire into CI (P11) alongside image build/publish, compose validation, and image scanning.

---

## 5. Sequencing

```
A (stabilize + CI + ownership)
└── B (backup/DR) ────────────┐
    └── C (secure edge/SSO) ──┼── D (orchestrator hardening)
                              ├── E (voice)
                              ├── F (workflows/knowledge)
                              ├── G (flutter/builder)
                              └── H (validation harness)
```

A blocks everything. **B before any feature work** — an unbacked system of record is the largest single risk here, larger than any auth gap, because auth failures are recoverable and data loss is not. C gates every production claim. D–G parallelize once C lands. H proves it.

## 6. Definition of done

- G1–G7 closed; G8 documentation aligned to LiveKit; G9–G13 closed or deferred with tickets.
- **Restore drill executed and documented** (not merely scripted).
- Hybrid SSO proven end-to-end per §7 Phase 0, including the ERP-must-stay-unblocked case.
- Workflows 2 and 3 demo-able; Workflow 1 if SIP configured, else `SKIPPED`.
- Acceptance harness exits non-zero on failure; CI green with lint enforced.
- No secrets committed (gitleaks already gates this; `.env`/`cookie.txt` correctly ignored — **verified clean**).

## 7. Decisions required from the owner

| # | Decision | Blocks |
|---|---|---|
| 1 | **Run the `chown`** to fix root ownership | A — everything |
| 2 | **Production domain + DNS control** (for ACME) | C |
| 3 | **Real production target.** `docker-compose.yml` budgets ~7.5 GB core on 16 GB and excludes the edge tier to save ~6 GB. The full blueprint does not fit. Bigger host, or split nodes? | C |
| 4 | **Postiz in scope?** ~6 GB with Temporal + Elasticsearch | F |
| 5 | **Confirm LiveKit + Gemini Realtime final** so §5 is rewritten, not the code | E |
| 6 | **Backup retention/RPO/RTO targets** | B |

---

## 8. Residual risks

- **Single-host Docker Compose is the ceiling.** The blueprint says "high-performance VPS," but no HA, no rolling deploy, no failover. Production-grade *within* that constraint is achievable; "production-grade" as in highly-available is not, and shouldn't be claimed.
- **`.env`-driven secrets** remain a weak link until Terraform Secret Manager is actually wired through (P5).
- **Multi-tenancy is host-header derived** (`TenantFromHost`) with a DB mapping fallback. Until G10 fails closed, tenant isolation is advisory.
