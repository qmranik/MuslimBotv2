#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f test-silos/docker-compose.silo2.yml -p test-silos"

if [ -f .env ]; then
  set -a
  source .env
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

echo "-> Pre-installing small_erp in virtualenv..."
$COMPOSE exec frappe-web ./env/bin/pip install --no-deps -e /home/frappe/frappe-bench/apps/small_erp

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

echo "-> Installing small_erp from volume mount..."
$COMPOSE exec frappe-web bash -c "
  ./env/bin/pip install --no-deps -e /home/frappe/frappe-bench/apps/small_erp &&
  grep -qxF 'small_erp' sites/apps.txt || echo 'small_erp' >> sites/apps.txt &&
  bench --site $FRAPPE_SITE_NAME install-app small_erp
"

echo "-> Building frontend assets..."
$COMPOSE exec frappe-web bench build --app small_erp

echo "-> Running migrations..."
$COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" migrate

echo "-> Setting up SMB permissions..."
$COMPOSE exec frappe-web bench --site "$FRAPPE_SITE_NAME" execute small_erp.setup_permissions.run || true
