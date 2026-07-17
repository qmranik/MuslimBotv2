# ADR-0001 — Social = TryPost (MCP-native); Chatwoot agentic layer = fazer-ai/mcp-chatwoot

**Status:** Accepted (owner directive, 2026-07-18) · **Supersedes:** Postiz in G11
**Scope:** marketing/social tier + Chatwoot control plane + orchestrator MCP host layer

---

## 1. Context

The GenUI AI drives the platform through the Go orchestrator (`/v1/*`). Historically the
marketing tier was **Postiz** (heavy: ~6 GB with Temporal + Elasticsearch; iframe/OIDC
portal only — no agentic surface), and Chatwoot was reachable only through a hand-written
SSO/portal bridge plus a couple of REST calls. Neither exposed a **tool surface** the AI
could drive natively, so every new capability meant hand-coding REST wrappers.

## 2. Decision

1. **Replace Postiz with [TryPost](https://github.com/trypostit/trypost)** (AGPL; Laravel 13
   / Vue 3 / Horizon). TryPost ships a **first-class MCP server + REST API**. The orchestrator
   ingests TryPost's MCP directly, so the AI can **draft, schedule, publish, and read
   analytics** across 12 networks with **no custom API tool wrappers**.
2. **Add [`@fazer-ai/mcp-chatwoot`](https://github.com/fazer-ai/mcp-chatwoot)** (TypeScript +
   Bun) as the Chatwoot agentic layer — **129 MCP tools** spanning conversations (20+),
   admin/config (30+: inboxes, teams, agents, webhooks, automation), reporting/analytics (9),
   contacts/CRM (11), and Help Center / KB (complements the Nextcloud RAG plan).
