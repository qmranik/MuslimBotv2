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
- `TRYPOST_MCP_URL` — TryPost MCP HTTP endpoint (empty by default; **confirm path** at
  docs.trypost.it/self-hosting — do not hardcode a guess).
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

## 7. Follow-up (deferred, tracked here)

1. **Orchestrator MCP host runtime** — `internal/mcp/` package: HTTP MCP client (TryPost),
   stdio subprocess client (chatwoot), tool discovery + republish to the router, per-tenant
   scoping, timeouts/rate limits. Needs the confirmed TryPost MCP endpoint + integration tests
   → do **after** the restructure Phase 2 (CI repoint) lands.
2. **Vendor** `fazer-ai/mcp-chatwoot` and `fazer-ai/chatwoot-skills` as submodules; bundle
   `bun` into the orchestrator image (or the gateway sidecar).
3. **TryPost deployment** — use the upstream self-host compose; attach to `smb-net`; wire ACME
   router `social.<domain>` (Phase C edge work).
4. **GenUI relabel (front-end, not done here per working-constraint #2)** — rename
   Postiz→TryPost and route `postiz-social`→`trypost-social` across:
   `src/config/systemsTabs.js` (`name`, `href`, `ssoApp`), `src/config/workspaceUrls.js`
   (`NEXT_PUBLIC_WS_POSTIZ_URL`→`..._TRYPOST_URL`), `src/stores/useWorkspaceStore.ts`
   (`title`, `ssoApp`), `src/components/MuslimBotShell.jsx` (route map), `src/components/Sidebar.tsx`,
   `src/components/WorkspaceNav.jsx`, the `src/app/postiz-social/` route dir, and demo copy in
   `src/page-components/*`. The `postiz` portal alias keeps SSO working until this lands.

## 8. Sources
- TryPost — <https://github.com/trypostit/trypost> · <https://docs.trypost.it/>
- mcp-chatwoot — <https://github.com/fazer-ai/mcp-chatwoot> · <https://www.npmjs.com/package/@fazer-ai/mcp-chatwoot>
- chatwoot-skills — <https://github.com/fazer-ai/chatwoot-skills>
- (bonus) n8n community nodes — <https://github.com/fazer-ai/n8n-nodes-chatwoot> (relevant to Workflow 2)
