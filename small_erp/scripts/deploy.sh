#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# Small ERP — Production Deployment Script
# Usage: ./scripts/deploy.sh [--skip-harden] [--dev]
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

SKIP_HARDEN=false
DEV_MODE=false

for arg in "$@"; do
    case $arg in
        --skip-harden) SKIP_HARDEN=true ;;
        --dev) DEV_MODE=true ;;
    esac
done

##############################################################################
# 1. Pre-flight Checks
##############################################################################
echo ""
echo "=================================================================="
echo "  Small ERP — Deployment"
echo "  ERPNext + HTMX Frontend + n8n AI Engine"
echo "=================================================================="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    err "Docker is not installed. Install it first:"
    echo "    curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
    err "Docker Compose v2 is not available."
    exit 1
fi

log "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+' || docker --version)"

# Check .env
if [ ! -f "$PROJECT_DIR/.env" ]; then
    if [ -f "$PROJECT_DIR/.env.template" ]; then
        warn ".env not found -- copying from template"
        cp "$PROJECT_DIR/.env.template" "$PROJECT_DIR/.env"
        err "IMPORTANT: Edit .env with your actual values before proceeding!"
        echo "    nano $PROJECT_DIR/.env"
        exit 1
    else
        err ".env.template not found. Cannot proceed."
        exit 1
    fi
fi

source "$PROJECT_DIR/.env"

# Validate critical env vars
for var in DB_ROOT_PASSWORD DB_PASSWORD ADMIN_PASSWORD N8N_PASSWORD; do
    if [[ -z "${!var:-}" ]] || [[ "${!var}" == *"CHANGE_ME"* ]]; then
        err "$var is not set or contains default value. Edit .env first."
        exit 1
    fi
done

log "Environment validated"

##############################################################################
# 2. Server Hardening (optional, production only)
##############################################################################
if [ "$SKIP_HARDEN" = false ] && [ "$DEV_MODE" = false ]; then
    info "Hardening server..."

    if command -v ufw &> /dev/null; then
        sudo ufw default deny incoming
        sudo ufw default allow outgoing
        sudo ufw allow ssh
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        sudo ufw --force enable
        log "Firewall configured (SSH, HTTP, HTTPS only)"
    else
        warn "ufw not found -- skipping firewall setup"
    fi

    if [ -f /etc/ssh/sshd_config ]; then
        sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
        sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
        sudo systemctl reload sshd 2>/dev/null || true
        log "SSH hardened (root login disabled, password auth disabled)"
    fi

    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y unattended-upgrades > /dev/null 2>&1 || true
        log "Unattended upgrades enabled"
    fi
else
    warn "Server hardening skipped"
fi

##############################################################################
# 3. Pull Images & Start Services
##############################################################################
info "Pulling Docker images (this may take a while on first run)..."
cd "$PROJECT_DIR"
docker compose pull

info "Starting services..."
docker compose up -d

log "Services started. Waiting for MariaDB to be healthy..."
sleep 10

RETRIES=30
until docker compose exec -T mariadb healthcheck.sh --connect --innodb_initialized 2>/dev/null; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        err "MariaDB failed to start within timeout"
        docker compose logs mariadb
        exit 1
    fi
    sleep 2
done
log "MariaDB is healthy"

##############################################################################
# 4. Initialize Frappe Site + Install ERPNext
##############################################################################
info "Checking if Frappe site exists..."

SITE_EXISTS=$(docker compose exec -T frappe-web bench --site "$FRAPPE_SITE_NAME" list-apps 2>/dev/null || echo "NOT_FOUND")

if [[ "$SITE_EXISTS" == *"NOT_FOUND"* ]] || [[ "$SITE_EXISTS" == *"does not exist"* ]]; then
    info "Creating new Frappe site: $FRAPPE_SITE_NAME"
    docker compose exec -T frappe-web bench new-site "$FRAPPE_SITE_NAME" \
        --db-host mariadb \
        --db-port 3306 \
        --db-name "$DB_NAME" \
        --db-password "$DB_PASSWORD" \
        --admin-password "$ADMIN_PASSWORD" \
        --mariadb-root-password "$DB_ROOT_PASSWORD" \
        --no-mariadb-socket

    info "Installing ERPNext..."
    docker compose exec -T frappe-web bench --site "$FRAPPE_SITE_NAME" install-app erpnext

    log "Frappe site created and ERPNext installed"
else
    log "Site already exists -- skipping creation"
fi

##############################################################################
# 5. Install Custom App (small_erp)
##############################################################################
info "Installing small_erp custom app..."

# Ensure inner module directory exists
mkdir -p small_erp_app/small_erp/small_erp && touch small_erp_app/small_erp/small_erp/__init__.py

# Copy app to container
docker compose exec frappe-web rm -rf /home/frappe/frappe-bench/apps/small_erp
docker compose cp small_erp_app/small_erp frappe-web:/home/frappe/frappe-bench/apps/
docker compose exec --user root frappe-web chown -R frappe:frappe /home/frappe/frappe-bench/apps/small_erp

# Register and install
docker compose exec frappe-web bash -c "
  ./env/bin/pip install -e /home/frappe/frappe-bench/apps/small_erp &&
  grep -qxF 'small_erp' sites/apps.txt || echo 'small_erp' >> sites/apps.txt &&
  bench --site $FRAPPE_SITE_NAME install-app small_erp
" 2>/dev/null || \
    docker compose exec -T frappe-web bench --site "$FRAPPE_SITE_NAME" migrate

# Build assets
docker compose exec -T frappe-web bench build --app small_erp

log "small_erp app installed and assets built"

##############################################################################
# 6. Configure n8n API Credentials
##############################################################################
info "Configuring Frappe site for n8n integration..."
docker compose exec -T frappe-web bench --site "$FRAPPE_SITE_NAME" set-config n8n_url "http://small-n8n:5678"

log "n8n integration configured"

##############################################################################
# 7. Setup Backup Cron (production only)
##############################################################################
if [ "$DEV_MODE" = false ]; then
    info "Setting up automated backups..."
    CRON_CMD="0 2 * * * cd $PROJECT_DIR && bash scripts/backup.sh >> /var/log/small-erp-backup.log 2>&1"
    (crontab -l 2>/dev/null | grep -v "small-erp-backup"; echo "$CRON_CMD") | crontab -
    log "Daily backup cron installed (2:00 AM)"
fi

##############################################################################
# 8. Final Status
##############################################################################
echo ""
echo "=================================================================="
echo "  Deployment Complete!"
echo "=================================================================="
echo ""
log "Small ERP Frontend:  http://localhost:8000/ops"
log "ERPNext Admin:       http://localhost:8000/app"
log "n8n Workflows:       http://localhost:5678"
echo ""
info "Default admin credentials: Administrator / ${ADMIN_PASSWORD}"
warn "Change admin password immediately after first login!"
echo ""
info "Service status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
