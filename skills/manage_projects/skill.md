---
name: manage_projects
description: Manages all the various components and sub-projects within the liteERP monorepo directory.
---

# Manage Projects Skill

## Instructions
1. Analyze the current directory structure (`liteERP`, `Muslimbot-voice-agent`, `mcp-servers`, `small_erp`, `n8n` configs).
2. Use Docker Compose profiles to start, stop, or restart specific subsystems (e.g., `docker compose --profile voice up -d`).
3. For Frappe/ERPNext specific management, run `bench` commands within the `frappe-web` container (e.g., `docker compose exec frappe-web bench ...`).
4. To manage MCP servers, navigate to `mcp-servers/` and manage the Node/Python processes.
5. Provide a summarized health check of all sub-projects based on Docker container states or application logs.
