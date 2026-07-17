# MuslimBot System — Production Alignment Plan

> Scope: the **entire liteERP repository** operating as one product — the MuslimBot
> AI business OS (ERPNext core + orchestrator + voice/KB + generative-ui + mobile
> + automations). This plan turns the current demo-grade, multi-part system into a
> **production system**: one identity, one AI brain, one deploy pipeline, observable,
> recoverable, and tenant-safe.
>
> Grounding: CLAUDE.md, FULL.md, COMPOSE.md, deployment.md, `small_erp/`,
> `go-orchestrator/`, `Muslimbot-voice-agent/`, `generative-ui/`, `erp-flutter/`
> (REBUILD_PLAN.md + BUILD_STATUS.md), `traefik/`, `test-silos/`, scripts.

---

## 1. Current state — subsystem maturity

| Subsystem | Works today | Production blockers |
|---|---|---|
| **small_erp** (Frappe app, `/ops`) | Standalone HTMX app, RBAC seeder, APIs per domain, doc-event → n8n | New `api/auth.py:login_to_get_keys` is `allow_guest` and returns a **long-lived api_secret in the response body** — needs TLS-only + rate-limit + audit; scheduler/webhook error paths unmonitored |
| **go-orchestrator** | Authentik ForwardAuth identity, portals SSO, ERP/KB proxy w/ token masking, outbox models | `/v1/ai/chat` is **plain text** on deprecated `gemini-1.5-flash`; KB-BFF **shared-key header bypass** in `auth/middleware.go`; no rate limits, metrics, or request logging; `mock-key` path in prod code |
| **Muslimbot-voice-agent + KB BFF** | 21 ERP tools, LiveKit dispatch, RAG (SQLite dev / Vertex prod), voice-brief cache | Voice model pinned to **`gemini-2.0-flash-exp` (experimental)**; one `TENANT_ID` per container (no per-room tenancy); LiveKit Cloud single point; KB prod path (Vertex+GCS) unexercised in CI |
| **generative-ui** | Chat-to-dashboard, NLP router, portals, Knowledge Hub, voice call | **Gemini key in the browser** (`VITE_GEMINI_API_KEY` + localStorage) — must move server-side; structured router schema lives only client-side |
| **erp-flutter (MuslimBot mobile)** | P0+P1 shipped & green (persona shell, API-key auth, Tier-3 WebView, assistant shell) | P2–P6 pending; config hardcoded `AppConfig.dev()`; no store pipeline/push; API keys on device need revocation story |
| **n8n / Chatwoot / Postiz** | Demo compose, workflows importable | Default creds in template, no HA, no workflow versioning/promotion between envs |
| **Platform/infra** | 4 compose profiles, Traefik+Authentik in `extended`, deploy.sh + backup.sh, 8 QA silos | **Not a git repository**; no CI/CD; `.env` plaintext secrets; **no TLS anywhere** (http + cookie sync); backups never restore-tested; zero observability; multi-tenant scripts legacy |

**The two structural fragmentations to fix:**
1. **Identity** — three parallel auth systems: Frappe sid/API-keys (mobile, n8n), Authentik ForwardAuth (web via Traefik), KB-BFF shared key (voice/system). No single revocation point.
2. **AI brain** — four brains: client-side Gemini (web), plain-text Gemini (orchestrator), realtime Gemini (voice), n8n LLM chains. Same persona, four implementations, three different models.

---

## 2. Target production architecture

