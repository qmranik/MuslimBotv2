# MVT Silo B — Chatwoot + n8n

RAM target ~3.2 GB Docker (less with Neon + Upstash). ERPNext is offline; mock ERP in n8n.

## Local DBs

```bash
docker compose -f test-silos/docker-compose.mvt-b.yml --env-file .env up -d
```

Prepare Chatwoot DB (first boot runs `configs/postgres/init-mvt-b.sh`). Then:

```bash
docker compose -f test-silos/docker-compose.mvt-b.yml exec chatwoot-rails bundle exec rails db:chatwoot_prepare
```

## Cloud DBs

```bash
docker compose \
  -f test-silos/docker-compose.mvt-b.yml \
  -f test-silos/docker-compose.mvt-b.cloud.override.yml \
  --env-file .env.mvt.cloud \
  up -d
```

Use Neon **direct** host for `db:chatwoot_prepare`, then pooled host for the running app.

## n8n ERP mock

1. Open http://localhost:5678 and create a webhook workflow.
2. Replace any ERP HTTP Request node with a **Set / Code** node returning static JSON, for example:

```json
{
  "ok": true,
  "items": [
    { "item_code": "ITEM-001", "item_name": "Sample SKU", "actual_qty": 2, "warehouse": "Stores" }
  ]
}
```

3. Point Chatwoot inbox webhook at `http://localhost:5678/webhook/<path>` (or an ngrok URL if Chatwoot cannot reach the host).

## Acceptance

1. Send a user message in Chatwoot.
2. Confirm n8n execution runs and uses the mock ERP payload.
3. Confirm reply or handoff path as designed in the workflow.

Or invoke skill `mvt-silo-verify`.

## Teardown

```bash
docker compose -f test-silos/docker-compose.mvt-b.yml down
```
