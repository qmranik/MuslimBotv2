---
name: upstash-redis
description: >-
  Manage Upstash Redis via @upstash/cli and Upstash MCP for MuslimBot/liteERP MVT.
  Use when creating Redis databases, listing endpoints, rotating tokens, verifying
  TLS rediss:// URLs, or provisioning the four MVT Redis DBs (Chatwoot + Frappe).
disable-model-invocation: true
---

# Upstash Redis (CLI + MCP)

## Tooling

| Tool | When |
|---|---|
| MCP `upstash` (project `.cursor/mcp.json`) | Agent create/list/stats/backups for Redis |
| CLI `upstash` (`@upstash/cli`) | Preferred for scripts; JSON output |
| `redis-cli --tls -u rediss://…` | Connectivity smoke test |

Upstash docs prefer Skill + CLI for many agent flows; this project also wires the official MCP so agents can use either path.

Install / refresh CLI:

```bash
npm install -g @upstash/cli@latest
upstash --version
```

## Auth

1. Upstash Console → Account → API Keys → create a developer API key.
2. Put into gitignored `.cursor/mcp.secrets.env` (not chat):

```bash
UPSTASH_EMAIL=you@example.com
UPSTASH_API_KEY=…
UPSTASH_REDIS_URL=rediss://default:…@….upstash.io:6379
```

3. MCP `upstash` runs `scripts/mcp/run-upstash-mcp.sh`, which loads that file. A Redis URL alone is **not** enough for the management MCP.
4. Or: `upstash login` for the CLI. Reload Cursor MCP after editing secrets.

## Hard constraint (Frappe)

Upstash does **not** support Redis `SELECT` / DB indexes. Create **four** separate databases for MVT:

| Name | Env key |
|---|---|
| `mvt-chatwoot` | `UPSTASH_CHATWOOT_REDIS_URL` / Chatwoot `REDIS_URL` |
| `mvt-frappe-cache` | `UPSTASH_FRAPPE_CACHE_URL` / `REDIS_CACHE` |
| `mvt-frappe-queue` | `UPSTASH_FRAPPE_QUEUE_URL` / `REDIS_QUEUE` |
| `mvt-frappe-socketio` | `UPSTASH_FRAPPE_SOCKETIO_URL` / `REDIS_SOCKETIO` |

Always use TLS URLs (`rediss://…`) for app containers.

Chatwoot Redis cache may call commands Upstash handles poorly (`INFO` via redis-namespace). If Chatwoot pages time out, keep Postgres on Neon and point Chatwoot `REDIS_URL` at a small local Redis; leave Upstash for other consumers or retry after isolating Sidekiq-only usage.

## MCP workflow

1. `GetMcpTools` on server `upstash`.
2. List Redis databases; create any missing `mvt-*` DBs in a region near Neon (e.g. `us-east-1`).
3. Read endpoint + password/token; build `rediss://default:<token>@<endpoint>:6379`.
4. Update `.env.mvt.cloud` without echoing secrets.

## CLI workflow

```bash
upstash redis list
upstash redis create --name mvt-chatwoot --region us-east-1
upstash redis get --db-id <id>
upstash redis stats --db-id <id>
```

Exec via REST (optional):

```bash
upstash redis exec --db-url "$UPSTASH_REDIS_REST_URL" --db-token "$UPSTASH_REDIS_REST_TOKEN" PING
```

Smoke test:

```bash
redis-cli --tls -u "$UPSTASH_CHATWOOT_REDIS_URL" PING
```

## Related

- [docs/MVT_CLOUD_OFFLOAD.md](../../../docs/MVT_CLOUD_OFFLOAD.md)
- skill `mvt-cloud-offload`
- skill `neon-postgres`
