# MVT Cloud Offload — Reference

## Env mapping

| Consumer | Variable | Cloud source |
|---|---|---|
| Chatwoot | `POSTGRES_HOST` | Neon pooled hostname |
| Chatwoot | `POSTGRES_PORT` | `5432` |
| Chatwoot | `POSTGRES_DATABASE` | `chatwoot` |
| Chatwoot | `POSTGRES_USERNAME` | `chatwoot` |
| Chatwoot | `POSTGRES_PASSWORD` | Neon role password |
| Chatwoot | `REDIS_URL` | Upstash `mvt-chatwoot` (`rediss://`) |
| Frappe | `DB_HOST` / `DB_PORT` | Cloud MariaDB |
| Frappe | `REDIS_CACHE` | Upstash `mvt-frappe-cache` |
| Frappe | `REDIS_QUEUE` | Upstash `mvt-frappe-queue` |
| Frappe | `REDIS_SOCKETIO` | Upstash `mvt-frappe-socketio` |
| Go | `DATABASE_URL` | Neon `orchestrator` pooled URI (optional) |
| Go | `ENV` | `local` |
| postgres-mcp | `DATABASE_URL` | Neon pooled URI |

## Free-tier limits (approx.)

| Provider | Cap to watch |
|---|---|
| Neon Free | 0.5 GB storage/project, 100 CU-hrs/mo, scale-to-zero after ~5 min |
| Upstash Free | 256 MB, ~500K commands/mo per DB |
| MariaDB free/trial | Provider-specific; treat as ephemeral |

## Neon pooling

- Apps / Sidekiq / Go: **pooled** hostname (`-pooler` in host).
- `rails db:…` / migrations: **direct** hostname.
- Always `sslmode=require`.

## Compose invoke

```bash
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
