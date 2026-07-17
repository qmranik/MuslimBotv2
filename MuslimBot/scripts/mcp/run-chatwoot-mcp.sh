#!/usr/bin/env bash
# Launch fazer-ai/mcp-chatwoot (stdio MCP server, 129 Chatwoot tools).
# Spawned by the orchestrator MCP host / an MCP client. Reuses platform Chatwoot creds.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VENDOR="$ROOT/mcp-servers/chatwoot-mcp/vendor/mcp-chatwoot"

if [[ ! -d "$VENDOR" ]]; then
  echo "Missing $VENDOR — vendor it first:" >&2
  echo "  git submodule add https://github.com/fazer-ai/mcp-chatwoot $VENDOR" >&2
  exit 1
fi

# Fail loud on required credentials (no defaults).
: "${CHATWOOT_URL:?CHATWOOT_URL must be set (maps to CHATWOOT_BASE_URL)}"
: "${CHATWOOT_API_TOKEN:?CHATWOOT_API_TOKEN must be set}"
export CHATWOOT_BASE_URL="$CHATWOOT_URL"

command -v bun >/dev/null 2>&1 || { echo "bun not found on PATH" >&2; exit 1; }
cd "$VENDOR"
[[ -d node_modules ]] || bun install --frozen-lockfile
exec bun run start
