# MuslimBot OS — Blueprint v2.0 Reconciliation & Implementation Plan

**Date:** 2026-07-18
**Baseline:** branch `chore/repo-restructure`, HEAD `a6b726f`
**Purpose:** Reconcile the pasted "MuslimBot OS" architecture narrative (n8n bus, Frappe multi-tenancy, Authentik OIDC, Vercel AI SDK GenUI, Go worker-pool gateway, Traefik wildcard SSL, iframe embedding, MCP/agentic, RBAC, rate-limiting, backups, CI/CD, dashboards, n8n queue mode) against the **actual repository state**, and extend the existing plan to cover what the narrative genuinely adds.
**Companion to (does not supersede):** [`PRODUCTION_READINESS_PLAN.md`](PRODUCTION_READINESS_PLAN.md) — gap register G1–G13 / P1–P12 and phases A–H remain authoritative.

---

## 0. How to read this document

The pasted blueprint is a **generic reference roadmap**. Large parts of it are already built (orchestrator BFF, edge tier design, n8n workflows, Terraform), several parts **contradict decisions already made in this repo**, and a handful are **genuinely new** and worth adding. This plan does three things:

1. **§1 Corrections** — where the narrative is wrong for *this* stack. Build the repo's version, not the narrative's.
2. **§2 Capability map** — every blueprint capability → existing gap ID *or* a new `Nx` id.
3. **§3 Extension workstreams + §4 sequencing** — the concrete, sequenced work to "complete all the above contexts properly," folded into the existing A–H phases.

---

## 1. Corrections — narrative vs. this repo (do NOT build verbatim)

| # | Blueprint says | This repo does | Action |
|---|---|---|---|
| C1 | **Voice via Twilio recording → LLM transcription → sentiment** | **LiveKit + Gemini Realtime** (`Muslimbot-voice-agent/agent.py`, `AgentSession` 1.6.x). Twilio is **PSTN/SIP ingress only.** | Keep Gemini Realtime. Twilio = SIP trunk only. Rewrite blueprint §5 prose, not the code (**G8**). |
| C2 | **OpenAI `gpt-4o`** in GenUI + n8n | Primary LLM path is **Gemini** (`services/gemini_service.py`, `internal/ai/router.go`). OpenAI is an **optional** n8n path (`LLM_PROVIDER`). | Default to Gemini; keep OpenAI opt-in. Don't hardcode `openAI('gpt-4o')`. |
| C3 | **MSSQL / `mssql-enterprise`** (implied for analytics/Mautic) | Frappe requires **MariaDB 10.11**; Mautic (if ever added) supports only MySQL/MariaDB. | Drop MSSQL entirely. |
| C4 | **Cloud SQL MySQL 8** for Frappe | **Self-hosted MariaDB** (v15 requirement). | No Cloud SQL for Frappe without a dedicated spike. |
| C5 | **Postiz** for social | Replaced by **TryPost** (MCP-native), ADR-0001. Drops ~6 GB Temporal/ES. | Deploy TryPost, not Postiz (**G11**). |
| C6 | **Composio MCP bridge** for Frappe agentic tools | Repo uses **orchestrator `internal/mcp/`** (now scaffolded) + **fazer-ai/mcp-chatwoot** (129 tools) + **TryPost MCP** + local `mcp-servers/` (bench, frappe-docs, chatwoot, trypost). | Use the repo's MCP host runtime; Composio is not a dependency. |
| C7 | **n8n v2.2+ instance-level MCP** | Repo pins **n8nio/n8n:1.64.3**. | Verify any n8n-MCP claim against 1.64.3 before designing a critical path on it. |
| C8 | **Vercel AI SDK `part.state` / `part.args`** example uses pre-v5 shapes | generative-ui is on **`ai` ^7.0.22**. Part/tool-state API differs (v5+: `tool-<name>` parts, `input`/`output`, `state: 'input-available'|'output-available'`). | Follow installed SDK v7 API, not the snippet verbatim. |
| C9 | `network_mode: host`, single-file `compose.yaml` at `/opt/muslimbot-os` | Repo uses **base + overlays** (`docker-compose.yml` / `.local.yml` / `.extended.yml`), `host` mode is Linux/GCP-only. | Keep the overlay topology (Phase C item 1). Never `host` mode on the Mac dev path. |
| C10 | `bench new-site` over **SSH from n8n** | Tenant onboarding belongs behind the **orchestrator** (`internal/tenants`, `api/admin.py`, `scripts/provision-tenant.sh`), signature-gated. | No SSH-from-n8n. Provision via orchestrator endpoint. |

