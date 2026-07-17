#!/usr/bin/env bash
set -euo pipefail
: "${NEON_DATABASE_URL:?Set NEON_DATABASE_URL to a direct Neon URI ending in /neondb?sslmode=require}"
BASE="${NEON_DATABASE_URL%/neondb*}"
SSL_SUFFIX="${NEON_DATABASE_URL#*neondb}"
for db in chatwoot orchestrator; do
  exists=$(psql "$NEON_DATABASE_URL" -Atc "SELECT 1 FROM pg_database WHERE datname='${db}'")
  if [ "$exists" != "1" ]; then
    psql "$NEON_DATABASE_URL" -c "CREATE DATABASE ${db};"
    echo "created ${db}"
  else
    echo "exists ${db}"
  fi
done
psql "${BASE}/chatwoot${SSL_SUFFIX}" -c "CREATE EXTENSION IF NOT EXISTS vector;"
echo DONE
