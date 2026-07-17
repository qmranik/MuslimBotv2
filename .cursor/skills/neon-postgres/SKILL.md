---
name: neon-postgres
description: >-
  Manage Neon serverless Postgres via neonctl CLI and Neon MCP for MuslimBot/liteERP
  MVT. Use when creating projects/branches/databases, running SQL on Neon, fetching
  connection strings, or provisioning chatwoot/orchestrator DBs for cloud offload.
disable-model-invocation: true
---

# Neon Postgres (CLI + MCP)

## Tooling

| Tool | When |
|---|---|
| MCP `neon` (project `.cursor/mcp.json`) | Agent CRUD: projects, branches, SQL, connection URIs |
| Cursor plugin `plugin-neon-postgres-neon` | Alternate Neon MCP (OAuth via `mcp_auth`) |
| MCP `postgres-mcp` | Query a specific DB when `DATABASE_URL` points at Neon |
| CLI `neonctl` | Shell/scripts; same operations as MCP |

Install / refresh CLI:

```bash
npm install -g neonctl@latest
neonctl --version
```

## Auth

1. **Preferred for Cursor:** MCP server `neon` uses remote `https://mcp.neon.tech/mcp` (OAuth). Enable it in Cursor Settings → MCP, complete browser auth once.
2. **Connection strings** for SQL live in gitignored `.cursor/mcp.secrets.env` (`DATABASE_URL`). MCP `postgres-mcp` loads that file via `scripts/mcp/run-postgres-mcp.sh`.
3. **Optional local Neon MCP:** set `NEON_API_KEY` in `.cursor/mcp.secrets.env` and use server `neon-local`.
4. Never commit `.cursor/mcp.secrets.env` or paste passwords into chat.

## MCP workflow

1. `GetMcpTools` on server `neon` (or `plugin-neon-postgres-neon` if that is the one authenticated).
2. If `needsAuth`, call `mcp_auth` once and wait for the user.
3. List projects; use or create `muslimbot-mvt`.
4. Ensure databases `chatwoot` and `orchestrator` exist.
5. On `chatwoot`: `CREATE EXTENSION IF NOT EXISTS vector`.
6. Fetch **pooled** URI for apps and **direct** URI for migrations (`sslmode=require`).

## CLI workflow

```bash
neonctl projects list
neonctl connection-string <project_id> --database-name chatwoot --pooled
neonctl connection-string <project_id> --database-name chatwoot
neonctl query --project-id <id> --database chatwoot --query "SELECT 1"
```

Exact subcommands may vary by `neonctl` version — run `neonctl --help` / `neonctl <cmd> --help`.

## liteERP / MVT mapping

| Neon DB | Consumer |
|---|---|
| `chatwoot` | Chatwoot Rails / Sidekiq |
| `orchestrator` | Go `DATABASE_URL` (optional) |
| `neondb` | Scratch / default |

Wire results into `.env.mvt.cloud` keys: `NEON_PG_HOST_POOLER`, `NEON_PG_HOST_DIRECT`, `CHATWOOT_DB_*`, `DATABASE_URL`. See skill `mvt-cloud-offload`.

## Related

- [docs/MVT_CLOUD_OFFLOAD.md](../../../docs/MVT_CLOUD_OFFLOAD.md)
- skill `mvt-cloud-offload`
- skill `upstash-redis`