**Execution boundary (unchanged):** Claude builds repo artifacts (compose, terraform, configs, scripts, code). The **owner** runs `terraform apply`, DNS/ACME, Authentik account creation, SIP trunk registration, live PSTN calls, and the `chown`.

---

## 2. Capability map — blueprint → gap / status

Legend: ✅ built · 🟡 partial/scaffolded · ⬜ not started · **Nx** = new id introduced here.

| Blueprint capability | Maps to | Status | Where |
|---|---|---|---|
| Omnichannel ingestion (Chatwoot→n8n→Frappe) | Workflow 2 / **G9, G14** | 🟡 workflow JSON exists, not auto-imported | `configs/n8n/workflow-chatwoot-support-vertex.json` |
| Voice telemetry & sentiment (Twilio→Go→Frappe) | **G7, G8, C1** | 🟡 LiveKit+Gemini path; identity bug G7 | `Muslimbot-voice-agent/`, `internal/voice/` |
| Generative execution outbound (Frappe→n8n→edge) | Workflow 3 / **G11** | 🟡 events outbox exists; TryPost deploy pending | `internal/events/`, `api/events.py` |
| Frappe site-based multi-tenancy | built + **G10** | 🟡 works; tenant fallback leaks | `internal/tenants/`, `scripts/provision-tenant.sh` |
| Custom Doctypes (Omnichannel/Voice/Generative state) | **N1** | ⬜ blueprint names 3 doctypes; only KB doctypes exist | `small_erp_app/small_erp/doctype/` |
| Authentik OIDC multi-tenant handshake | Phase C / **G12** | 🟡 forward-auth designed; ERP OIDC not codified | `traefik/`, `docker-compose.extended.yml` |
| Tenant-scoped JWT (`tenant_slug` claim) + host mismatch → 403 | **G2, G10, N2** | ⬜ orchestrator trusts headers, no host/tenant assertion | `internal/auth/middleware.go` |
| Vercel AI SDK tool-based GenUI (streamText + zod tools) | **N3** | ⬜ genui exists but not the tool→component render loop | `generative-ui/src/` |
| Go worker-pool webhook ingestion (buffered channel, 202, graceful drain) | **N4** | 🟡 webhooks handler exists; no pool/backpressure/drain | `internal/webhooks/` |
| Docker Compose multi-tenant topology (Traefik/Authentik/Frappe/n8n) | Phase C / **G3, P6, P7** | 🟡 in `.extended.yml`, local-only | overlays |
| Traefik wildcard DNS-01 SSL (`*.muslimbot.io`) | **P4** | ⬜ self-signed `.localhost` only | `traefik/` |
| Secure iframe embedding (CSP `frame-ancestors`, session bridge) | **G13, N5** | ⬜ CSP override + token-exchange bridge not built | `small_erp` hooks, `internal/portals/` |
| MCP host runtime (TryPost + chatwoot, per-tenant republish) | **G11, G14** | 🟡 `internal/mcp/` scaffolded (client/manager/handler) | `internal/mcp/` |
| Human-in-the-loop cancel workflow (n8n AI Agent + approval) | **N6** | ⬜ | `configs/n8n/` |
| n8n credentials hygiene / secrets | **G6, P5** | 🟡 `.env` driven; Terraform SM not wired | `terraform/secrets.tf` |
| react-grid-layout tile workspace + tile RBAC | **N7** | ⬜ | `generative-ui/src/` |
| `postMessage` iframe↔dashboard bridge | **N7** | ⬜ | genui + Frappe client script |
| NextAuth roles from Authentik scope-mapping → middleware RBAC | **N8** | ⬜ genui has no `next-auth` dep | `generative-ui/` |
| Fire-and-forget security logging (middleware → n8n) + rate-limit/probe alerts | **P8, N9** | ⬜ | middleware + n8n |
| Traefik + Frappe + n8n rate limiting | **P8, N10** | ⬜ no `internal/ratelimit/`; no site rate_limit | orchestrator, `site_config.json`, Traefik labels |
| Frappe least-privilege service user (Read+Cancel only) | Phase C | ⬜ codify as bench fixture | `small_erp` fixtures |
| Security-audit Doctype + Frappe dashboard charts | **N1, N9** | ⬜ | `small_erp` |
| Backups pre-deploy + restore + off-site sync | **P1** | 🟡 `backup.sh` (pg_dump/mysqldump/gcs) exists; **no restore.sh, no drill** | `small_erp/scripts/backup.sh` |
| GitHub Actions deploy (ssh-action, merge overlays) + pre-deploy backup gate | **P2, P11, N11** | ⬜ CI exists but breaks on move; no deploy pipeline | `.github/workflows/` |
| n8n Queue Mode (main/worker/webhook + Redis + Postgres) | **N12** | ⬜ single `n8nio/n8n:1.64.3` instance | overlays |
| Observability (metrics/traces/alerts) | **P12** | 🟡 `internal/observability/` exists; probes/alerts pending | `internal/observability/` |

