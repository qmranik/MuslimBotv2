# Agent Instructions

This file contains high-signal context and constraints for AI agents working in this repository.

## Rules & Constraints
- **Do not modify front-end files** unless explicitly instructed to do so by the user.
- **Never read `.env` or secret files** to prevent token leaks.
- **Coding Standards:** Strict typing is mandatory. Business logic must reside strictly in the service layer (`small_erp/small_erp_app/small_erp/api/`), never in routes.

## Architecture & Boundaries
- **Frappe Double-Directory Convention:** The outer `small_erp/small_erp_app/` is the Python package root containing `setup.py`. The inner `small_erp/small_erp_app/small_erp/` is the actual Frappe module containing `hooks.py`, `api/`, `www/`, etc. This is required by the framework.
- **Standalone Mode:** Small ERP is an HTMX frontend on top of ERPNext. SMB users interact exclusively via `/ops` and are blocked from the standard ERPNext desk.
- **Backend API Setup:**
  1. Add functions to `small_erp/small_erp_app/small_erp/api/<module>.py`
  2. Decorate with `@frappe.whitelist()`
  3. Guard with `frappe.has_permission("DocType", throw=True)`
  4. Call from HTMX via `frappeCall('small_erp.api.<module>.<function>', {args})`
- **n8n Integration:** AI workflows run in n8n (`http://small-n8n:5678`), authenticating to Frappe via API keys. The `_notify_n8n()` helper in `events.py` is fire-and-forget.
- **Voice / generative-ui:** Voice agent lives in `Muslimbot-voice-agent/` (port 8787 for KB BFF). The React generative UI is in `generative-ui/`.

## Developer Commands
Commands must be run from the repository root using the local compose file.

- **Apply Python changes (Restart app servers):**
  ```bash
  docker compose -f docker-compose.local.yml restart frappe-web frappe-scheduler frappe-worker-default frappe-worker-short frappe-worker-long frappe-socketio
  ```
- **Apply Frontend changes (Rebuild CSS/JS):**
  ```bash
  docker compose -f docker-compose.local.yml exec frappe-web bench build --app small_erp
  ```
- **Run Database Migrations:**
  ```bash
  docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost migrate
  ```
- **Seed Roles & Permissions (Run after adding new doctypes):**
  ```bash
  docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost execute small_erp.setup_permissions.run
  ```
- **Seed Demo Data & Bypass Setup Wizard:**
  ```bash
  docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost execute small_erp.finish_setup.finish
  docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost execute small_erp.seed_demo.create_demo_data
  ```
- **Generative UI Local Dev:**
  ```bash
  cd generative-ui && npm run dev
  ```
