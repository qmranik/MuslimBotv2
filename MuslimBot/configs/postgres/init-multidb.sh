#!/bin/bash
# First-boot init for postgres-shared: Chatwoot databases.
# Mounted into /docker-entrypoint-initdb.d/ — runs only on empty volume.
set -euo pipefail

: "${CHATWOOT_DB_PASSWORD:?CHATWOOT_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER chatwoot WITH PASSWORD '${CHATWOOT_DB_PASSWORD}';
    CREATE DATABASE chatwoot OWNER chatwoot;
    GRANT ALL PRIVILEGES ON DATABASE chatwoot TO chatwoot;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname chatwoot <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS vector;
EOSQL

echo "postgres-shared: created databases chatwoot"