**New ids introduced:** N1 audit/telemetry doctypes · N2 tenant-scoped JWT assertion · N3 AI-SDK tool→component loop · N4 worker-pool ingestion · N5 iframe session bridge · N6 HITL cancel workflow · N7 tile workspace + postMessage · N8 NextAuth+scope-mapping RBAC · N9 security logging/audit · N10 layered rate limiting · N11 deploy CI/CD with backup gate · N12 n8n queue mode.

---

## 3. Extension workstreams (fold into existing phases A–H)

Only the **net-new / under-built** items are detailed here; items already covered by the existing plan are cross-referenced, not repeated.

### 3.1 Data model — telemetry & audit doctypes (N1) → Phase F/D
- Add `small_erp` doctypes: **Omnichannel Interaction**, **Voice Telemetry Log**, **Generative Action State**, **Security Audit** (fields per blueprint §2 tables). Ship as versioned fixtures so `bench migrate` creates them idempotently.
- Wire ingestion: Workflow 2 upserts Omnichannel Interaction; voice handler writes Voice Telemetry Log; GenUI actions create Generative Action State (`Pending→Executing→Completed/Failed`).
- **Accept:** a Chatwoot inbound and a completed voice call each produce one queryable record; GenUI "re-route driver" click creates a state row.

### 3.2 Tenant-scoped JWT + host assertion (N2, closes G2/G10) → Phase C/D
- Orchestrator: reject `X-authentik-*` unless `c.RemoteIP()` ∈ `TRUSTED_PROXY_CIDRS` (fail closed).
- Assert `tenant_slug` (from token/headers) **matches the Host-derived tenant**; mismatch → **403**. Tenant resolution failure → **deny**, never `"default"` (G10).
- **Accept:** forged `X-authentik-email` → 401 direct and via Traefik; token for `sme-alpha` against `sme-beta` host → 403; unknown tenant → 403 (not default).

### 3.3 Vercel AI SDK tool→component render loop (N3) → Phase F
- Backend route: `streamText` + `zod` tools (`getFulfillmentDelays`, ERP snapshot, etc.) whose `execute` calls the **orchestrator BFF** (not Frappe directly), carrying the OIDC bearer + `X-Frappe-Site-Name`. **Model = Gemini** via `@ai-sdk` provider (per C2/C8).
- Frontend: map `message.parts` → typed components using the **installed v7 API** (`type: 'tool-<name>'`, `state: 'input-available'|'output-available'|'output-error'`, `part.input`/`part.output`). Skeleton on input-available.
- Add missing dep `@ai-sdk/react`; keep LLM from hallucinating UI — components are a fixed registry.
- **Accept:** "analyze regional fulfillment delays" streams a skeleton then mounts a real chart fed by live BFF data.

