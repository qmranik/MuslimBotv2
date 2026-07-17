#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS="$ROOT/.cursor/mcp.secrets.env"
if [[ ! -f "$SECRETS" ]]; then
  echo "Missing $SECRETS" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$SECRETS"
set +a
if [[ -z "${UPSTASH_EMAIL:-}" || -z "${UPSTASH_API_KEY:-}" ]]; then
  echo "Upstash MCP needs UPSTASH_EMAIL and UPSTASH_API_KEY in .cursor/mcp.secrets.env" >&2
  echo "Redis URL alone cannot authenticate the management API. Get keys: Upstash Console → Account → API Keys." >&2
  exit 1
fi
exec npx -y @upstash/mcp-server@latest --email "$UPSTASH_EMAIL" --api-key "$UPSTASH_API_KEY"
