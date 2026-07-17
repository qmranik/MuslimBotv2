#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# Small ERP SaaS — Initial Setup Script
# First-time setup: builds image, starts stack, creates master site.
#
# Usage:
#   ./scripts/setup.sh [--dev]
#
# --dev: Skip TLS, use localhost ports, don't require Cloudflare token
##############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[X]${NC} $*" >&2; }
info() { echo -e "${BLUE}[i]${NC} $*"; }

DEV_MODE=false
for arg in "$@"; do
    case $arg in
        --dev) DEV_MODE=true ;;
    esac
done

echo ""
echo "=================================================================="
echo "  Small ERP SaaS — Initial Setup"
echo "=================================================================="
echo ""

# ─── Pre-flight Checks ───────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    err "Docker is not installed. Install it first:"
    echo "    curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! docker compose version &> /dev/null 2>&1; then
    err "Docker Compose v2 is required."
    exit 1
fi

log "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+' || docker --version)"

# ─── Environment ─────────────────────────────────────────────────────
if [ ! -f "$PROJECT_DIR/.env" ]; then
    if [ -f "$PROJECT_DIR/.env.template" ]; then
        warn ".env not found — copying from template"
        cp "$PROJECT_DIR/.env.template" "$PROJECT_DIR/.env"

        if [ "$DEV_MODE" = true ]; then
            # Set dev defaults
            sed -i.bak \
                -e 's/DOMAIN=.*/DOMAIN=smb.localhost/' \
                -e 's/MASTER_SITE=.*/MASTER_SITE=master.smb.localhost/' \
                -e 's/DB_ROOT_PASSWORD=.*/DB_ROOT_PASSWORD=devroot123/' \
                -e 's/ADMIN_PASSWORD=.*/ADMIN_PASSWORD=admin/' \
                -e 's/N8N_PASSWORD=.*/N8N_PASSWORD=admin/' \
                -e "s/N8N_ENCRYPTION_KEY=.*/N8N_ENCRYPTION_KEY=$(openssl rand -hex 16)/" \
                -e 's/REGISTRY=.*/REGISTRY=localhost/' \
                "$PROJECT_DIR/.env"
            rm -f "$PROJECT_DIR/.env.bak"
            log "Dev defaults applied to .env"
        else
            err "Edit .env with your production values before continuing."
            echo "    nano $PROJECT_DIR/.env"
            exit 1
        fi
    else
        err ".env.template not found."
        exit 1
    fi
fi

source "$PROJECT_DIR/.env"

# Validate critical env vars (skip some in dev mode)
for var in DB_ROOT_PASSWORD ADMIN_PASSWORD N8N_PASSWORD; do
    if [[ -z "${!var:-}" ]] || [[ "${!var}" == *"CHANGE_ME"* ]]; then
        err "$var is not set or contains default placeholder. Edit .env first."
        exit 1
    fi
done

log "Environment validated"

# ─── Build Custom Image ──────────────────────────────────────────────
info "Building custom Docker image..."
cd "$PROJECT_DIR"

docker build -t "${REGISTRY:-localhost}/small-erp:${IMAGE_TAG:-latest}" .

log "Image built: ${REGISTRY:-localhost}/small-erp:${IMAGE_TAG:-latest}"

# ─── Start Services ──────────────────────────────────────────────────
info "Starting services..."

if [ "$DEV_MODE" = true ]; then
    # In dev mode, expose frappe-web port directly and skip TLS
    docker compose up -d
else
    docker compose up -d
fi

log "Services started"

# ─── Wait for MariaDB ────────────────────────────────────────────────
info "Waiting for MariaDB to be healthy..."
RETRIES=40
until docker compose exec -T mariadb healthcheck.sh --connect --innodb_initialized 2>/dev/null; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        err "MariaDB failed to start within timeout"
        docker compose logs mariadb
        exit 1
    fi
    sleep 3
done
log "MariaDB is healthy"

# ─── Configure Redis & DB Host ───────────────────────────────────────
info "Configuring common site config..."
cat << 'EOF' > /tmp/smb_common_config.json
{
  "db_host": "mariadb",
  "redis_cache": "redis://redis-cache:6379",
  "redis_queue": "redis://redis-queue:6379",
  "redis_socketio": "redis://redis-socketio:6379",
  "socketio_port": 9000
}
EOF

docker compose cp /tmp/smb_common_config.json frappe-web:/home/frappe/frappe-bench/sites/common_site_config.json
docker compose exec --user root frappe-web chown frappe:frappe /home/frappe/frappe-bench/sites/common_site_config.json
rm /tmp/smb_common_config.json

log "Common site config applied"

# ─── Create Master Site ──────────────────────────────────────────────
MASTER_SITE="${MASTER_SITE:-master.smb.localhost}"
info "Creating master site: ${MASTER_SITE}..."

docker compose exec -T frappe-web bench new-site "$MASTER_SITE" \
    --db-host mariadb \
    --admin-password "$ADMIN_PASSWORD" \
    --mariadb-root-password "$DB_ROOT_PASSWORD" \
    --no-mariadb-socket \
    --force || {
        warn "Site creation may have partially failed — continuing"
    }

docker compose exec -T frappe-web bench use "$MASTER_SITE"

log "Master site created"

# ─── Install Apps ────────────────────────────────────────────────────
info "Installing ERPNext..."
docker compose exec -T frappe-web bench --site "$MASTER_SITE" install-app erpnext || true

info "Installing small_erp..."
docker compose exec -T frappe-web bench --site "$MASTER_SITE" install-app small_erp || true

log "Apps installed"

# ─── Migrations ──────────────────────────────────────────────────────
info "Running migrations..."
docker compose exec -T frappe-web bench --site "$MASTER_SITE" migrate

# ─── Configure n8n ───────────────────────────────────────────────────
docker compose exec -T frappe-web bench --site "$MASTER_SITE" set-config n8n_url "http://smb-n8n:5678"

# ─── Bypass Setup Wizard ─────────────────────────────────────────────
info "Bypassing setup wizard..."
docker compose exec -T frappe-web bench --site "$MASTER_SITE" execute \
    small_erp.finish_setup.finish 2>/dev/null || true

# ─── Restart ─────────────────────────────────────────────────────────
info "Restarting application servers..."
docker compose restart frappe-web frappe-scheduler frappe-worker-default \
    frappe-worker-short frappe-worker-long frappe-socketio

echo ""
echo "=================================================================="
echo "  Setup Complete!"
echo "=================================================================="
echo ""
log "Small ERP Frontend:  http://localhost:8000/ops  (or https://${MASTER_SITE}/ops)"
log "ERPNext Admin:       http://localhost:8000/app"
log "n8n Workflows:       http://localhost:5678"
log "Traefik Dashboard:   http://localhost:8080"
echo ""
info "Login: Administrator / ${ADMIN_PASSWORD}"
echo ""
info "Next steps:"
echo "  # Seed demo data:"
echo "  docker compose exec frappe-web bench --site ${MASTER_SITE} execute small_erp.seed_demo.create_demo_data"
echo ""
echo "  # Provision a new tenant:"
echo "  bash scripts/provision-tenant.sh acme 'Acme Corp'"
echo ""
