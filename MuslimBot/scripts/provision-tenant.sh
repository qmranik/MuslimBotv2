#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# Small ERP SaaS — Tenant Provisioning Script
# Creates a new tenant site with isolated database on the shared stack.
#
# Usage:
#   ./scripts/provision-tenant.sh <subdomain> <company_name> [admin_password]
#
# Example:
#   ./scripts/provision-tenant.sh acme "Acme Corp" MySecurePass123
#
# What it does:
#   1. Creates Cloudflare DNS A record for <subdomain>.DOMAIN
#   2. Runs bench new-site to create isolated DB + site config
#   3. Installs ERPNext + small_erp apps
#   4. Calls onboard_tenant API to bootstrap company data
#   5. Configures common_site_config.json for multi-tenant routing
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

# ─── Arguments ─────────────────────────────────────────────────────────
SUBDOMAIN="${1:-}"
COMPANY_NAME="${2:-}"
ADMIN_PASS="${3:-}"

if [ -z "$SUBDOMAIN" ] || [ -z "$COMPANY_NAME" ]; then
    echo "Usage: $0 <subdomain> <company_name> [admin_password]"
    echo ""
    echo "  subdomain     : Tenant subdomain (e.g., 'acme' for acme.smb.co)"
    echo "  company_name  : Full company name (e.g., 'Acme Corp')"
    echo "  admin_password: Optional admin password (auto-generated if omitted)"
    exit 1
fi

# ─── Load env ──────────────────────────────────────────────────────────
if [ ! -f "$PROJECT_DIR/.env" ]; then
    err ".env not found. Copy from .env.template and fill in values."
    exit 1
fi

source "$PROJECT_DIR/.env"

SITE_NAME="${SUBDOMAIN}.${DOMAIN}"
ADMIN_PASS="${ADMIN_PASS:-$(openssl rand -base64 16 | tr -dc 'A-Za-z0-9' | head -c 16)}"
DB_NAME="tenant_${SUBDOMAIN//-/_}"

echo ""
echo "=================================================================="
echo "  Small ERP SaaS — Tenant Provisioning"
echo "=================================================================="
echo ""
info "Tenant:   ${SITE_NAME}"
info "Company:  ${COMPANY_NAME}"
info "Database: ${DB_NAME}"
echo ""

# ─── Step 1: Cloudflare DNS Record ────────────────────────────────────
if [ -n "${CF_DNS_API_TOKEN:-}" ] && [ -n "${CF_ZONE_ID:-}" ]; then
    info "Creating DNS record for ${SITE_NAME}..."

    # Get server public IP
    SERVER_IP="${SERVER_IP:-$(curl -s https://api.ipify.org || echo "")}"

    if [ -n "$SERVER_IP" ]; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
            -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
            -H "Content-Type: application/json" \
            --data "{
                \"type\": \"A\",
                \"name\": \"${SUBDOMAIN}\",
                \"content\": \"${SERVER_IP}\",
                \"ttl\": 120,
                \"proxied\": false
            }")

        if [ "$HTTP_CODE" = "200" ]; then
            log "DNS record created: ${SITE_NAME} -> ${SERVER_IP}"
        else
            warn "DNS record creation returned HTTP ${HTTP_CODE} (may already exist)"
        fi
    else
        warn "Could not detect server IP — skipping DNS creation"
    fi
else
    warn "CF_DNS_API_TOKEN or CF_ZONE_ID not set — skipping DNS creation"
    info "Ensure *.${DOMAIN} points to this server via wildcard DNS"
fi

# ─── Step 2: Create Frappe Site ───────────────────────────────────────
info "Creating Frappe site: ${SITE_NAME}..."

# Ensure common_site_config.json has multi-tenant DB host
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T frappe-web \
    bench set-config -g db_host mariadb 2>/dev/null || true

docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T frappe-web \
    bench new-site "$SITE_NAME" \
    --db-host mariadb \
    --db-name "$DB_NAME" \
    --admin-password "$ADMIN_PASS" \
    --mariadb-root-password "$DB_ROOT_PASSWORD" \
    --no-mariadb-socket

log "Site created: ${SITE_NAME}"

# ─── Step 3: Install Apps ─────────────────────────────────────────────
info "Installing ERPNext..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T frappe-web \
    bench --site "$SITE_NAME" install-app erpnext

info "Installing small_erp..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T frappe-web \
    bench --site "$SITE_NAME" install-app small_erp

log "Apps installed on ${SITE_NAME}"

# ─── Step 4: Run Migrations ──────────────────────────────────────────
info "Running migrations..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T frappe-web \
    bench --site "$SITE_NAME" migrate

log "Migrations complete"

# ─── Step 5: Onboard Tenant via API ──────────────────────────────────
info "Bootstrapping tenant data..."

# Generate abbreviation from company name
ABBR=$(echo "$COMPANY_NAME" | awk '{for(i=1;i<=NF && i<=3;i++) printf toupper(substr($i,1,1))}')
[ -z "$ABBR" ] && ABBR="CO"

docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T frappe-web \
    bench --site "$SITE_NAME" execute \
    "small_erp.api.admin.onboard_tenant" \
    --kwargs "{\"company_name\": \"${COMPANY_NAME}\", \"company_abbr\": \"${ABBR}\"}" \
    2>/dev/null || {
        warn "API onboarding failed — running setup bypass instead"
        docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T frappe-web \
            bench --site "$SITE_NAME" execute small_erp.finish_setup.finish 2>/dev/null || true
    }

log "Tenant data bootstrapped"

# ─── Step 6: Configure n8n URL ────────────────────────────────────────
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T frappe-web \
    bench --site "$SITE_NAME" set-config n8n_url "http://smb-n8n:5678"

log "n8n integration configured"

# ─── Summary ──────────────────────────────────────────────────────────
echo ""
echo "=================================================================="
echo "  Tenant Provisioned Successfully!"
echo "=================================================================="
echo ""
log "Site URL:       https://${SITE_NAME}/ops"
log "ERPNext Admin:  https://${SITE_NAME}/app"
log "Login:          Administrator / ${ADMIN_PASS}"
echo ""
warn "Save these credentials — the password will not be shown again."
echo ""
info "To seed demo data:"
echo "  docker compose exec frappe-web bench --site ${SITE_NAME} execute small_erp.seed_demo.create_demo_data"
echo ""