```
                    ┌─────────────────────── Edge: Traefik (TLS, rate-limit) ───────────────────────┐
                    │        Authentik (OIDC IdP): staff SSO · customer portal · OAuth2 for mobile    │
                    └───────────────┬───────────────────────────────────────────────────────────────┘
                                    ▼  X-authentik-* / OAuth2 bearer
   web genUI ─┐            ┌──────────────────────────────┐        ┌── Frappe/ERPNext (small_erp)
   mobile ────┼──────────► │   go-orchestrator  /v1/*      │ ─────► ├── KB BFF (RAG, voice sessions)
   /ops ──────┘            │  • ai/generate-ui (ONE brain) │        ├── n8n (webhooks, chains)
   voice ── LiveKit ─────► │  • tool executor (21 tools)   │        └── Chatwoot / Postiz portals
                           │  • portals SSO · events outbox│
                           │  • tenancy · audit · metrics  │        Postgres(platform) · MariaDB(ERP)
                           └──────────────────────────────┘        Redis · object storage (backups)
                                     ▲ OTel traces/metrics/logs → Grafana/Loki/Tempo · Sentry
```

Principles: **all client traffic through Traefik+orchestrator over TLS**; **Gemini keys only server-side**; **one structured AI endpoint** consumed by every surface; **tenant on every request**; **everything observable and restorable**.

---

## 3. Workstreams

### W0 — Engineering foundations *(prerequisite for everything)*
1. **`git init` + remote + branch protection.** The repo is not under version control — this is the single largest production risk. Commit history = rollback + audit. Add `.gitignore` (already present) review: ensure `.env*`, `app_config.dart`, keys excluded; **purge `cookie.txt` at repo root** (live session artifact).
2. **CI pipeline** (GitHub Actions): jobs for `small_erp` (ruff/mypy + bench tests), `go-orchestrator` (`go vet`, `go test`, build), `erp-flutter` (`flutter analyze` + `flutter test` — already the gate), `generative-ui` (lint + build), voice agent (pytest on tools with mocked ERP). Turn `test-silos/` plans into scripted smoke jobs where possible (`run-qa.sh` as the seed).
3. **Secrets management**: move from `.env` to SOPS-encrypted env files or Docker/Compose secrets; generate per-env; rotate anything ever committed (Chatwoot keys, JWT secrets, Gemini keys). CI enforces no-plaintext-secrets (gitleaks).
4. **Image discipline**: pin base images (`frappe/erpnext:v15.x.y`, `n8n:1.64.3` already pinned — extend to all), build+push versioned images from CI, `docker compose` uses digests in prod.

### W1 — One identity (Authentik as the IdP for every surface)
1. **Staff web**: already designed (ForwardAuth) — promote `docker-compose.extended.yml` from "extended" to the canonical prod topology.
2. **Mobile**: replace `login_to_get_keys` password flow with **OAuth2/PKCE against Authentik** (the planned Tier-2 SDK supports it; `frappe_oauth2_flutter_sdk` exists as fallback). Orchestrator exchanges the Authentik token for scoped Frappe access server-side, so **api_secret never leaves the backend**. Until then, harden the current endpoint: TLS-only, rate-limit (Traefik middleware), login-audit log entry, and a revoke-keys endpoint.
3. **Customers**: Authentik social/OTP login → Frappe Website User provisioning hook (orchestrator `tenants` package).
4. **Service identities**: replace the KB-BFF shared-key header bypass with a proper machine-credential (Authentik service account / mTLS between containers); voice worker gets per-tenant scoped Frappe keys, not Administrator keys.
5. **Single sign-out / revocation**: Authentik session kill propagates (orchestrator caches identity ≤5 min max).

### W2 — One AI brain (the MuslimBot service)
1. **Add `POST /v1/ai/generate-ui`** to the orchestrator (closes the gap in REBUILD_PLAN §1.4): input `{prompt, history, surface, persona_mode, tenant_id}` → output the **UiDescriptor schema** (`metrics|chart|table|card|action|flow|navigate|open_doc|rag|text`). Server-side Gemini with the ERP snapshot context (port the system prompt from `generative-ui/src/services/gemini.js`), persona from `agent.py`.
2. **One tool registry, executed server-side**: implement the 21-tool catalog in the orchestrator (`internal/ai/tools/`), calling `small_erp.api.*` with the caller's tenant-scoped credentials. Voice worker, web, and mobile all invoke tools **through this executor** → one audit trail, one permission check, one confirmation policy for writes.
3. **Model governance**: pin GA models (voice: current GA Gemini realtime model replacing `gemini-2.0-flash-exp`; router: current GA flash), config-driven model ids, canary env var, cost/latency logging per call.
4. **Surface migration**: generative-ui drops `VITE_GEMINI_API_KEY`/localStorage and calls `/v1/ai/generate-ui`; erp-flutter P3 targets it natively (Dart fallback stays behind a dev flag); n8n chains keep long-running/async jobs only.
5. **RAG productionization**: KB BFF on Vertex AI RAG + GCS in prod (env-gated already), nightly voice-brief rebuild, KB source sync monitoring, per-tenant KB namespaces (exists via `TENANT_ID` — extend to per-request).

