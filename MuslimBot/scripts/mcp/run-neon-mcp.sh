#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS="$ROOT/.cursor/mcp.secrets.env"
if [[ -f "$SECRETS" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SECRETS"
  set +a
fi
if [[ -n "${NEON_API_KEY:-}" ]]; then
  exec npx -y @neondatabase/mcp-server-neon@latest start "$NEON_API_KEY"
fi
echo "No NEON_API_KEY in .cursor/mcp.secrets.env — use remote Neon MCP (OAuth) in mcp.json instead." >&2
exit 1
