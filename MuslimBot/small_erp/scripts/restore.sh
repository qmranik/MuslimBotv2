#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# Small ERP — Restore Script  (companion to backup.sh — closes readiness P1)
#
# Restores a backup set produced by backup.sh:
#   db_<TS>.sql.gz     → MariaDB database
#   files_<TS>.tar.gz  → Frappe public/private files + site_config.json
#   n8n_<TS>.tar.gz    → n8n data volume
#
# Usage:
#   restore.sh <timestamp>        # e.g. restore.sh 20260718_031500
#   restore.sh latest             # newest set found in ./backups (or S3)
#   restore.sh <timestamp> --dry-run
#   restore.sh <timestamp> --from-s3   # pull the set from S3 first
#
# A restore is DESTRUCTIVE: it drops and recreates the target database and
# overwrites site files. It refuses to run without an explicit confirmation
# unless RESTORE_ASSUME_YES=1 is exported (used by the automated drill).
##############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# shellcheck disable=SC1091
source "$PROJECT_DIR/.env"

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.yml}"
DRY_RUN=0
FROM_S3=0
TIMESTAMP="${1:-}"

if [ -z "$TIMESTAMP" ]; then
    echo "Usage: $0 <timestamp|latest> [--dry-run] [--from-s3]" >&2
    exit 2
fi
shift || true
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --from-s3) FROM_S3=1 ;;
        *) echo "Unknown flag: $arg" >&2; exit 2 ;;
    esac
done

run() { if [ "$DRY_RUN" = "1" ]; then echo "  [dry-run] $*"; else eval "$@"; fi; }
log() { echo "[$(date)] $*"; }

# ─── Optionally pull the set from S3 ────────────────────────────────────
if [ "$FROM_S3" = "1" ] && [ -n "${S3_BUCKET:-}" ] && command -v aws &> /dev/null; then
    log "Pulling backup set $TIMESTAMP from s3://${S3_BUCKET}/small-erp/${TIMESTAMP}/ ..."
    mkdir -p "$BACKUP_DIR"
    run "aws s3 cp \"s3://${S3_BUCKET}/small-erp/${TIMESTAMP}/\" \"$BACKUP_DIR/\" --recursive \
        --endpoint-url \"${S3_ENDPOINT:-}\" --region \"${S3_REGION:-us-east-1}\" --quiet"
fi

# ─── Resolve 'latest' ───────────────────────────────────────────────────
if [ "$TIMESTAMP" = "latest" ]; then
    newest="$(ls -1 "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | sort | tail -1 || true)"
    [ -z "$newest" ] && { echo "No db_*.sql.gz found in $BACKUP_DIR" >&2; exit 1; }
    TIMESTAMP="$(basename "$newest" | sed -E 's/^db_(.*)\.sql\.gz$/\1/')"
    log "Resolved latest → $TIMESTAMP"
fi

DB_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
FILES_FILE="$BACKUP_DIR/files_${TIMESTAMP}.tar.gz"
N8N_FILE="$BACKUP_DIR/n8n_${TIMESTAMP}.tar.gz"

[ -f "$DB_FILE" ] || { echo "Missing database dump: $DB_FILE" >&2; exit 1; }

log "About to restore backup set: $TIMESTAMP"
log "  database : $DB_FILE"
log "  files    : $([ -f "$FILES_FILE" ] && echo "$FILES_FILE" || echo '(absent — skipped)')"
log "  n8n      : $([ -f "$N8N_FILE" ] && echo "$N8N_FILE" || echo '(absent — skipped)')"
log "  target DB: ${DB_NAME}  site: ${FRAPPE_SITE_NAME}"

if [ "$DRY_RUN" != "1" ] && [ "${RESTORE_ASSUME_YES:-0}" != "1" ]; then
    read -r -p "This will OVERWRITE the running database and files. Type 'RESTORE' to continue: " confirm
    [ "$confirm" = "RESTORE" ] || { echo "Aborted."; exit 1; }
fi

# ─── 1. MariaDB ─────────────────────────────────────────────────────────
log "Restoring MariaDB into ${DB_NAME}..."
run "docker compose -f \"$COMPOSE_FILE\" exec -T mariadb \
    mysql -u root -p\"\$DB_ROOT_PASSWORD\" -e \
    \"DROP DATABASE IF EXISTS \\\`${DB_NAME}\\\`; CREATE DATABASE \\\`${DB_NAME}\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""
run "gunzip -c \"$DB_FILE\" | docker compose -f \"$COMPOSE_FILE\" exec -T mariadb \
    mysql -u root -p\"\$DB_ROOT_PASSWORD\" \"${DB_NAME}\""
log "Database restored."

# ─── 2. Frappe site files ───────────────────────────────────────────────
if [ -f "$FILES_FILE" ]; then
    log "Restoring Frappe site files..."
    run "docker compose -f \"$COMPOSE_FILE\" exec -T frappe-web \
        tar xzf - -C /home/frappe/frappe-bench/sites < \"$FILES_FILE\""
    log "Files restored."
fi

# ─── 3. n8n data ────────────────────────────────────────────────────────
if [ -f "$N8N_FILE" ]; then
    log "Restoring n8n data..."
    run "docker compose -f \"$COMPOSE_FILE\" exec -T n8n \
        tar xzf - -C /home/node/.n8n < \"$N8N_FILE\""
    log "n8n data restored."
fi

# ─── 4. Clear caches / migrate ──────────────────────────────────────────
log "Clearing cache and running migrate on ${FRAPPE_SITE_NAME}..."
run "docker compose -f \"$COMPOSE_FILE\" exec -T frappe-web \
    bench --site \"${FRAPPE_SITE_NAME}\" migrate" || log "WARN: migrate reported issues — review manually"
run "docker compose -f \"$COMPOSE_FILE\" exec -T frappe-web \
    bench --site \"${FRAPPE_SITE_NAME}\" clear-cache" || true
run "docker compose -f \"$COMPOSE_FILE\" restart frappe-web n8n" || true

log "Restore complete. Verify /ops loads and seeded data is present."