### W3 — Surfaces to GA
1. **Mobile (erp-flutter)** — continue REBUILD_PLAN P2–P6: Tier-2 metadata engine (install `frappe_mobile_control` into the Frappe image as a Dockerfile layer next to `small_erp`), assistant brain → W2 endpoint, voice via LiveKit, customer support (Helpdesk), Tier-1 bespoke flows; then store pipeline (fastlane, TestFlight/Play internal), crash reporting (Sentry), remote config for `AppConfig` (replace hardcoded `AppConfig.dev()` with `--dart-define` + a server-provided config endpoint), push notifications (orchestrator events → FCM).
2. **Web genUI** — server-brain migration (W2), remove mock-router paths from prod build, error boundaries + Sentry.
3. **`/ops`** — stays the lightweight staff fallback; add CSP headers and session-timeout policy.

### W4 — Tenancy & data
1. **Tenant model end-to-end**: orchestrator `TenantUserMapping` is the source of truth; every ERP/KB/AI/tool call carries tenant; voice rooms carry tenant metadata (LiveKit room metadata → worker reads it instead of env `TENANT_ID`).
2. **Provisioning**: rewrite `scripts/provision-tenant.sh` as an orchestrator workflow (`POST /v1/tenants` already scaffolded): new Frappe site (or shared-site + tenant field for v1), Authentik group, KB namespace, n8n creds, seeded roles (`setup_permissions.run`).
3. **Backups & DR**: extend `small_erp/scripts/backup.sh` to also cover **platform Postgres, n8n data, KB SQLite/GCS manifests, Authentik**; encrypt; ship to S3/GCS; **scheduled restore drills** into a staging silo (reuse `test-silos/` compose) with a pass/fail report. Define RPO ≤ 24h, RTO ≤ 4h for v1.
4. **Data retention/PII**: customer PII inventory (Frappe, Chatwoot, KB chunks, LiveKit recordings off), deletion workflow per tenant.

### W5 — Reliability & observability
1. **OpenTelemetry** in orchestrator (Gin middleware) and KB BFF (FastAPI); Frappe request logs shipped; one trace id from mobile/web → orchestrator → Frappe/KB.
2. **Stack**: Prometheus + Grafana + Loki (compose profile `observability`), Sentry (all four app surfaces + Python + Go).
3. **Health & SLOs**: `/v1/sys/health` already aggregates — add per-dependency checks (MariaDB, Redis, KB, LiveKit, Gemini quota) and alerting (Grafana → email/Slack via n8n). SLOs: API p95 < 500ms, voice session connect < 3s, AI generate-ui p95 < 6s.
4. **Resilience**: restart policies audit, Redis/MariaDB healthchecks gate worker start (partially present), circuit breaker + timeout budget in orchestrator proxy, n8n queue-mode for prod.

