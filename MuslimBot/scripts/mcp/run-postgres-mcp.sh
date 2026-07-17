#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS="$ROOT/.cursor/mcp.secrets.env"
if [[ ! -f "$SECRETS" ]]; then
  echo "Missing $SECRETS — copy connection strings there." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$SECRETS"
set +a
: "${DATABASE_URL:?DATABASE_URL must be set in .cursor/mcp.secrets.env}"
exec node "$ROOT/mcp-servers/postgres-mcp/postgres-mcp.js"
