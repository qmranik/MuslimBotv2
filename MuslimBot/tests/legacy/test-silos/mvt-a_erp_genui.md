# MVT Silo A — ERP + GenUI

RAM target ~3.5 GB Docker (less with cloud MariaDB/Redis). Go and GenUI run natively.

## Local DBs

```bash
docker compose -f test-silos/docker-compose.mvt-a.yml --env-file .env up -d
```

## Cloud DBs

```bash
cp .env.mvt.cloud.template .env.mvt.cloud
# fill Neon / Upstash / MariaDB values

docker compose \
  -f test-silos/docker-compose.mvt-a.yml \
  -f test-silos/docker-compose.mvt-a.cloud.override.yml \
  --env-file .env.mvt.cloud \
  up -d
```

Local `mariadb` and `redis` stay off (profile `mvt-local-db`).

## Install / seed (first time)

Reuse silo2 helpers or:

```bash
bash small_erp/scripts/install-local.sh
```

Generate Frappe API keys and put them in the shell env for Go.

## Native services

```bash
cd go-orchestrator
export ENV=local
export PORT=8080
export FRAPPE_URL=http://localhost:8000
export FRAPPE_API_KEY=…
export FRAPPE_API_SECRET=…
go run ./cmd/server
```

```bash
cd generative-ui
npm run dev
```

## Acceptance

1. `curl -sS http://localhost:8080/v1/auth/me` → Administrator, `"auth":"local-bypass"`.
2. In GenUI Command Center: ask to fetch low stock items.
3. Confirm inventory data from Frappe.

Or invoke skill `mvt-silo-verify`.

## Teardown

```bash
docker compose -f test-silos/docker-compose.mvt-a.yml down
```

Bring Silo A down before starting Silo B unless both use cloud DBs only.
