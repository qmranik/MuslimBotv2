# MuslimBot — Gap Closure & Enhancement Plan

**Date:** 2026-07-16
**Baseline commit:** `670210c`
**Branch:** `feat/voice-agent-livekit-1x` (identical to `main`; no remote configured)

This plan is derived from an audit of the working tree against *MuslimBot Unified Admin OS & AI-Agentic SaaS Blueprint v2.0*. It is ordered by risk: repository stabilization first (work is currently at risk), then security, then deployment unification, then feature completion.

---

## Audit summary — what's actually true

Two corrections to first impressions, both important:

1. **The edge tier is built, not missing.** Traefik + Authentik (server & worker) + platform Postgres/Redis + the Go orchestrator are fully defined and wired in `docker-compose.extended.yml`, including the `authentik-forwardauth@file` middleware label on the orchestrator router. It is not missing — it is *deleted from disk* and currently exists only in commit `670210c`.

2. **Far less is lost than the raw `git status` suggests.** Of 375 deleted paths, most were relocated into `MuslimBot/`. Only **66 files are genuinely absent from disk**: 54 in `erp-flutter/`, 5 `test-silos/docker-compose.silo*.yml`, 3 docs, `generative-ui/eslint.config.js`, plus `COMPOSE.md`, `docker-compose.mvp.yml`, and `docker-compose.extended.yml`.

Secrets hygiene is **clean**: `.env` and `cookie.txt` are correctly covered by `.gitignore` (lines 6 and 13); only `.env.template` files are tracked. No action needed.

The Go orchestrator **builds cleanly** (`go build ./...` passes) and is substantial: AI router, generative UI, KB/RAG, tenants, portals, webhooks, events, workflows, voice.

### Gap register

| # | Gap | Severity | Blueprint ref |
|---|-----|----------|---------------|
| G1 | 66 files absent from disk, incl. all of `erp-flutter` and the edge-tier compose | **Critical** | §4.2, §7 Phase 2 |
| G2 | Orchestrator trusts `X-authentik-*` headers with no proxy verification | **Critical** | §2 |
| G3 | Production compose (`docker-compose.yml`) has no edge tier at all → no auth in prod | **Critical** | §1, §2 |
| G4 | `ENV=local` auth bypass fails *open* to Administrator | **High** | §2 |
| G5 | Traefik `--api.insecure=true`, dashboard published on `:8090` | **High** | §1.1 |
| G6 | Default secrets (`changeme_in_production`, default `AUTHENTIK_SECRET_KEY`) | **High** | §2.1 |
| G7 | Voice handler reads `user_id`, which nothing ever sets → every caller anonymous | **High** | §5, Workflow 1 |
| G8 | Blueprint §5 specifies Retell/Vapi/Twilio; implementation is LiveKit + Gemini Realtime | Medium (doc) | §5, §7 Phase 5 |
| G9 | Nextcloud not deployed; MCP → RAG sync unimplemented | Medium | §5, §7 Phase 6 |
| G10 | Postiz not deployed (portals handler already supports it) | Medium | §5, Workflow 3 |
| G11 | Frappe Builder public website not implemented | Medium | §3.2 |
| G12 | ERPNext OIDC "Social Login Key" config not codified anywhere | Medium | §2.2 |
| G13 | Validation protocol (§7) has no executable harness | Low | §7 |

---

## Phase 0 — Stabilize the repository

**Blocking. Nothing else should start until this lands.** The working tree currently holds 375 uncommitted changes; a careless `git add -A && git commit` would turn 66 recoverable files into a real deletion.

**0.1 — Decide the fate of the 66 absent files.** Requires an explicit call from the owner. Recommendation: restore all of them. `erp-flutter` is a core blueprint deliverable (§4.2, Phase 2) and `docker-compose.extended.yml` is the *only* definition of the edge tier.

```bash
git checkout 670210c -- erp-flutter docker-compose.extended.yml docker-compose.mvp.yml \
  COMPOSE.md docs/MUSLIMBOT_PRODUCTION_PLAN.md docs/UNIFIED_SYSTEM_PLAN.md \
  docs/PROMPT_4GB_FULL_SYSTEM_TEST.md generative-ui/eslint.config.js test-silos
```
Then relocate them under `MuslimBot/` to match the new layout.

**0.2 — Commit the move as a rename.** Stage deletions and additions together so Git records renames and history survives:
```bash
git add -A && git status   # verify renames are detected, not delete+add
```
Expect `docker-compose.yml` and `Muslimbot-voice-agent/agent.py` to show as modified-with-rename — they carry real edits.

**0.3 — Split the commit.** Land the pure move first, then the content edits to `docker-compose.yml` and `agent.py` as a separate reviewable commit.

**0.4 — Configure a remote and push.** The project currently has no off-machine backup.

**Exit criteria:** `git status` clean; `erp-flutter` and `docker-compose.extended.yml` present on disk; history shows renames; pushed to a remote.

---

## Phase 1 — Close the security gaps

### 1.1 — Verify the forward-auth trust boundary (G2)

