#!/bin/bash
# Idempotent multi-DB setup for an existing postgres-shared volume.
# Use when upgrading from per-app Postgres containers or if init-multidb.sh did not run.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose"
SERVICE="${POSTGRES_SERVICE:-postgres-shared}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

CHATWOOT_DB_PASSWORD="${CHATWOOT_DB_PASSWORD:?Set CHATWOOT_DB_PASSWORD in .env}"
POSTIZ_DB_PASSWORD="${POSTIZ_DB_PASSWORD:?Set POSTIZ_DB_PASSWORD in .env}"
TEMPORAL_DB_PASSWORD="${TEMPORAL_DB_PASSWORD:-temporal}"
PGUSER="${POSTGRES_USER:-postgres}"
PGPASSWORD="${POSTGRES_SHARED_PASSWORD:?Set POSTGRES_SHARED_PASSWORD in .env}"

export PGPASSWORD

run_sql() {
  $COMPOSE exec -T "$SERVICE" psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d postgres "$@"
}

user_exists() {
  run_sql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$1'" | grep -q 1
}

db_exists() {
  run_sql -tAc "SELECT 1 FROM pg_database WHERE datname='$1'" | grep -q 1
}

ensure_user() {
  local name="$1"
  local password="$2"
  if user_exists "$name"; then
    echo "  user $name exists"
    run_sql -c "ALTER USER ${name} WITH PASSWORD '${password}';"
  else
    run_sql -c "CREATE USER ${name} WITH PASSWORD '${password}';"
    echo "  created user $name"
  fi
}

ensure_db() {
  local db="$1"
  local owner="$2"
  if db_exists "$db"; then
    echo "  database $db exists"
  else
    run_sql -c "CREATE DATABASE ${db} OWNER ${owner};"
    echo "  created database $db"
  fi
  run_sql -c "GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${owner};"
}

echo "-> Configuring shared Postgres (${SERVICE})..."
ensure_user chatwoot "$CHATWOOT_DB_PASSWORD"
ensure_db chatwoot chatwoot
$COMPOSE exec -T "$SERVICE" psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d chatwoot \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"

ensure_user postiz_user "$POSTIZ_DB_PASSWORD"
ensure_db postiz postiz_user

ensure_user temporal "$TEMPORAL_DB_PASSWORD"
ensure_db temporal temporal

echo "Done. Databases: chatwoot, postiz, temporal"
