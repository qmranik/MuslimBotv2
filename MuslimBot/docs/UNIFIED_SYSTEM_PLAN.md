# MuslimBot — Unified System for Digital Businesses (Master Plan + R&D)

> Reconciles the pasted vision (Validation Protocol v2.0 · Backend/BFF architecture ·
> Multi-tenancy roadmap · n8n+Chatwoot support integration) with the **actual codebase**,
> then lays out a researched, phased implementation focused on the three backbone
> projects: **`go-orchestrator`**, **`small_erp`**, **`generative-ui`**.
>
> **North-star reframe:** `generative-ui` is the **single window — the MuslimBot Agent**.
> Everything (ERPNext, Chatwoot, n8n, Postiz, Nextcloud, voice) is reached *through* it,
> either as a generative component or a SecurePortal iframe. `go-orchestrator` is the one
> BFF/brain behind it; `small_erp` is the headless ERP system-of-record + tool surface.

---

## 1. Breakdown of the pasted plan → what it actually asks for

| Pasted section | Core ask | Maps to |
|---|---|---|
| **Validation Protocol v2.0** | E2E test: Traefik/Authentik → ERP seed → Flutter → GenUI NLP → n8n/Chatwoot → voice → Nextcloud RAG | A cross-system acceptance suite (extends our `test-silos/` + 4GB prompt) |
| **Go Orchestrator = BFF + AI Tool Router + SSO iframe provisioner + Webhook aggregator** | One stateless Go backend the GenUI talks to; it routes AI tool-calls to ERPNext, mints iframe SSO URLs, aggregates external webhooks | `go-orchestrator` — **3 of 4 exist**; webhook aggregation is the gap |
| **Multi-tenancy roadmap** | Subdomain-routed hybrid: ERPNext DNS-per-tenant, n8n container-per-tenant, Chatwoot account-per-tenant, Authentik brands | `tenants` package + a tenant-context middleware + a provisioner |
| **n8n + Chatwoot support workflow** | Canonical pipeline: loop-prevention → context fetch → ERP/RAG lookup → LLM → reply/human-handoff | n8n workflow templates + orchestrator webhook routing |
| **Single pane of glass** | Chat command center + generative components + SecurePortal iframes, one SSO | `generative-ui` — **exists**; needs server-brain default + portal polish |

**Reality check on the pasted timelines/claims:** the pasted docs assume a greenfield 4–6 month build. We are **not greenfield** — much of the BFF, the AI brain, the GenUI, the portals, and the ERP tool surface already exist and are green. So the real work is **closing specific gaps**, not rebuilding. This plan is gap-driven.

---

## 2. Current state of the three backbone projects (ground truth)

### `go-orchestrator` (Go/Gin) — the BFF/brain
Exists and builds:
- **Identity**: Authentik ForwardAuth middleware (+ constant-time KB service-key), `/auth/me`, tenant resolution via `TenantUserMapping`.
- **AI brain**: `POST /v1/ai/generate-ui` (structured UiDescriptor) + `POST /v1/ai/tool/execute` (server-side **21-tool executor** → `small_erp.api.*`, KB, n8n) + legacy `/ai/chat`. Config-driven pinned models.
- **Gateway**: `/erp/*` proxy (token-masked), KB proxy, portals SSO (`erp-ops/nextcloud/n8n/chatwoot/postiz`), events outbox, tenants scaffold, request-logging + dependency health.

**Gaps vs the pasted plan:** ① **webhook aggregation** (Chatwoot/Twilio/Stripe → per-tenant n8n) — missing. ② **tenant-by-host** middleware (subdomain → tenant) — only email-mapping today. ③ **tenant provisioner** (`/tenants` is a stub). ④ outbox has no dispatch worker.

### `small_erp` (Frappe app) — headless system-of-record
- 15 API modules (incl. hardened `auth.py` + `revoke_keys`), services layer, RAG doctypes, doc-events→n8n, roles/permissions. `CLAUDE.md` now declares the **HTMX `/ops` frontend deprecated** (headless direction confirmed).
- **Gap:** `/ops` presentation + `check_desk_access`/`home_page="ops"` hooks still present; the "remove /ops" cutover (parity-first) is pending. Tool endpoints for the executor exist but a few (submit_order, list/create_event) are unmapped.

