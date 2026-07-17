# Chatwoot MCP Server (`@fazer-ai/mcp-chatwoot`)

Agentic control plane for Chatwoot, exposed to the GenUI AI via the go-orchestrator's
MCP host layer. Upstream: [`fazer-ai/mcp-chatwoot`](https://github.com/fazer-ai/mcp-chatwoot)
(TypeScript + Bun). Registered in [`../registry.yaml`](../registry.yaml).

## Purpose
Full-API-parity agentic management of a Chatwoot instance — **129 MCP tools**:

- **Conversations (20+):** lifecycle, assignment, labeling, advanced filtering.
- **Admin & config (30+):** provision inboxes, create teams, add agents, configure
  webhooks, set up automation rules.
- **Reporting & analytics (9):** V1/V2 reports, first-response times, performance
  metrics — surfaced in the GenUI Command Center.
- **Contacts (11):** CRM ops incl. bulk operations and contact merging.
- **Help Center / KB:** portals, categories, articles — complements the Nextcloud RAG plan.

## Transport
**stdio.** This is a local process the orchestrator (or an MCP gateway sidecar) spawns
and talks to over stdin/stdout. It is **not** a compose port-service. `account_id` is
passed per-tool, not as a global env var.

## Configuration (env only — no secrets in this repo)
| Upstream var | Sourced from | Notes |
|---|---|---|
| `CHATWOOT_BASE_URL` | `CHATWOOT_URL` | existing platform config |
| `CHATWOOT_API_TOKEN` | `CHATWOOT_API_TOKEN` | existing platform secret; fail loud if unset |

Gated by `CHATWOOT_MCP_ENABLED` (see `docker-compose.extended.yml`).

## Install (vendored)
Track upstream as a submodule so the orchestrator image can `bun install && bun run start`:

```bash
git submodule add https://github.com/fazer-ai/mcp-chatwoot vendor/mcp-chatwoot
# launcher: ../../scripts/mcp/run-chatwoot-mcp.sh
```

## Agent SOPs
Pair with [`fazer-ai/chatwoot-skills`](https://github.com/fazer-ai/chatwoot-skills) —
SKILL.md operating procedures that teach the model how to route the 129 tools. Vendor
under `vendor/chatwoot-skills/` and expose to the router's system prompt.

## Status
Scaffold only. The orchestrator MCP host runtime (spawn + tool republish) is the
implementation follow-up tracked in ADR-0001 — see `../../docs/architecture/`.
