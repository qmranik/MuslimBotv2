#!/usr/bin/env bash
set -euo pipefail
npm install -g neonctl@latest @upstash/cli@latest
echo "neonctl=$(command -v neonctl) $(neonctl --version 2>/dev/null || true)"
echo "upstash=$(command -v upstash)"
upstash --version 2>/dev/null || true
echo "Set NEON_API_KEY, UPSTASH_EMAIL, UPSTASH_API_KEY then reload Cursor MCP."
