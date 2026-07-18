# MuslimBot — From Silos to a Unified Business Solution

Turn the currently-deployed-but-disconnected systems (each on its own `*.34.14.132.165.nip.io`
subdomain) into **one experience**: single sign-on, **generative-ui as the single control plane**
over ERPNext + every sub-system, **Chatwoot as full customer support**, and the **GenUI agent
using the TryPost MCP server to automate scheduling**.

Grounded in a live analysis of the running VM (`muslimbot-host-prod`, `34.14.132.165`) on
2026-07-18. Driver: [`../../setup.sh`](../../setup.sh). Context:
[`RUNBOOK.md`](RUNBOOK.md), [`../architecture/ADR-0001-social-trypost-and-chatwoot-mcp.md`](../architecture/ADR-0001-social-trypost-and-chatwoot-mcp.md).

---

## A. Current state — what's actually running (analysis)

**Up and reachable (the silos):** `ui`, `erp`, `n8n` → `200`; `chatwoot`, `social` (TryPost) → `302`
(their own logins). All app + edge containers run; MariaDB/Postgres/Redis/Authentik/TryPost healthy.

**The unifying layer is present but UNREACHABLE — this is why it's silos:**

| Symptom | Root cause (confirmed) | Fix |
|---|---|---|
| **`api.` → 404** (orchestrator brain, `/v1/ai/*`, `/v1/mcp/*` unreachable) | Orchestrator Traefik label references middleware **`authentik-auth@file`**, but the dynamic config defines **`authentik-forwardauth`** → router fails to load | rename label to `authentik-forwardauth@file` |
| **`auth.` → 404** (no SSO → every app is its own login) | Authentik container declares 2 routers + 2 services; Traefik logs: *"Router authentik cannot be linked automatically with multiple Services"* | add explicit `…routers.authentik.service=authentik` and `…routers.authentik-outpost.service=authentik-outpost` |
| Orchestrator `/v1/ai/*` non-functional | **`GEMINI_API_KEY` is empty** in `/opt/muslimbot/secrets/muslimbot.env` | set the key, restart orchestrator |
| **Agent can't use MCP tools** | GenUI chat runs `runNLPRouter` → **browser-direct Gemini** (`services/gemini.js`) + `/v1/ai/generate-ui` + `/v1/ai/tool/execute`; **nothing calls the MCP-enabled `/v1/ai/chat` or `/v1/mcp/*`** | route the agent through the orchestrator (U2) |

**Good news — the scaffolding for unification already exists in GenUI:** `services/serverBrain.js`
(`/v1/ai/generate-ui`, `/v1/ai/tool/execute`), `services/ssoBridge.js` (`/v1/portals/:app/url`),
the auth UI (`/v1/auth/me` + Authentik screens), and the persistent-iframe shell. It just isn't
wired end-to-end because the edge is broken. Both stacks share `liteerp_smb-net` +
`muslimbot_platform-net`, so services can already reach each other.

## B. Target unified architecture

```
                         Authentik (SSO, one login)
                               │ ForwardAuth
 Browser ─▶ app.<d> (generative-ui) ──▶ go-orchestrator /v1/*  ──┬─▶ ERPNext (proxy + tools)
             single control plane        (MCP host + AI brain)   ├─▶ Chatwoot  (mcp-chatwoot, 129 tools)
             • Command Center            /v1/ai/chat  ◀ agent ───┼─▶ TryPost   (MCP: draft/schedule/report)
             • agent chat                /v1/mcp/*                └─▶ n8n       (workflows/events)
             • embedded portals (SSO)
```
One login; GenUI is the pane; the **agent** acts across systems via the orchestrator's MCP host;
sub-systems remain reachable (embedded via SSO portals) but are **orchestrated, not islands**.

---

## U0 — Unblock the edge (make the brain + SSO reachable) — **do first**

Two label fixes in `docker-compose.extended.yml`, then reload:
```yaml
# go-orchestrator service:
- "traefik.http.routers.orchestrator.middlewares=authentik-forwardauth@file"   # was authentik-auth@file
# authentik-server service — pin each router to its service:
- "traefik.http.routers.authentik.service=authentik"
- "traefik.http.routers.authentik-outpost.service=authentik-outpost"
```
```bash
# on the VM
cd /opt/muslimbot/repo/MuslimBot
docker compose --env-file /opt/muslimbot/secrets/muslimbot.env \
  -f docker-compose.yml -f ../docker-compose.extended.yml up -d go-orchestrator authentik-server traefik
```
**Status (applied + verified live 2026-07-18):** ✅ both label fixes applied on the VM and pushed to git.
`auth.` now returns **302 → Authentik login** (SSO backbone online); the orchestrator router now loads
with `authentik-forwardauth@file` attached. `api.` still returns **404 — expected**: its ForwardAuth
calls `authentik-server:9000/outpost.goauthentik.io/auth/traefik`, which currently 404s because
**Authentik has no outpost/provider configured yet**. That is the very next step (U1) and is web-UI
gated. Once the embedded outpost exists, `api.` serves (redirect-to-login for humans; pass for
authenticated/token clients).

## U1 — One sign-on across every system

1. **Authentik:** at `auth.<d>` set admin, create the **OIDC provider + application**, enable the
   **embedded ForwardAuth outpost**. Middleware chain (`traefik/dynamic/authentik.yml`):
   `strip-identity-headers` → `authentik-forwardauth` (blank client `X-authentik-*`, then set them).
2. **Protect the unified surfaces** with ForwardAuth: `app.` (GenUI), `n8n.`, `api.` (orchestrator).
   The orchestrator already enforces **G2 trusted-proxy** (`TRUSTED_PROXY_CIDRS=172.28.0.254/32`) so
   only Traefik's hop may assert identity.