`internal/auth/middleware.go:42` reads `X-authentik-email` and trusts it. That is correct **only** if Traefik is the sole ingress and strips client-supplied copies. Today the orchestrator sits on both `platform-net` and `smb-net-local`, so any container on `smb-net-local` — n8n, Chatwoot, a compromised worker — can reach `go-orchestrator:8080` directly and forge admin identity.

Two changes, defence in depth:

**(a) Strip inbound identity headers at the edge.** Add to `traefik/dynamic/authentik.yml` a middleware that blanks client-supplied headers, and chain it *before* forward-auth:
```yaml
http:
  middlewares:
    strip-identity-headers:
      headers:
        customRequestHeaders:
          X-authentik-username: ""
          X-authentik-groups: ""
          X-authentik-email: ""
          X-authentik-name: ""
          X-authentik-uid: ""
    authentik-chain:
      chain:
        middlewares:
          - strip-identity-headers
          - authentik-forwardauth
```
Update the orchestrator's router label to `authentik-chain@file`.

**(b) Enforce a trusted-proxy check in the orchestrator.** Add `TRUSTED_PROXY_CIDRS` to `internal/config/config.go` and, in `AuthentikMiddleware`, reject `X-authentik-*` headers unless `c.RemoteIP()` falls inside a trusted CIDR. Fail closed with 401. This makes the header trust explicit rather than incidental.

### 1.2 — Make the local bypass fail closed (G4)

`middleware.go:18` enables an Administrator bypass whenever `ENV=local`. A missing or misspelled `ENV` in production silently grants admin. Replace the trigger with an explicit, separate opt-in:
- Gate on `AUTH_LOCAL_BYPASS=true` **and** `ENV=local` together.
- Refuse to start (`log.Fatal`) if the bypass is enabled while `TRUSTED_PROXY_CIDRS` or a production marker is set.

### 1.3 — Harden Traefik (G5)

Remove `--api.insecure=true` and drop the `8090:8080` port mapping. If the dashboard is wanted, put it behind the `authentik-chain` middleware on a `traefik.smb.localhost` router.

### 1.4 — Eliminate default secrets (G6)

`docker-compose.extended.yml` defaults `DB_PASS` to `changeme_in_production` and `AUTHENTIK_SECRET_KEY` to a placeholder. Remove the `:-default` fallbacks so compose fails loudly on an unset variable, and document generation in `.env.template`.

**Exit criteria:** forged `X-authentik-email` to the orchestrator returns 401 both directly and via Traefik; bypass cannot activate without explicit opt-in; no default secrets; dashboard not publicly exposed.

---

## Phase 2 — Unify deployment (G3)

The edge tier overlays `docker-compose.local.yml` only. `docker-compose.yml` (the GCP/production stack) explicitly excludes Authentik, Traefik, and the orchestrator — which means **production today has no identity layer and no API gateway**. The blueprint's §1.1 subdomain strategy and §7 Phase 0 cannot be validated against it.

**2.1 — Reconcile the compose topology.** Three files (`docker-compose.yml`, `.local.yml`, `.mvp.yml`) plus an overlay have drifted. Restructure to a base + overlays model:
- `docker-compose.yml` — shared service definitions
- `docker-compose.local.yml` — local dev overrides
- `docker-compose.prod.yml` — production overrides (real TLS, resource limits)
- `docker-compose.edge.yml` — Traefik + Authentik + orchestrator (from the recovered `extended.yml`), usable with *both* local and prod

**2.2 — Make the edge tier production-viable.** The recovered file is local-shaped: `.localhost` hostnames, self-signed TLS, `smb-net-local` hard-coded as an external network. Parameterize the domain (`PLATFORM_BASE_DOMAIN` already exists in config) and add a real ACME/Let's Encrypt resolver for the five subdomains in §1.1.

**2.3 — Resolve the RAM budget honestly.** `docker-compose.yml`'s header budgets ~7.5 GB core on a 16 GB box and excludes the edge tier to save ~6 GB. Adding Authentik + Traefik + orchestrator back needs a real measurement, not an assumption — either the box grows or Chatwoot/voice stay behind profiles.

**2.4 — Codify ERPNext OIDC (G12).** §2.2's Social Login Key setup exists only as prose in the blueprint. Script it as an idempotent `bench` fixture so a fresh deploy self-configures: client ID/secret, auth and token endpoints, and `Create User if not exists` enabled.

**Exit criteria:** one command brings up the full stack with the edge tier on both local and prod; §7 Phase 0 passes (unauthenticated `n8n.<domain>` redirects to Authentik; SSO into Gen UI then ERPNext provisions a user via OIDC).

---

## Phase 3 — Voice: fix identity, reconcile the spec

**3.1 — Fix the identity bug (G7).** `internal/voice/handler.go:33` reads `c.GetString("user_id")`. No middleware in the codebase ever calls `c.Set("user_id")` — `AuthentikMiddleware` sets `user_email`, `user_name`, `user_full_name`, `tenant_id`, and `user_groups`. So `userID` is always empty, every request falls to the `anonymous-<timestamp>` branch, the LiveKit room name is unique per second, and the voice agent receives no real identity. Workflow 1 ("pull my order status") cannot identify a caller.