### 3.4 Worker-pool webhook ingestion (N4) → Phase D
- Harden `internal/webhooks/`: buffered job channel (size via `QUEUE_SIZE`), fixed worker pool (`NumCPU*4`), **202 Accepted** fast-return, `select` backpressure → **503** on full (lets Twilio/Chatwoot retry), **HMAC signature verification per source** before enqueue (`WEBHOOK_SECRET`), and **graceful drain** on SIGTERM (stop accepting, drain queue).
- **Accept:** load test sustains bursts without dropping; unsigned webhook → 401; SIGTERM drains in-flight jobs; full queue → 503 not OOM.

### 3.5 Secure iframe embedding + session bridge (N5, closes part of G13) → Phase G
- Frappe `small_erp` `after_request` hook: strip `X-Frame-Options`, set `Content-Security-Policy: frame-ancestors 'self' https://app.<domain>` — **origin from config, not hardcoded**.
- Server-side token exchange: orchestrator endpoint mints a short-lived Frappe `sid` for the authenticated OIDC user (parent-domain cookie via Traefik, since `app.` and `sme-x.` share `*.muslimbot.io`). No password-in-URL.
- **Accept:** SSO'd user loads `erp.<tenant>` iframe with no second login; cross-origin cookie scoped to parent domain; ERP API-token paths (n8n/webhooks) stay unblocked at the edge (§2.3).

### 3.6 HITL cancel workflow (N6) → Phase F
- n8n AI Agent (LangChain node) with `GetDocument` + `CancelDocument` tools against Frappe REST; **native Human-in-the-Loop** approval (Slack/WhatsApp) before `run_method: cancel`; downstream-link check aborts; idempotency guard; append audit comment.
- Frappe service user restricted to **Read + Cancel** on `Sales Order`/`Sales Invoice` only (Role Permission Manager fixture).
- **Accept:** cancel request pauses for approval; approve → cancels + logs; linked-doc case halts; denied → user informed.

### 3.7 Tile workspace + postMessage bridge (N7) → Phase G
- generative-ui: `react-grid-layout` responsive tiles for ERP/n8n iframes; persist layout to a `UserPreference` doctype; `DynamicIframe` with loading skeleton + sandbox.
- `postMessage` bridge: Frappe client script posts `ERP_SAVE_SUCCESS` on `after_save`; dashboard listens → local re-fetch. n8n admin editor tile gated to `System Manager`; end-users get `/executions` view only.
- **Accept:** tiles drag/resize/persist; saving an invoice in the iframe refreshes the parent tile; non-admins cannot load the n8n editor.

### 3.8 NextAuth + Authentik scope-mapping RBAC (N8) → Phase C/G
- Authentik **Scope Mapping** injects `roles` (group names) into the token. NextAuth `jwt`/`session` callbacks surface `roles`. Tile array + Next.js `middleware.ts` filter by role. **Defense in depth:** UI filtering is UX only — Frappe Role Permission Manager + orchestrator middleware are the real gate.
- **Accept:** adding a user to "Manager" in Authentik changes visible tiles on next login with zero code change; a Driver hitting `/api/sales` → 403 at middleware *and* Frappe.

### 3.9 Security logging + layered rate limiting (N9, N10, closes P8) → Phase C/D
- **N10 rate limits:** Traefik `RateLimit` middleware on public routers (edge); orchestrator `internal/ratelimit/` (new) token-bucket on billable `/v1/ai/*` with budget cap; Frappe `site_config.json` `rate_limit`; n8n workflow concurrency cap.
- **N9 logging:** middleware **fire-and-forget** (never `await`) 401/403 events → n8n Security Watchdog webhook → threshold alert (Slack/WhatsApp) → append to **Security Audit** doctype. Metadata only (IP/path/user/UA/ts); no PII/secrets.
- **N1 dashboards:** Frappe Dashboard Charts over Security Audit (attempts by IP / over time) on a `System Manager`-only workspace.
- **Accept:** 50+ rapid unauth probes → 429 + a single throttled alert + audit rows; `/v1/ai/*` past budget → 429; alert fatigue avoided (thresholded).

