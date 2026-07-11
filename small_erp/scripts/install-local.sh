#!/bin/bash
set -e

##############################################################################
# Small ERP — Local Development Setup (docker-compose.local.yml)
#
# Uses volume-mounted small_erp source — no docker compose cp for the app.
# Run from anywhere; operates on repo root compose file.
#
#   cp .env.template .env   # at repo root
#   docker compose -f docker-compose.local.yml up -d
#   bash small_erp/scripts/install-local.sh
##############################################################################

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.local.yml"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
elif [ -f small_erp/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source small_erp/.env
  set +a
fi

FRAPPE_SITE_NAME="${FRAPPE_SITE_NAME:-small.localhost}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:?Set DB_ROOT_PASSWORD in .env}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Set ADMIN_PASSWORD in .env}"

echo "-> Waiting for MariaDB..."
until $COMPOSE exec mariadb mysqladmin ping -u root -p"$DB_ROOT_PASSWORD" --silent 2>/dev/null; do
  echo "  (Still waiting for DB connection...)"
  sleep 3
done

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

echo "-> Ensuring inner module package exists (volume mount)..."
mkdir -p small_erp/small_erp_app/small_erp/small_erp
touch small_erp/small_erp_app/small_erp/small_erp/__init__.py

echo "-> Creating Frappe site: $FRAPPE_SITE_NAME"
$COMPOSE exec frappe-web rm -rf "/home/frappe/frappe-bench/sites/$FRAPPE_SITE_NAME" || true
$COMPOSE exec frappe-web bench new-site "$FRAPPE_SITE_NAME" \
  --db-root-password "$DB_ROOT_PASSWORD" \
  --admin-password "$ADMIN_PASSWORD" \
  --db-host mariadb \
  --force \
  --no-mariadb-socket || echo "Site creation failed but continuing..."

$COMPOSE exec frappe-web bench use "$FRAPPE_SITE_NAME"

echo "-> Installing ERPNext..."
$COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" install-app erpnext || true

echo "-> Fixing apps.txt..."
$COMPOSE exec frappe-web bash -c 'printf "frappe\nerpnext\n" > sites/apps.txt'

echo "-> Installing small_erp from volume mount (no docker cp)..."
$COMPOSE exec frappe-web bash -c "
  ./env/bin/pip install -e /home/frappe/frappe-bench/apps/small_erp &&
  grep -qxF 'small_erp' sites/apps.txt || echo 'small_erp' >> sites/apps.txt &&
  bench --site $FRAPPE_SITE_NAME install-app small_erp
"

echo "-> Building frontend assets..."
$COMPOSE exec frappe-web bench build --app small_erp

echo "-> Running migrations..."
$COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" migrate

echo "-> Setting up SMB permissions..."
$COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" execute small_erp.setup_permissions.run || true

if [ -n "${GOOGLE_API_KEY:-}" ]; then
  echo "-> Configuring AI site settings..."
  $COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" set-config n8n_url "http://n8n:5678"
  $COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" set-config google_api_key "$GOOGLE_API_KEY"
fi

echo ""
echo "Done! Restarting Frappe services..."
$COMPOSE restart frappe-web frappe-scheduler frappe-worker-default frappe-worker-short frappe-worker-long frappe-socketio

echo ""
echo "SUCCESS! Local stack ready:"
echo "  HTMX /ops:     http://localhost:${FRAPPE_PORT:-8000}/ops"
echo "  Generative UI: http://localhost:${GENERATIVE_UI_PORT:-5173}"
echo "  n8n:           http://localhost:${N8N_PORT:-5678} (${N8N_USER:-admin}/***)"
echo ""
echo "After Python or template changes:"
echo "  $COMPOSE exec frappe-web bench build --app small_erp"
echo "  $COMPOSE restart frappe-web"
echo "  KB BFF:        http://localhost:8787/health"
echo ""
echo "Next: see wayToDemo.md — import n8n workflows, seed demo data, open Knowledge Hub in generative-ui"
echo ""
echo "Optional Chatwoot:"
echo "  $COMPOSE --profile support up -d"
echo "  $COMPOSE --profile support run --rm chatwoot-rails bundle exec rails db:chatwoot_prepare"
