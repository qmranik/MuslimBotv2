#!/bin/bash
set -euo pipefail

CHATWOOT_DB_PASSWORD="${CHATWOOT_DB_PASSWORD:-chatwoot}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER chatwoot WITH PASSWORD '${CHATWOOT_DB_PASSWORD}';
    CREATE DATABASE chatwoot OWNER chatwoot;
    GRANT ALL PRIVILEGES ON DATABASE chatwoot TO chatwoot;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname chatwoot <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS vector;
    GRANT ALL ON SCHEMA public TO chatwoot;
EOSQL

echo "mvt-b postgres: created database chatwoot with vector"
