---
name: mvt-cloud-offload
description: >-
  Offloads MuslimBot/liteERP databases to free-tier Neon Postgres, Upstash Redis,
  and cloud MariaDB for 8GB M1 MVT. Use when the user mentions MVT, 8GB Mac,
  OrbStack, cloud offload, Neon, Upstash, or concurrent Silo A/B without local DBs.
disable-model-invocation: true
---

# MVT Cloud Offload

Move Postgres/Redis/MariaDB off the 8GB M1 so OrbStack only runs app containers.

## Before you start

1. Read [docs/MVT_CLOUD_OFFLOAD.md](../../../docs/MVT_CLOUD_OFFLOAD.md) and [.env.mvt.cloud.template](../../../.env.mvt.cloud.template).
2. Never read or paste real `.env.mvt.cloud` secrets into chat. Write secrets via shell to the local file only.
3. Prefer OrbStack over Docker Desktop.

## Neon (MCP + CLI preferred)

Prefer skill `neon-postgres`.

1. Ensure `NEON_API_KEY` is set (Cursor env / shell). MCP server id: `neon`.
2. Or use Cursor plugin `plugin-neon-postgres-neon` with `mcp_auth`.
3. Create/reuse project `muslimbot-mvt`. Databases: `chatwoot`, `orchestrator`. On `chatwoot`: `CREATE EXTENSION IF NOT EXISTS vector`.
4. Capture **pooled** host for apps and **direct** host for migrations. Require `sslmode=require`.
5. Write hosts into `.env.mvt.cloud` via shell only (no secrets in chat).
6. Export `DATABASE_URL` to Neon pooled URI; use `postgres-mcp` for `SELECT 1`.

CLI: `npm install -g neonctl@latest` then `neonctl projects list`.

## Upstash (MCP + CLI preferred)

Prefer skill `upstash-redis`.

1. Ensure `UPSTASH_EMAIL` and `UPSTASH_API_KEY` are set. MCP server id: `upstash`.
2. Create four Redis DBs (no `SELECT` support):
   - `mvt-chatwoot`
   - `mvt-frappe-cache`
   - `mvt-frappe-queue`
   - `mvt-frappe-socketio`
3. Store TLS URLs as `rediss://…` in `.env.mvt.cloud`.
4. Verify: `redis-cli --tls -u "$UPSTASH_CHATWOOT_REDIS_URL" PING` → `PONG`.
5. If Chatwoot/Frappe RQ misbehaves on Upstash, fall back to local Redis for that consumer; keep Neon for Postgres.

CLI: `npm install -g @upstash/cli@latest` then `upstash redis list`.
Or: `bash scripts/install-mvt-cloud-clis.sh`.

## MariaDB / MySQL

1. Prefer Aiven MariaDB or Clever Cloud MySQL free/trial. Set `CLOUD_MARIADB_*` in `.env.mvt.cloud`.
2. Verify with `mysql -h … -e 'SELECT 1'`.
3. If no free MariaDB is available, keep local MariaDB at 512M buffer (Postgres+Redis cloud still helps).

## Boot cloud mode

```bash
cp .env.mvt.cloud.template .env.mvt.cloud
# fill secrets locally

docker compose \
  -f test-silos/docker-compose.mvt-a.yml \
  -f test-silos/docker-compose.mvt-a.cloud.override.yml \
  --env-file .env.mvt.cloud \
  up -d

docker compose \
  -f test-silos/docker-compose.mvt-b.yml \
  -f test-silos/docker-compose.mvt-b.cloud.override.yml \
  --env-file .env.mvt.cloud \
  up -d
```

Confirm `docker compose … config` does not start local `mariadb` / `postgres` / `redis` when the override is applied.

## After DBs are ready

- Native Go: `ENV=local` (see auth bypass in go-orchestrator).
- Use skill `mvt-silo-verify` for acceptance.
- Use skill `github-cli` only if opening a PR for MVT files.

## Related

- [docs/MVT_8GB_M1.md](../../../docs/MVT_8GB_M1.md)
- [reference.md](reference.md)
- skill `neon-postgres`
- skill `upstash-redis`
- skill `mvt-silo-verify`