3. **Keep ERP reachable for machines:** no ForwardAuth on `erp.` (n8n/webhooks/Socket.IO use
   `Authorization: token`). Wire **ERPNext OIDC** (Social Login Key → Authentik) for human SSO.
4. **GenUI SSO:** set `NEXT_PUBLIC_AUTHENTIK_URL=https://auth.<d>`; the login/signup screens already
   delegate to Authentik. Sub-systems open **inside GenUI** via `/v1/portals/:app/url` (Chatwoot
   magic-link, TryPost/n8n OIDC) — one session, embedded, not separate tabs.

**Verify:** one login into GenUI carries into ERP, Chatwoot, TryPost, n8n without re-auth.

## U2 — Make generative-ui the single brain (agent → orchestrator → MCP)

This is the core of "GenUI manages all sub-systems + ERPNext."

1. **Configure the server brain:** set `GEMINI_API_KEY` (server-side) in the env-file; restart the
   orchestrator. (Stop relying on the browser-side key in `services/gemini.js`.)
2. **Route the agent through the MCP-enabled endpoint.** GenUI's chat currently calls a browser-direct
   router. Point it at the orchestrator's **`POST /v1/ai/chat`** (Gemini function-calling with
   `mcp_list_tools` / `mcp_call` already implemented in `internal/ai/router.go`). Concretely, in
   `hooks/useGenerativeChat.js` / `services/gemini.js`, replace `runNLPRouter`'s direct call with a
   `fetch('/v1/ai/chat', { prompt })`; keep `/v1/ai/generate-ui` for UI rendering and
   `/v1/ai/tool/execute` for ERP writes.
3. **Bundle the Chatwoot MCP runtime:** ensure the orchestrator image has `bun` + the vendored
   `mcp-chatwoot` bind-mounted (Dockerfile is already on `oven/bun`; add the mount — ADR-0001 §7),
   else only TryPost's HTTP MCP connects.

**Verify:** `curl …/v1/mcp/servers` shows `trypost` + `chatwoot` `connected:true`; in GenUI chat,
"what tools can you use?" triggers a real `mcp_list_tools` round-trip.

## U3 — TryPost scheduling automation via the agent (the headline capability)

1. TryPost `Settings → API Keys` → set `TRYPOST_API_TOKEN`; keep `TRYPOST_MCP_ENABLED=true`,
   `TRYPOST_MCP_URL=http://trypost/mcp/trypost`. Restart orchestrator.
2. Add a GenUI **Marketing** quick-action/persona whose prompts flow through `/v1/ai/chat`, so the
   agent can `mcp_call` TryPost tools to **draft, schedule, publish, and report** across the 12
   networks — no custom wrappers. High-stakes actions (publish) confirm first (router rule).

**Verify:** "Draft & schedule 3 LinkedIn posts for next week about our new product" → agent calls
TryPost MCP, returns scheduled items; nothing publishes without confirmation.

## U4 — Chatwoot as full customer support (unified, agent-assisted)

1. **Embedded + SSO:** Chatwoot opens inside GenUI via `/v1/portals/chatwoot/url` (magic-link);
   `CHATWOOT_API_TOKEN` set for the portal + MCP.
2. **Agent-assisted support:** with the Chatwoot MCP (129 tools) live, the GenUI agent can triage,
   label, assign, reply, and pull reports from natural language; pair with `chatwoot-skills` SOPs.
3. **Grounded answers:** wire the **n8n support-RAG workflow** (`configs/n8n/`) — Chatwoot webhook →
   KB/RAG (`/v1/kb`) → suggested/auto reply → human handoff. Loop-guarded.
4. **Cross-system context:** ERP events (new order, low stock) → n8n → Chatwoot note/conversation so
   support sees business context inline.

**Verify:** a customer message in Chatwoot gets an agent-drafted, KB-grounded reply; the GenUI agent
can "summarize open conversations" and "assign #42 to Sales" via MCP.

## U5 — Unified Command Center + cross-system events

- **One dashboard:** the Command Center aggregates live state via `/v1/platform/services` +
  `/v1/mcp/servers` (ERP KPIs, support queue, scheduled posts, workflow health) — the "single pane."
- **Event fabric:** ERPNext doc events → `/v1/events/ingest` (outbox) → n8n → Chatwoot/TryPost, so
  actions in one system ripple to others automatically.

**Verify:** creating an invoice in ERP surfaces in the Command Center activity feed and (per rules)
notifies support/social.

## U6 — Multi-tenant, hardening, go-live

- Close **G10** (tenant resolution fails closed) before onboarding real businesses; per-tenant ERP
  site + Authentik group + Chatwoot account + TryPost workspace + KB corpus (`./setup.sh tenant …`).
- Move off `nip.io` to a real domain + ACME (Cloudflare DNS-01); rotate `changeme` secrets.
- Run `TEST_PLAN_GENUI_ORCHESTRATOR.md` §A–G against the live domain. Backups + a **restore drill**.

---

## Execution order (fastest path to "unified")

1. **U0** (10 min) — the 2 label fixes → `api.`/`auth.` online. *Everything depends on this.*
2. **U2 step 1** — set `GEMINI_API_KEY`; **U1** — Authentik OIDC + ForwardAuth + `NEXT_PUBLIC_AUTHENTIK_URL`.
3. **U3** + **U4** — TryPost + Chatwoot tokens → `/v1/mcp/servers` green → agent drives both.
4. **U2 step 2** — point GenUI chat at `/v1/ai/chat` (the one code change that makes the agent
   MCP-capable inside the UI).
5. **U5/U6** — command center unification, events, tenants, hardening.
