#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# Small ERP — Automated Backup Script
# Backs up: MariaDB database, Frappe site files, n8n data
# Destination: Local /backups + optional S3 upload
##############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

source "$PROJECT_DIR/.env"

BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# ─── 1. MariaDB Dump ────────────────────────────────────────────────────
echo "[$(date)] Backing up MariaDB..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T mariadb \
    mysqldump -u root -p"$DB_ROOT_PASSWORD" \
    --single-transaction --quick --lock-tables=false \
    "$DB_NAME" | gzip > "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

echo "[$(date)] Database backup: db_${TIMESTAMP}.sql.gz"

# ─── 2. Frappe Site Files ───────────────────────────────────────────────
echo "[$(date)] Backing up Frappe site files..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T frappe-web \
    tar czf - -C /home/frappe/frappe-bench/sites \
    "$FRAPPE_SITE_NAME"/public/files \
    "$FRAPPE_SITE_NAME"/private/files \
    "$FRAPPE_SITE_NAME"/site_config.json \
    > "$BACKUP_DIR/files_${TIMESTAMP}.tar.gz" 2>/dev/null || true

echo "[$(date)] Files backup: files_${TIMESTAMP}.tar.gz"

# ─── 3. n8n Data ────────────────────────────────────────────────────────
echo "[$(date)] Backing up n8n data..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T n8n \
    tar czf - -C /home/node/.n8n . \
    > "$BACKUP_DIR/n8n_${TIMESTAMP}.tar.gz" 2>/dev/null || true

echo "[$(date)] n8n backup: n8n_${TIMESTAMP}.tar.gz"

# ─── 4. Upload to S3 (if configured) ───────────────────────────────────
if [ -n "${S3_BUCKET:-}" ] && [ "${S3_BUCKET}" != "small-erp-backups" ] && command -v aws &> /dev/null; then
    echo "[$(date)] Uploading to S3..."
    for f in "$BACKUP_DIR"/*_${TIMESTAMP}.*; do
        aws s3 cp "$f" "s3://${S3_BUCKET}/small-erp/${TIMESTAMP}/$(basename $f)" \
            --endpoint-url "${S3_ENDPOINT}" \
            --region "${S3_REGION:-us-east-1}" \
            --quiet
    done
    echo "[$(date)] S3 upload complete"
else
    echo "[$(date)] S3 not configured — backup stored locally only"
fi

# ─── 5. Cleanup Old Backups ─────────────────────────────────────────────
echo "[$(date)] Cleaning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.gz" -mtime +${RETENTION_DAYS} -delete

# ─── 6. Docker Cleanup ─────────────────────────────────────────────────
echo "[$(date)] Docker cleanup..."
docker system prune -f --volumes --filter "until=168h" > /dev/null 2>&1 || true

echo "[$(date)] Backup complete!"