### W6 — Environments & release
| Env | Topology | Purpose |
|---|---|---|
| **dev** | `docker-compose.local.yml` (as today) | laptop, hot reload |
| **staging** | prod topology (`extended` + TLS + observability) on a VM, seeded via `seed_demo` | pre-release, restore drills, silo test plans run here |
| **prod** | same compose/IaC, versioned images, secrets from SOPS, Traefik TLS (Let's Encrypt) | tenants |

Release train: CI green → build/push images → deploy staging (auto) → run silo smoke suite → manual promote to prod (tagged) → mobile tracks (internal → beta → prod). Rollback = previous image tag + restore point.

### W7 — Security hardening checklist (concrete)
- [ ] TLS everywhere (Traefik certresolver); HSTS; secure/samesite cookies; mobile ATS exceptions removed in prod builds.
- [ ] `login_to_get_keys`: rate-limit, TLS-only guard, audit log, revocation endpoint; retire after OAuth2 (W1.2).
- [ ] Remove KB-BFF header bypass (W1.4); mTLS or service tokens between containers.
- [ ] Gemini/API keys server-side only (W2); purge `VITE_GEMINI_API_KEY` from client bundles; rotate all keys.
- [ ] Frappe: disable guest signup, password policy, `allow_cors` tightened, `encryption_key` backed up.
- [ ] Delete `cookie.txt`; gitleaks in CI; dependency scanning (osv-scanner, `flutter pub audit`-equivalent, `govulncheck`).
- [ ] Run `/security-review` on `small_erp/api/*`, orchestrator handlers, and KB BFF routes before GA.

---

## 4. Milestones

| Milestone | Contents | Exit criteria |
|---|---|---|
| **M1 — Hardened single-tenant (≈2–3 wks of work)** | W0 all · W1.2-hardening · W2.1–2.3 (generate-ui + executor + model pins) · W5.2 minimal (Sentry+healthchecks) · W7 top half | git+CI green on all 5 components; TLS staging up; one AI endpoint serving web+mobile; backups restore-tested once |
| **M2 — GA surfaces (≈+3–4 wks)** | W3 mobile P2–P4 + store internal track · genUI server-brain · W5 full observability · W6 staging/prod split | Owner/employee/customer journeys pass silo suites on staging; voice on GA model; dashboards+alerts live |
| **M3 — Multi-tenant SaaS (≈+4 wks)** | W4 tenancy end-to-end + provisioning API · W1 full OAuth2 mobile · DR drills scheduled · mobile P5–P6 | Two isolated tenants provisioned via API operate concurrently; restore drill report; app-store production release |

*(Durations assume ~1–2 engineers + this agent; adjust to team size.)*

---

## 5. Risk register (top)

| Risk | Impact | Mitigation |
|---|---|---|
| No VCS/CI today | any regression is unrecoverable | W0.1 first, before all other work |
| Experimental voice model deprecated | voice surface dies suddenly | W2.3 pin GA model + canary |
| Client-held secrets (Gemini key, api_secret) leak | account/API abuse, cost blowout | W2.4, W1.2, key rotation |
| LiveKit Cloud outage | voice down | graceful text fallback (already in mobile design); self-host LiveKit option later |
| Single-VM prod | total outage | documented restore (W4.3) first; HA later — explicitly out of v1 scope |
| `frappe_mobile_control` third-party dependency | Tier-2 mobile blocked | vendor the app into the image; fallback = own engine on `frappe_dart` (REBUILD_PLAN §2) |

---

## 6. Immediate next 10 actions (ordered)
1. `git init`, initial commit, push to a private remote; delete `cookie.txt`.
2. Add CI with the five component jobs (fail-fast: analyze/test/vet).
3. Rotate + SOPS-encrypt all secrets; verify `.gitignore` coverage.
4. Harden `small_erp.api.auth.login_to_get_keys` (rate-limit, TLS-only, audit, revoke endpoint).
5. Implement `POST /v1/ai/generate-ui` + server-side tool executor in the orchestrator.
6. Pin AI models (voice + router) to GA versions via env config.
7. Point generative-ui and erp-flutter P3 at the new endpoint; strip client Gemini keys.
8. Stand up staging = `extended` compose + Traefik TLS + Sentry + healthcheck alerts.
9. Bake `frappe_mobile_control` into the Frappe image; start mobile P2 (Tier-2 engine).
10. First backup **restore drill** into a test-silo; write the runbook from what breaks.
