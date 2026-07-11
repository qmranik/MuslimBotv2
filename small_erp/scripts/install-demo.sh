#!/bin/bash
set -e

##############################################################################
# Small ERP — Demo VM First-Time Setup (docker-compose.yml)
#
# Run after: docker build -t small-erp:latest . && docker compose up -d
# Requires .env at repo root with DB_ROOT_PASSWORD, ADMIN_PASSWORD, etc.
##############################################################################

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

FRAPPE_SITE_NAME="${FRAPPE_SITE_NAME:-small.localhost}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:?Set DB_ROOT_PASSWORD in .env}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Set ADMIN_PASSWORD in .env}"

echo "-> Waiting for MariaDB..."
until $COMPOSE exec mariadb mysqladmin ping -u root -p"$DB_ROOT_PASSWORD" --silent 2>/dev/null; do
  sleep 3
done

echo "-> Waiting for shared Postgres..."
until $COMPOSE exec postgres-shared pg_isready -U postgres -d postgres >/dev/null 2>&1; do
  sleep 3
done

echo "-> Ensuring shared Postgres databases exist..."
bash scripts/configure-postgres-multidb.sh || true

echo "-> Initializing common site config..."
cat << EOF > temp_config.json
{
  "db_host": "mariadb",
  "redis_cache": "redis://redis-cache:6379",
  "redis_queue": "redis://redis-queue:6379",
  "redis_socketio": "redis://redis-socketio:6379",
  "socketio_port": 9000
}
EOF
$COMPOSE cp temp_config.json frappe-web:/home/frappe/frappe-bench/sites/common_site_config.json
$COMPOSE exec --user root frappe-web chown frappe:frappe /home/frappe/frappe-bench/sites/common_site_config.json
rm temp_config.json

if ! $COMPOSE exec frappe-web test -f "/home/frappe/frappe-bench/sites/$FRAPPE_SITE_NAME/site_config.json" 2>/dev/null; then
  echo "-> Creating Frappe site: $FRAPPE_SITE_NAME"
  $COMPOSE exec frappe-web bench new-site "$FRAPPE_SITE_NAME" \
    --db-root-password "$DB_ROOT_PASSWORD" \
    --admin-password "$ADMIN_PASSWORD" \
    --db-host mariadb \
    --force \
    --no-mariadb-socket
  $COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" install-app erpnext
  $COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" install-app small_erp
else
  echo "-> Site exists, running migrate..."
  $COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" migrate
fi

$COMPOSE exec frappe-web bench build --app small_erp
$COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" execute small_erp.setup_permissions.run || true

if [ -n "${GOOGLE_API_KEY:-}" ]; then
  echo "-> Configuring AI site settings (n8n + Gemini for /ops/ai)..."
  $COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" set-config n8n_url "http://n8n:5678"
  $COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" set-config google_api_key "$GOOGLE_API_KEY"
fi

echo "-> Preparing Chatwoot database (first run)..."
$COMPOSE run --rm chatwoot-rails bundle exec rails db:chatwoot_prepare || echo "Chatwoot prepare skipped or already done"

$COMPOSE restart frappe-web frappe-scheduler frappe-worker-default frappe-worker-short frappe-worker-long frappe-socketio chatwoot-rails chatwoot-worker

echo ""
echo "Demo stack ready:"
echo "  /ops:          http://${DEMO_PUBLIC_URL:-localhost}:${FRAPPE_PORT:-8000}/ops"
echo "  Generative UI: http://${DEMO_PUBLIC_URL:-localhost}:${GENERATIVE_UI_PORT:-5173}"
echo "  n8n:           http://${DEMO_PUBLIC_URL:-localhost}:${N8N_PORT:-5678}"
echo "  Chatwoot:      ${CHATWOOT_FRONTEND_URL:-http://localhost:3000}"
echo "  Postiz:        ${POSTIZ_PUBLIC_URL:-http://localhost:4007}"
echo "  Temporal UI:   http://${DEMO_PUBLIC_URL:-localhost}:${TEMPORAL_UI_PORT:-8088}"
echo "  KB BFF:        http://${DEMO_PUBLIC_URL:-localhost}:8787/health"
echo ""
echo "Next steps (see wayToDemo.md):"
echo "  1. Generate FRAPPE_API_KEY/SECRET and add to .env"
echo "  2. Import n8n workflows from small_erp/configs/n8n/ (activate all)"
echo "  3. Seed demo: bench --site $FRAPPE_SITE_NAME execute small_erp.seed_demo.create_demo_data"
echo "  4. Index KB in generative-ui Knowledge Hub"
echo ""
echo "Optional voice worker:"
echo "  docker compose --profile voice up -d"