3. **Adopt [`fazer-ai/chatwoot-skills`](https://github.com/fazer-ai/chatwoot-skills)** — SKILL.md
   SOPs that teach the model to route the 129 tools — vendored and surfaced to the router prompt.

## 3. Architecture — orchestrator as MCP host

The orchestrator becomes an **MCP host**: it connects to each enabled MCP server and
republishes their tools to the GenUI AI (`internal/ai/router.go`). Servers are declared in
[`mcp-servers/registry.yaml`](../../mcp-servers/registry.yaml).

| Server | Transport | How the orchestrator reaches it | Auth |
|---|---|---|---|
| **trypost** | **HTTP/SSE** | connects to `TRYPOST_MCP_URL` as an MCP client | bearer `TRYPOST_API_TOKEN` |
| **chatwoot** (fazer-ai) | **stdio** | **spawns** `bun run start` as a subprocess (NOT a compose port-service); `account_id` is per-tool | reuses `CHATWOOT_URL` + `CHATWOOT_API_TOKEN` |

> Transport asymmetry is deliberate and load-bearing: TryPost is a networked service;
> mcp-chatwoot is a local stdio process. A future MCP-gateway sidecar may bridge stdio→HTTP
> if we want the two treated uniformly, but that is not required for v1.

## 4. Configuration (env only — no secrets in-repo, fail loud when required)

Added to `internal/config/config.go` and `docker-compose.extended.yml`:

- `TRYPOST_URL` — embeddable portal URL (supersedes `POSTIZ_URL`, kept as a deprecated fallback).
- `TRYPOST_MCP_URL` — TryPost MCP endpoint. Confirmed: `<trypost-host>/mcp/trypost`
  (internal `http://trypost/mcp/trypost`), bearer auth. Source: docs.trypost.it/ai/introduction.
- `TRYPOST_API_TOKEN` — bearer for MCP/REST.
- `TRYPOST_MCP_ENABLED` / `CHATWOOT_MCP_ENABLED` — per-server gates.
- Chatwoot MCP reuses existing `CHATWOOT_URL` + `CHATWOOT_API_TOKEN` — **no new secret**.

## 5. Security

- Secrets only via env; a server enabled without its required token **must fail loud** (no
  `changeme`/default). The launcher `scripts/mcp/run-chatwoot-mcp.sh` enforces this with `:?`.
- Tenant scoping: MCP tool calls must carry the caller's tenant context; do not let the AI
  address another tenant's Chatwoot account/TryPost workspace. (Ties into gap G10 — fail closed.)
- Honor the existing rule: never expose raw API keys to the model (router prompt rule #1).

## 6. What changed in this commit (done)

- **Go:** `config.go` (TryPost + MCP fields, `POSTIZ_URL` alias), `portals/handler.go`
  (`case "trypost"`, `postiz` kept as deprecated alias), `ai/router.go` (prompt now names
  TryPost + MCP tools). `go build ./...` + `go vet` clean.
- **Compose:** `docker-compose.extended.yml` env swap (TryPost + MCP gates);
  `docker-compose.yml` header/comment updates.
- **mcp-servers/:** `registry.yaml`, `chatwoot-mcp/README.md`, `trypost-mcp/README.md`,
  `scripts/mcp/run-chatwoot-mcp.sh` (fail-loud launcher).

## 6b. Also implemented (this iteration)

- **Orchestrator MCP host runtime** — `internal/mcp/` (JSON-RPC 2.0 client for HTTP + stdio,
  lazy per-server connect, tool discovery, tool-call). Exposed at `GET /v1/mcp/servers`,
  `GET /v1/mcp/tools`, `POST /v1/mcp/call`. Unit-tested over HTTP (`internal/mcp/client_test.go`).
- **AI agent function-calling** — `internal/ai/router.go` gives Gemini `mcp_list_tools` + `mcp_call`
  and runs a tool loop, so GenUI's `/v1/ai/chat` drives Chatwoot + TryPost tools with no client changes.
- **TryPost deployment stack** — `docker-compose.extended.yml`: `trypost` (build from vendored
  source), `trypost-postgres` (PG18), `trypost-horizon`, `trypost-scheduler`, Traefik router
  `social.smb.localhost`, fail-loud secrets (`TRYPOST_APP_KEY`, `TRYPOST_DB_PASSWORD`).
- **GenUI relabel** — Postiz→TryPost across `systemsTabs.js`, `workspaceUrls.js`,
  `useWorkspaceStore.ts`, `MuslimBotShell.jsx`, `Sidebar.tsx`, `WorkspaceNav.jsx`, and the
  `app/postiz-social`→`app/trypost-social` route (git-renamed). `ssoApp: 'trypost'`; `postiz` alias retained.

## 7. Follow-up (still deferred)

1. **Vendor** `trypostit/trypost`, `fazer-ai/mcp-chatwoot`, `fazer-ai/chatwoot-skills` as submodules;
   **bundle `bun`** into the orchestrator image so the stdio Chatwoot MCP can spawn (else only TryPost
   HTTP tools are available).
2. **Live e2e** — `GEMINI_API_KEY` + running TryPost/Chatwoot needed to exercise the agent tool loop
   (`TEST_PLAN_GENUI_ORCHESTRATOR.md` §E). Build/vet/unit-tests pass; live calls are unverified here.
3. **Per-tenant scoping** of MCP tool calls (fail closed) — ties into gap G10; enforce before onboarding.
4. **CI** — add `/v1/mcp/servers` health assertion; repoint paths (restructure Phase 2 / P2).

## 8. Sources
- TryPost — <https://github.com/trypostit/trypost> · <https://docs.trypost.it/>
- mcp-chatwoot — <https://github.com/fazer-ai/mcp-chatwoot> · <https://www.npmjs.com/package/@fazer-ai/mcp-chatwoot>
- chatwoot-skills — <https://github.com/fazer-ai/chatwoot-skills>
- (bonus) n8n community nodes — <https://github.com/fazer-ai/n8n-nodes-chatwoot> (relevant to Workflow 2)
