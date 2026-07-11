# MCP Server Configuration Setup Guide

This guide details how to securely configure and manage Model Context Protocol (MCP) servers for the liteERP project.

**⚠️ IMPORTANT NOTE:** MCP servers should be toggled OFF if we are not actively using their domain (e.g., disable GitHub MCP if we are just writing CSS). This is critical to save context window space and prevent hallucinations.

## 1. GitHub MCP Server
Used for reading/creating issues, branches, and PRs.

**Setup Instructions:**
1. Generate a Fine-Grained Personal Access Token (PAT) on GitHub. Ensure it has scopes for issues, PRs, and contents.
2. **Security:** Do not hardcode the PAT in the codebase or in shared configuration files.
3. Configure the MCP server locally (e.g., using npx) passing the token as an environment variable:
   ```bash
   GITHUB_PAT="your-fine-grained-pat" npx -y @modelcontextprotocol/server-github
   ```
4. Add the server in Cursor's MCP configuration settings using the command above.

## 2. File System MCP Server
Used for advanced local file reading/grepping.

**Setup Instructions:**
1. Configure the MCP server to restrict access to the liteERP directory.
2. In Cursor MCP settings, add the server:
   ```bash
   npx -y @modelcontextprotocol/server-filesystem /Users/qmranik/development/DOS/liteERP
   ```

## 3. Database MCP Server
Used for querying local databases to generate seed data.
For liteERP, there is a built-in `postgres-mcp` available in the `mcp-servers` directory, though the primary databases are MariaDB.

**Setup Instructions:**
1. Ensure your local database is running.
2. In Cursor MCP settings, add the server using your database connection string as an environment variable (ensure the URL is secure and not exposed in public files):
   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/testdb" node /Users/qmranik/development/DOS/liteERP/mcp-servers/postgres-mcp/postgres-mcp.js
   ```

## 4. liteERP Custom MCP Servers
Our project has centralized MCP servers defined in `mcp-servers/config/mcp-settings.json`. You can add these directly to Cursor based on your current task:
- **frappe-dev**: `node mcp-servers/frappe-dev-mcp/src/index.js` (Requires `FRAPPE_PROJECT_ROOT`, `FRAPPE_SITE`, `FRAPPE_API_KEY`, etc. in env)
- **mcp-erpnext**: `npx -y @anthropic-ai/mcp-erpnext@latest` (Requires `ERPNEXT_URL`, `ERPNEXT_API_KEY`, etc.)
- **n8n**: `npx -y @anthropic-ai/mcp-n8n@latest` (Requires `N8N_HOST` and `N8N_API_KEY`)
- **playwright-mcp**: `node mcp-servers/playwright-mcp/playwright-mcp.js`
- **codebase-mcp**: `node mcp-servers/codebase-mcp/codebase-mcp.js`
- **frappe-state-mcp**: `python mcp-servers/frappe-state-mcp/frappe_state_mcp.py`

## 5. Browser DevTools MCP (required for `/ops` E2E)

Playwright-powered browser automation for agent-driven testing of the HTMX frontend. Configured in [`.cursor/mcp.json`](mcp.json) as `browser-devtools`.

**Prerequisites:**
- Node.js 20+ (`node -v`)
- Playwright Chromium (one-time):
  ```bash
  npx playwright install chromium
  ```

**Workspace config** (already in `.cursor/mcp.json`):
```json
"browser-devtools": {
  "command": "npx",
  "args": ["-y", "@ironbee-ai/devtools"],
  "env": {
    "PLATFORM": "browser",
    "BROWSER_HEADLESS_ENABLE": "true",
    "BROWSER_PERSISTENT_ENABLE": "true",
    "BROWSER_PERSISTENT_USER_DATA_DIR": "${workspaceFolder}/.browser-devtools-mcp"
  }
}
```

**Activate in Cursor:**
1. Open **Cursor Settings → MCP** and confirm `browser-devtools` appears (loaded from `.cursor/mcp.json`).
2. Enable the server (toggle on).
3. **Restart Cursor** if tools do not appear immediately.

**Verify:** In Agent chat, ask: *"Navigate to http://localhost:8000/login and take an ARIA snapshot."* You should see tools like `navigation_go-to`, `a11y_take-aria-snapshot`, `interaction_fill`, `execute`.

**Optional — visible browser:** Set `BROWSER_HEADLESS_ENABLE` to `"false"` in `.cursor/mcp.json`.

**Optional — Cursor extension:** The [Browser DevTools MCP extension](https://open-vsx.org/extension/serkan-ozal/browser-devtools-mcp-vscode) registers its own MCP server automatically. **Do not enable both** the extension server and the `mcp.json` entry at the same time (duplicate tools). Prefer the workspace `mcp.json` entry for team consistency.

**liteERP test URL:** `http://localhost:8000/ops` (MVP: `docker compose -f docker-compose.mvp.yml up -d`). Test user: `operator@test.local` / `operator123`.

**Tool budget:** Keep unused MCP servers disabled in Cursor Settings to stay under the ~40-tool context limit.
