# LiteERP (MuslimBot System) - Full System Context & Audit

## 1. Executive Summary
**LiteERP** (also referred to as the **MuslimBot System** or Autonomous Pharmacy & Retail OS) is an AI-driven, highly integrated ERP system designed specifically for small organizations like pharmacies and tech retail shops. It provides an autonomous business operating system that combines a traditional ERP backend with state-of-the-art AI interactions, including a generative UI command center, an omnichannel support system, and a real-time voice assistant (Muslimbot) capable of executing ERP operations.

The core philosophy separates the complex backend (ERPNext) from the user, restricting Small & Medium Business (SMB) operators to a streamlined frontend, while offering AI-driven automation for daily operational tasks.

---

## 2. System Architecture & Core Components

The system is highly modular, orchestrating several microservices and frontends:

### A. Small ERP (`/ops`) - The Core Engine
- **Technology**: Frappe Framework / ERPNext v15, HTMX, Jinja, Vanilla CSS/JS.
- **Purpose**: The system of record. It handles the core business logic: POS, inventory, accounting, and order management.
- **Access**: SMB users are strictly confined to the `/ops` HTMX frontend (Standalone Mode) and are blocked from the standard ERPNext Desk (`/app`).
- **Structure**: Uses a double-directory Frappe convention (`small_erp/small_erp_app/small_erp/`). All APIs are strictly whitelisted and secured via Role-Based Access Control (RBAC).

### B. Unified Backend Orchestrator (`go-orchestrator`)
- **Technology**: Golang, GORM, JWT.
- **Purpose**: Acts as the central API Gateway, Identity Provider (SSO), and State Manager.
- **Role**: Sits behind the edge router (Traefik) and routes all client requests (`/v1/*`) to the appropriate backend services (Frappe, KB BFF, n8n). It manages wildcard session cookies and securely injects server-side API credentials, hiding them from the client.

### C. Generative UI (`generative-ui`)
- **Technology**: React, Vite, Gemini NLP (browser-side routing).
- **Purpose**: The "Control Cockpit" or modern SPA face of the system.
- **Features**:
  - **Command Center**: Chat-to-dashboard interface rendering live ERP charts/tables based on natural language queries.
  - **Knowledge Hub**: UI for document/URL ingest (RAG) and the trigger point for the WebRTC voice assistant.

### D. Muslimbot Voice Agent & KB BFF (`Muslimbot-voice-agent`)
- **Technology**: Python, LiveKit, Google Gemini 2.0 Flash, FastAPI (uvicorn).
- **Purpose**: Real-time enterprise voice assistant and Knowledge Base (RAG) API.
- **Components**:
  - **Voice Worker (`muslimbot-voice-worker`)**: Connects to LiveKit WebRTC rooms. Listens to users and triggers 21+ ERP tools (read/write operations) via the ERP API.
  - **KB BFF (`muslimbot-kb-bff` on port 8787)**: The Knowledge Hub API serving RAG, URL scraping, and test chats. Generative-ui proxies to this service for knowledge management.

### E. Automation & Marketing
- **n8n (`:5678`)**: AI workflow automation engine. Captures Frappe webhooks (`/webhook/erp-event`) and manages async LLM chains (e.g., chat support, summaries, alerts).
- **Chatwoot (`:3000`)**: Omnichannel support inbox for the demo stack.
- **Postiz (`:4007`)**: Social media scheduling tool included in the full demo VM.

---

## 3. Primary Directory Structure

```text
liteERP/
├── small_erp/                  # Core Frappe app backend & HTMX frontend pages
│   ├── small_erp_app/small_erp/api/   # Backend python logic (orders, pos, genui)
│   ├── small_erp_app/small_erp/www/   # HTMX templates and routing pages
│   └── scripts/                       # Install, deploy, and backup scripts
├── generative-ui/              # React chat-to-dashboard frontend
├── go-orchestrator/            # Golang unified API gateway and SSO identity provider
├── Muslimbot-voice-agent/      # LiveKit Voice AI worker & FastAPI Knowledge Base BFF
├── configs/                    # Shared configurations (MariaDB, n8n workflows, Postgres init)
├── docs/                       # Technical specifications (e.g., PLATFORM_ORCHESTRATOR_SPEC)
├── pitch-deck/                 # UI/UX design prompts for generative tools (Stitch)
├── mcp-servers/                # (Optional) Configured MCP servers for AI-assisted dev workflows
└── seed-varient/               # Standalone demo data bootstrapper (tech/pharma variants)
```

---

## 4. Request Flow & Connectivity

1. **Frontend Operations (`/ops`)**:
   - Browser -> NGINX/Traefik -> Frappe Web (Port 8000) -> Jinja HTMX -> Frappe Backend -> MariaDB.
2. **Generative UI to ERP / KB**:
   - Browser -> NGINX Proxy (Generative UI) -> **Go Orchestrator** -> Routes to either Frappe (`/v1/erp/*`) or KB BFF (`/v1/kb/*`).
3. **Voice Assistant**:
   - Browser (LiveKit Client) -> LiveKit Cloud WebRTC -> Muslimbot Voice Worker (Python container). The voice worker queries Frappe APIs and the KB BFF (SQLite/Vertex AI RAG) simultaneously.
4. **Asynchronous Automation**:
   - Frappe Python Events -> n8n Webhook -> n8n processes AI Logic -> Sends notifications (Slack/Email) or updates ERP.

---

## 5. Deployment Profiles & Developer Workflow

The system is containerized and relies on multiple Docker Compose configurations depending on the environment:

- **Local Dev (`docker-compose.local.yml`)**: Volume-mounted code for hot-reloading. Includes Vite dev server, n8n, Frappe workers, and MariaDB. Optional `--profile support` (Chatwoot) and `--profile voice` (LiveKit worker).
- **Demo VM (`docker-compose.yml`)**: Bakes the Frappe app into an ERPNext production image. Includes Postiz and Chatwoot by default on shared Postgres. Generative-ui is served via NGINX.
- **SaaS (Legacy/Multi-tenant)**: Scripts exist (`provision-tenant.sh`) for Traefik-based multi-tenant setups, though the canonical SaaS compose file is currently deferred.

**Developer Commands**:
- Apply Python changes: `docker compose -f docker-compose.local.yml restart frappe-web ...`
- Apply Frontend changes: `docker compose -f docker-compose.local.yml exec frappe-web bench build --app small_erp`
- Database Migrations: `docker compose -f docker-compose.local.yml exec frappe-web bench --site small.localhost migrate`

---

## 6. Security & Guidelines
- **Strict Boundaries**: Do not read `.env` or secret files. Do not modify front-end files unless requested.
- **Code Placement**: All business logic must reside in `small_erp/small_erp_app/small_erp/api/`, never directly in routes. Must use strict typing and `@frappe.whitelist()`.
- **Secrets Management**: The Orchestrator masks sensitive Frappe API keys and KB BFF secrets from the client frontend, using secure session exchange strategies.

---
*Generated by Antigravity Agent based on system audit of CLAUDE.md, COMPOSE.md, README.md, wayToDemo.md, and sub-project documentation.*