Read `user_email` instead, and include `tenant_id` in the LiveKit metadata — the agent is multi-tenant but currently gets no tenant context. Add a regression test asserting an authenticated request yields a deterministic, identity-derived room name.

**3.2 — Reconcile the blueprint with reality (G8).** §5 and §7 Phase 5 specify Retell AI / Vapi / Twilio. The implementation is LiveKit + Gemini Realtime (63 files reference LiveKit; zero reference Retell). Per the standing decision to keep Gemini Realtime, **the blueprint is stale — rewrite §5 and Phase 5**, don't change the code. Keep Twilio only where it's genuinely used for SIP/PSTN ingress into LiveKit.

**3.3 — Token scope review.** `SetValidFor(2 * time.Hour)` is generous for a voice session token. Reduce to the session lifetime.

---

## Phase 4 — Complete the missing surfaces

**4.1 — Nextcloud + MCP → RAG (G9).** Blueprint §5 and §7 Phase 6. `internal/portals/handler.go` already mints Nextcloud OIDC portal URLs and `mcp-servers/` exists, but no Nextcloud service is deployed and no sync runs. Deliver: the Nextcloud service with OIDC against Authentik; the MCP server wired to scan files; an n8n workflow triggering ingestion into the existing Vertex RAG pipeline (`internal/ai/kb.go`, `services/ingest_pipeline.py`).

**4.2 — Postiz (G10).** Blueprint §5, Workflow 3. `portals/handler.go:58` already returns a Postiz OIDC portal URL for a service that doesn't exist. Deploy Postiz + its Temporal/Elasticsearch dependencies (this is the ~6 GB the GCP compose was avoiding — likely a separate node), then build the Workflow 3 n8n chain: schedule → fetch top sellers from ERPNext → AI drafts copy → push to Postiz queue.

**4.3 — Frappe Builder public website (G11).** Blueprint §3.2. Essentially unimplemented — a name in a handful of files. Build the public catalog pages mapping ERPNext item data, and embed the Chatwoot live-chat widget.

---

## Phase 5 — Restore and revive `erp-flutter`

54 files restored in Phase 0. Then: confirm `flutter pub get` and the existing test suite (`test/auth_test.dart`, `muslimbot_client_test.dart`, `persona_test.dart`, `tool_catalog_test.dart`, `ui_descriptor_test.dart`) pass; point `app_config.dart` at the orchestrator rather than Frappe directly, so the app inherits Authentik SSO and tenant routing; execute §7 Phase 2's write-back test.

**Open question for the owner:** `erp-flutter` was absent from disk and carries a `REBUILD_PLAN.md`. Confirm whether it is still in scope or was deliberately parked.

---

## Phase 6 — Executable validation (G13)

Turn §7's seven manual phases into a runnable harness. `tests/` already has `test_auth.py`, `test_endpoints.py`, `test_create_customer.py` and `tests/legacy/` holds Playwright specs and prior QA evidence — a foundation exists. Target: `make validate` runs Phases 0–6 against a live stack and emits a pass/fail report, wired into `.github/`.

---

## Phase 7 — Enhancements (post-parity)

Only once the blueprint is met:
- **Tenant isolation hardening.** `resolveTenantID` (middleware.go:93) falls back to `"default"` whenever no mapping is found — a soft failure that silently cross-wires tenants. Make it fail closed.
- **Orchestrator observability.** `RequestLogger` exists; add OpenTelemetry traces across orchestrator → Frappe → KB BFF → LiveKit.
- **Health check depth.** `healthHandler` probes Frappe and the KB BFF but reports `vertex_rag` as merely "configured" — probe it for real.
- **`/v1/webhooks/:source` is unauthenticated** (main.go:98, outside the auth group). It's correct for external callers, but confirm `WebhookSecret` HMAC verification is enforced per source.
- **Rate limiting** on `/v1/ai/*` — Gemini calls are billable and currently unbounded.

---

## Sequencing

Phase 0 blocks everything. Phases 1 and 3.1 are small, high-value, and can run in parallel immediately after. Phase 2 is the largest infrastructure effort and gates any production claim. Phases 4–6 are feature completion and can parallelize across contributors once Phase 2 lands.

```
Phase 0 ──┬── Phase 1 (security) ──┐
          ├── Phase 3.1 (voice bug)─┤
          └── Phase 3.2 (docs) ─────┴── Phase 2 (deploy) ──┬── Phase 4 (surfaces)
                                                            ├── Phase 5 (flutter)
                                                            └── Phase 6 (validation) ── Phase 7
```

## Decisions needed from the owner

1. **Restore the 66 absent files, or confirm deletion?** (blocks Phase 0)
2. **Is `erp-flutter` still in scope?** (blocks Phase 5)
3. **Is Postiz in scope, given its ~6 GB footprint?** (blocks Phase 4.2)
4. **Confirm LiveKit + Gemini Realtime is final**, so §5 can be rewritten rather than the code replaced. (blocks Phase 3.2)
5. **What is the real production target?** The 16 GB budget in `docker-compose.yml` does not fit the full blueprint. (blocks Phase 2.3)