### 3.10 Deploy CI/CD with backup gate (N11, closes P2/P9/P11) → Phase A/H
- Repoint all 6 CI jobs with `MuslimBot/` prefix; delete duplicate `flutter_ci.yml` (P9). Add compose validation, image build/publish, image scan (P11).
- `deploy.yml` (ssh-action) merges base+prod overlays; **runs `backup.sh` first and aborts on failure**; then `pull` + `up -d --remove-orphans` + `image prune`.
- Add **`restore.sh`** and an **executed, documented restore drill** — this is the still-open half of P1.
- **Accept:** CI green post-move; a deploy that can't back up does not proceed; restore drill reproduces seeded ERP data + Authentik logins in a scratch stack.

### 3.11 n8n Queue Mode (N12) → Phase F (production only)
- Split n8n into **main / worker / webhook** on shared **Redis** + **Postgres** (SQLite unsupported in queue mode); identical `N8N_ENCRYPTION_KEY` across all; Traefik routes `/webhook/*`→webhook, rest→main; `--scale n8n-worker=N`. **Production overlay only** — local stays single-instance.
- **Accept:** webhook burst handled by webhook processor without blocking UI; scaling workers drains backlog; credentials decrypt across processes.

---

## 4. Sequencing (extends the A–H spine)

```
Phase A  Stabilize + ownership chown + CI repoint (N11-part)      ← BLOCKS ALL; restructure in flight
Phase B  Backup/DR: restore.sh + executed drill (P1 completion)   ← BEFORE any feature
Phase C  Secure edge/SSO: N2, G12, TLS/ACME(P4), N8-auth, N10-Traefik/Frappe
   ├─ Phase D  Orchestrator: N4 worker-pool, N2 host-assert, N10 /v1/ai limits, N9 logging, P12 probes
   ├─ Phase E  Voice: G7 identity, G8 doc rewrite
   ├─ Phase F  Workflows/KB/MCP: N1 doctypes, N3 AI-SDK loop, N6 HITL, G9/G11/G14, N12 queue mode
   ├─ Phase G  Clients: N5 iframe bridge, N7 tile workspace+postMessage, Flutter revive, G13
   └─ Phase H  Validation: acceptance harness (§7 Phases 0–6), N11 deploy pipeline, N9 dashboards
```

**Ordering rationale (unchanged from readiness plan):** A gates everything and is currently blocked on the `chown` + restructure Phase 2. **B before features** — the system of record has a backup script but no proven restore; data loss is unrecoverable, auth failures are not. C gates every production claim (identity + perimeter + rate limits). D–G parallelize once C lands. H proves it and ships the deploy pipeline.

---

## 5. Immediate next actions (this branch)

1. **Owner:** run `sudo chown -R qmranik:staff MuslimBot .opencode` (still the hard blocker per migration memory) and confirm.
2. Finish restructure Phase 2 (converge layout, repoint CI) — prerequisite for N11.
3. **Quick wins that need no restructure and close real gaps now:**
   - `small_erp/scripts/restore.sh` + drill doc (completes **P1**).
   - `internal/ratelimit/` token-bucket on `/v1/ai/*` (closes **P8**).
   - Tenant-fail-closed + trusted-proxy assertion in `internal/auth/middleware.go` (closes **G2/G10**).
   - N1 doctype fixtures (unblocks telemetry + audit dashboards).

## 6. Owner decisions required (new, beyond readiness-plan §7)

| # | Decision | Blocks |
|---|---|---|
| 1 | Production **domain + DNS provider** for DNS-01 wildcard (Cloudflare/Route53/…) | Traefik SSL (P4) |
| 2 | **NextAuth vs. keep forward-auth-only** for generative-ui — adding `next-auth` (N8) vs. reusing the orchestrator/Authentik header chain the rest of the stack uses | N7/N8 |
| 3 | **n8n queue mode now or defer** (needs dedicated Postgres + Redis; production overlay only) | N12 |
| 4 | **Host sizing** — full edge+identity+queue-mode+TryPost does not fit the ~7.5 GB single-host budget; bigger host or split nodes? | C, F, N12 |
| 5 | **Backup RPO/RTO + retention** targets for the restore drill | B/P1 |

---

*This plan intentionally builds on `PRODUCTION_READINESS_PLAN.md` rather than restating it. Where the pasted blueprint and the repo disagree, §1 governs.*
