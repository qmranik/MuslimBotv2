# CLAUDE.md — Small ERP

> **Canonical reference**: See [`../CLAUDE.md`](../CLAUDE.md) at the repository root.
> **Compose reference**: See [`../COMPOSE.md`](../COMPOSE.md).

## What This Is

**Small ERP** — a Headless API backend layer on top of ERPNext. Mobile users interact exclusively via the `erp-flutter` application which consumes these custom endpoints. The legacy HTMX frontend has been deprecated.

## Quick Commands

All commands run from the **repository root**:

```bash
# ─── Local development ───────────────────────────────────────────────
docker compose -f docker-compose.local.yml up -d
bash small_erp/scripts/install-local.sh

# ─── Demo VM (baked image) ───────────────────────────────────────────
docker build -t small-erp:latest .
docker compose up -d
bash small_erp/scripts/install-demo.sh

# ─── Common (local) ──────────────────────────────────────────────────
docker compose -f docker-compose.local.yml exec frappe-web bench build --app small_erp
docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost migrate
docker compose -f docker-compose.local.yml restart frappe-web frappe-scheduler frappe-worker-default frappe-worker-short frappe-worker-long frappe-socketio

# ─── Setup helpers ───────────────────────────────────────────────────
docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost execute small_erp.finish_setup.finish
docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost execute small_erp.seed_demo.create_demo_data
docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost execute small_erp.setup_permissions.run
```

## Directory Layout

```
small_erp/
├── scripts/                    ← install-local.sh, install-demo.sh, deploy.sh, backup.sh
├── small_erp_app/              ← Frappe app package root
│   ├── setup.py
│   └── small_erp/              ← Frappe module (hooks.py, api/, www/, public/, utils/)
│       ├── finish_setup.py
│       ├── seed_demo.py
│       ├── api/                ← dashboard, pos, orders, inventory, customers, accounting, settings, ai_agent, genui, events, scheduled
│       ├── www/ops/            ← dashboard, pos, orders, inventory, customers, accounting, ai, settings
│       ├── templates/includes/
│       ├── public/
│       └── utils/
└── configs/                    ← mariadb/my.cnf, n8n workflows
```
