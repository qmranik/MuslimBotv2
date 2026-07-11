#!/bin/bash
# First-boot init for postgres-shared: Chatwoot + Postiz + Temporal databases.
# Mounted into /docker-entrypoint-initdb.d/ — runs only on empty volume.
set -euo pipefail

: "${CHATWOOT_DB_PASSWORD:?CHATWOOT_DB_PASSWORD is required}"
: "${POSTIZ_DB_PASSWORD:?POSTIZ_DB_PASSWORD is required}"
TEMPORAL_DB_PASSWORD="${TEMPORAL_DB_PASSWORD:-temporal}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER chatwoot WITH PASSWORD '${CHATWOOT_DB_PASSWORD}';
    CREATE DATABASE chatwoot OWNER chatwoot;
    GRANT ALL PRIVILEGES ON DATABASE chatwoot TO chatwoot;

    CREATE USER postiz_user WITH PASSWORD '${POSTIZ_DB_PASSWORD}';
    CREATE DATABASE postiz OWNER postiz_user;
    GRANT ALL PRIVILEGES ON DATABASE postiz TO postiz_user;

    CREATE USER temporal WITH PASSWORD '${TEMPORAL_DB_PASSWORD}';
    CREATE DATABASE temporal OWNER temporal;
    GRANT ALL PRIVILEGES ON DATABASE temporal TO temporal;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname chatwoot <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS vector;
EOSQL

echo "postgres-shared: created databases chatwoot, postiz, temporal"
