#!/bin/bash
# Backward-compatible wrapper — local dev now uses repo-root docker-compose.local.yml
exec "$(dirname "$0")/install-local.sh" "$@"