### `generative-ui` (React/Vite→Next) — the MuslimBot Agent window
- `AppShell` + `WorkspaceManager`/`WorkspaceNav` (single-pane tabs), `CommandCenter` (chat), generative components (Chart/Table/Card/Metrics + `GenerativeMessageRenderer`), `KnowledgeHub`, `SecurePortal` (iframe SSO), `MuslimbotFab`, `VoiceCallPanel`.
- **`serverBrain.js` already routes NLP to `/v1/ai/generate-ui`** (server brain preferred; browser Gemini key demoted to fallback).
- **Gaps:** action-execution wired to `/v1/ai/tool/execute` (write confirm loop); remove the client-Gemini path from prod builds; SecurePortal hardening (sandbox, origin allowlist, per-portal token refresh).

---

## 3. R&D — open-source comparison & recommendations

### 3.1 Multi-tenancy model
2026 consensus is a **hybrid** model: pooled/shared for standard tenants, isolated for enterprise; the per-tenant DB overhead only pays off above ~$200/mo ARPU. n8n specifically "isn't turnkey multi-tenant — make deliberate isolation choices." ([Northflank](https://northflank.com/blog/multi-tenant-saas-platform-deployment), [wednesday.is](https://www.wednesday.is/writing-articles/n8n-multi-tenant-architecture-for-enterprise-saas), [Medium/Syntal](https://medium.com/@sparknp1/safe-by-design-n8n-for-saas-multi-tenant-automation-that-scales-007b0bb63734))
- **Recommendation:** the pasted plan's hybrid is right, but **stage it**. v1 = **shared-with-tenant-tag** everywhere (Frappe tenant field, one n8n with tenant-routed webhooks, Chatwoot accounts, Authentik brands). Promote high-value tenants to **isolated ERPNext site + dedicated n8n container** later. Don't build container-per-tenant provisioning until a paying enterprise needs it — it's the most expensive piece.

### 3.2 Generative-UI framework
The GenUI space matured: **OpenUI** (open standard, streaming, ~67% more token-efficient than JSON, React/Vue/Svelte runtimes), **Thesys C1** (OpenAI-compatible API returning rendered UI + MIT Crayon toolkit on Radix/shadcn), **Vercel AI SDK** (streaming UI + tool-calling), and Google's **A2UI** (agent-driven interface protocol). ([OpenUI](https://www.openui.com/), [thesysdev/openui](https://github.com/thesysdev/openui), [awesome-generative-ui](https://github.com/narrowin/awesome-generative-ui), [A2UI](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/))
- **Recommendation:** keep our **custom `UiDescriptor` schema** (it already unifies web+mobile+voice and is server-produced) but **adopt streaming** from the Vercel AI SDK pattern and evaluate **Thesys/OpenUI** for the renderer to cut prompt tokens and get richer components for free. Migration is additive: the orchestrator can emit the OpenUI stream format behind a flag.

### 3.3 Telephony / voice
LiveKit Agents is the strongest OSS voice foundation (largest contributor base); **Dograh** and **Bolna** are self-hostable Vapi/Retell alternatives with built-in Twilio/Plivo/Vonage telephony, visual workflow builders, and human-transfer. ([Rasa comparison](https://rasa.com/blog/best-ai-voice-agents), [dograh-hq/dograh](https://github.com/dograh-hq/dograh), [dev.to](https://dev.to/priteshkr/4-open-source-tools-to-build-production-ready-ai-voice-agents-49p2))
- **Recommendation:** we already run a LiveKit voice worker. For the **Twilio inbound-call → order** workflow the pasted plan wants, add **Twilio ↔ LiveKit SIP** (keep our worker + 21-tool executor as the brain) rather than adopting Vapi/Retell. Consider **Bolna/Dograh** only if you want a no-code call-flow builder for non-engineers.

### 3.4 Iframe SSO embedding (single pane of glass)
Our `portals` handler already implements the correct per-app handshakes (OIDC for Nextcloud/Postiz, ForwardAuth for n8n, magic-link for Chatwoot, proxy for ERP). This matches best practice; the risk is iframe security.
- **Recommendation:** harden `SecurePortal` — strict `sandbox`, `allow`-list of frame-ancestors (already set in the proxy CSP), `postMessage` origin verification, and **short-lived per-portal tokens with refresh** (Chatwoot magic-link already; extend the pattern).

### 3.5 RAG / knowledge
KB BFF supports SQLite (dev) + Vertex AI (prod). The pasted plan adds **Nextcloud + MCP** as the document source of truth.
- **Recommendation:** keep Vertex/KB as the vector layer; add a **Nextcloud→KB ingestion** path (webhook or n8n cron) so files dropped in Nextcloud chunk into the existing KB. Don't introduce a second vector store.

---

## 4. Gap analysis — vision vs. what's built

| Capability | Pasted vision | Current | Gap to close |
|---|---|---|---|
| Single agent window | GenUI is the only UI | GenUI exists, server-brain wired | Wire action-execute + strip client key |
| AI tool routing | Go maps NLP→ERP tools | ✅ 21-tool executor | Map remaining tools (submit_order, events) |
| Iframe SSO | Secure embeds of all silos | ✅ portals handler | SecurePortal hardening |
| **Webhook aggregation** | Go = single ingress for Chatwoot/Twilio/Stripe → n8n | ❌ missing | **Build it (this turn: U1)** |
| Tenant by subdomain | Host→tenant everywhere | Partial (email map) | Host middleware + tenant tag propagation |
| Support workflow | Loop-guard→RAG→LLM→handoff | Pieces exist (KB, n8n hooks) | Canonical n8n template + webhook route |
| Voice→order | Twilio→agent→ERP | LiveKit worker + tools | Twilio SIP bridge |
| Multi-tenant provisioning | <2 min new tenant | `/tenants` stub | Staged provisioner |
| Remove /ops | Flutter/GenUI only | /ops still present | Parity-first cutover |

---

## 5. Phased implementation plan (backbone-focused)

**U1 — Orchestrator webhook aggregator (this turn).** `POST /v1/webhooks/:source` (public, signature/secret-gated): resolve tenant (Chatwoot `account.id` / query / host), persist to EventOutbox, forward to the tenant's n8n. Fast 200 ack. *Verifiable in Go.*

**U2 — Tenant context everywhere.** Host→tenant middleware (`acme.muslimbot.com`→`acme`); propagate `X-Tenant-Id` through erp/kb/ai/webhook paths; add tenant to `generate-ui` + tool-execute scope. Frappe: tenant field on key doctypes (shared-schema v1).

**U3 — GenUI as the sole agent window.** Wire `useGenerativeChat` action-execute → `/v1/ai/tool/execute` (write-confirm cards); default `VITE_USE_SERVER_BRAIN=true`, remove browser Gemini in prod build; SecurePortal hardening; make CommandCenter the landing route.

**U4 — Canonical support workflow.** Ship the n8n template (loop-guard → Chatwoot context → ERP/KB lookup → Gemini → reply/`[HANDOFF_REQUIRED]`) driven by U1's webhook route; Nextcloud→KB ingestion path.

**U5 — Remove `/ops` (parity-first).** Confirm GenUI+Flutter cover the 8 /ops routes → delete `www/ops/`, flip `check_desk_access` (stop redirecting to a dead route; browsers → "use the app/GenUI" landing), drop `home_page="ops"`/`role_home_page`; repoint `erp-ops` portal + workspaceUrls to `/app`. Keep all `api/*` intact. Rollback = git revert.

**U6 — Staged multi-tenant provisioner.** `POST /v1/tenants` → create/scope: Frappe tenant, Authentik brand+group, Chatwoot account, n8n webhook path, seeded roles. Container-per-tenant n8n only behind an "enterprise" flag.

**U7 — Voice→order + validation suite.** Twilio↔LiveKit SIP; turn the pasted Validation Protocol v2.0 into a scripted acceptance run on staging.

---

## 6. Integration suggestions (OSS to add, with why)

- **Vercel AI SDK streaming** (or OpenUI runtime) in GenUI → streaming generative components, fewer tokens.
- **Bolna/Dograh** (optional) → no-code voice call-flow builder for ops teams; else Twilio SIP → our LiveKit worker.
- **Nextcloud + a small MCP/ingest node** → files-as-knowledge into existing KB.
- **Prometheus + Grafana + Loki + Tempo** (compose `observability` profile) → the request-id logging already emitted becomes traces.
- **Stripe** (billing) at the orchestrator webhook ingress (U1 handles the route) → SaaS subscriptions.
- **gVisor/rootless containers** if/when container-per-tenant n8n lands → isolation without full VMs.

---

## 7. Delivered this turn
- This plan (`docs/UNIFIED_SYSTEM_PLAN.md`).
- **U1 webhook aggregator** in `go-orchestrator` (`internal/webhooks/`) + route + tests — see the commit. `go build ./...`, `go vet`, and `go test` green.

## 8. Risks
- **/ops removal before parity** strands web SMB users → U5 is explicitly parity-first + revertible.
- **Container-per-tenant n8n** is the costliest item → deferred behind an enterprise flag (§3.1).
- **Webhook security** (spoofed Chatwoot/Twilio) → U1 gates on per-source secret/signature; never trust the tenant id from an unsigned body.
- **Client Gemini key** still in genUI fallback → U3 removes it from prod builds.
