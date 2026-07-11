# Muslimbot Voice Agent

Real-time enterprise voice assistant for Small ERP, powered by LiveKit and Google Gemini 2.0 Flash.

Users speak naturally and Muslimbot queries the ERP system, creates orders, records payments, manages inventory, and answers business questions — all hands-free via WebRTC.

## Features

### Read Operations (no confirmation needed)

| Tool | Description |
|------|-------------|
| `search_items` | Product/pharmacy lookup with pricing and stock |
| `check_stock` | Inventory levels across warehouses |
| `sales_summary` | Today's revenue, order count |
| `get_recent_orders` | Invoices filtered by customer/status |
| `search_customer` | Find customers by name/phone |
| `customer_history` | Purchase history and spending |
| `get_receivables` | Outstanding unpaid invoices |
| `low_stock_alerts` | Items below reorder level |
| `ask_business_ai` | Complex queries via n8n AI workflow |
| `list_events` | Upcoming calendar events |
| `system_status` | Current time + ERP health |

### Write Operations (confirms before executing)

| Tool | Description |
|------|-------------|
| `create_order` | Create sales invoice (regular or POS) |
| `submit_order` | Finalize a draft invoice |
| `record_payment` | Record payment against invoice |
| `create_customer` | Add new customer to system |
| `create_item` | Add new product with pricing |
| `add_stock` | Material receipt (stock in) |
| `trigger_workflow` | Run n8n automations (alerts, summaries) |
| `send_notification` | Send email/SMS/Slack via n8n |
| `create_event` | Create calendar event |

## Architecture

```
┌──────────────────┐       ┌─────────────────┐
│  User's Browser  │◄─────►│  LiveKit Cloud   │
│  (WebRTC audio)  │       │  (SFU/routing)   │
└──────────────────┘       └────────┬─────────┘
                                    │ WebSocket
                           ┌────────▼─────────┐
                           │  Muslimbot Agent │
                           │  (this container) │
                           │  Gemini 2.0 Flash │
                           └──┬────────┬───┬───┘
                              │        │   │
              ┌───────────────▼──┐  ┌──▼───▼────┐
              │ ERPNext REST API │  │ n8n       │
              │ frappe-web:8000  │  │ :5678     │
              │                  │  │           │
              │ • GET /resource  │  │ • webhook │
              │ • POST /resource │  │   /ai-    │
              │ • POST /method   │  │   assistant│
              │ • PUT (submit)   │  │ • webhook │
              └──────────────────┘  │   /erp-   │
                                    │   event   │
                                    └───────────┘
```

### How it connects to MCP servers

The same ERPNext instance that the **frappe-dev-mcp** server manages is accessed by Muslimbot at runtime via REST API:

| MCP Server | Muslimbot Equivalent | Relationship |
|-----------|-------------------|--------------|
| **frappe-dev-mcp** `get_doctype_list` | `erp_get_list()` | Same REST API, different auth context |
| **frappe-dev-mcp** `create_doc` | `erp_create_doc()` | Same POST /api/resource/ pattern |
| **frappe-dev-mcp** `bench_execute` | N/A | Admin-only, not exposed to voice |
| **mcp-erpnext** 120+ tools | Muslimbot tools | Muslimbot uses same API endpoints |
| **n8n MCP** workflows | `n8n_webhook()` | Triggers same workflows |

## KB BFF (Knowledge Hub API)

The same Docker image runs two services:

| Service | Command | Port |
|---------|---------|------|
| `muslimbot-voice-worker` | `python agent.py start` | LiveKit |
| `muslimbot-kb-bff` | `uvicorn kb_bff.main:app` | 8787 |

generative-ui proxies `/kb-api/*` to the BFF. Shared `services/` package powers both HTTP RAG and voice `search_knowledge_base` tool.

**Local dev (no GCP):** Leave `GOOGLE_CLOUD_PROJECT` empty — uses SQLite keyword retrieval.

**Production:** Set Vertex AI + GCS env vars (see `.env.example`).


### Queries
- "Search for paracetamol"
- "How much Amoxicillin do we have?"
- "Show me today's sales"
- "Any overdue invoices?"
- "What items are running low?"

### Creating Orders
- "Create an order for Demo Client — 5 Super Widget A"
- "Ring up a POS sale: 2 paracetamol tablets for walk-in customer"
- "Submit invoice ACC-SINV-2026-00002"

### Payments & Management
- "Record a cash payment of 500 rupees on invoice ACC-SINV-2026-00001"
- "Add a new customer: Ahmed Pharma, phone 01712345678"
- "Create a new item: Vitamin C 500mg, price 150 rupees"
- "We received 100 units of ITM001, add to stock"

### AI & Workflows
- "Why did revenue drop this week?"
- "Send a low stock alert"
- "Trigger the daily summary workflow"

## Quick Start

### 1. Prerequisites

- LiveKit Cloud account ([livekit.io](https://livekit.io))
- Google AI API key (Gemini)
- Running Small ERP stack (`docker compose up -d` from repo root)

### 2. Configure

```bash
cp .env.example .env
# Fill in credentials (see Environment Variables below)
```

### 3. Generate ERPNext API Keys

```bash
docker compose exec frappe-web bench --site small.localhost \
  execute frappe.client.generate_keys --args '["Administrator"]'
# Copy the key/secret into .env
```

### 4. Run

Three deployment modes:

**1. Local (root compose)** — KB BFF always on; voice worker optional:

```bash
# From repo root — core stack + KB BFF
docker compose -f docker-compose.local.yml up -d

# Optional voice worker (requires LIVEKIT_* and GOOGLE_API_KEY in .env)
docker compose -f docker-compose.local.yml --profile voice up -d
```

**2. Demo VM (root compose)** — same split after `docker compose up -d`:

```bash
docker compose --profile voice up -d
```

**3. Standalone** — both services on `liteerp_smb-net`:

```bash
cd Muslimbot-voice-agent
docker compose up -d
```

Health check: `curl http://localhost:8787/health`

### 5. Connect

**In-browser (recommended):** Open generative-ui → **Knowledge Hub** → **Call Muslimbot**. Allow microphone; BFF mints token and dispatches the `muslimbot` agent.

**Alternative:** LiveKit Agents Playground or any WebRTC client using the same LiveKit project.

## Voice session API

`POST /voice/session` (via generative-ui `/kb-api/voice/session`):

```json
{ "room_name": "", "participant_name": "Demo User" }
```

Returns `{ "token", "url", "room_name", "participant_identity" }` and dispatches agent `muslimbot` to the room.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LIVEKIT_URL` | Yes | LiveKit server URL (wss://...) |
| `LIVEKIT_API_KEY` | Yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | Yes | LiveKit API secret |
| `LIVEKIT_AGENT_NAME` | No | Agent dispatch name (default: muslimbot) |
| `GOOGLE_API_KEY` | Yes | Gemini API key for voice model |
| `ERPNEXT_URL` | No | ERPNext URL (default: http://frappe-web:8000) |
| `FRAPPE_API_KEY` | Yes* | Frappe API key for authenticated access |
| `FRAPPE_API_SECRET` | Yes* | Frappe API secret |
| `N8N_URL` | No | n8n URL (default: http://n8n:5678) |
| `KB_BFF_API_KEY` | Yes (BFF) | Shared secret for generative-ui `/kb-api` proxy |
| `ENVIRONMENT` | No | `production` enforces non-empty `KB_BFF_API_KEY` |
| `CORS_ORIGINS` | No | Comma-separated allowed origins for BFF |
| `ERP_TIMEOUT_SEC` | No | Frappe HTTP timeout (default 15) |
| `REDIS_URL` | No | Redis for voice context (default: redis://redis-cache:6379/2) |
| `TENANT_ID` | No | KB tenant namespace (default: default) |
| `KB_DATA_DIR` | No | KB SQLite/data path in container (default: /app/data) |
| `GOOGLE_CALENDAR_ENABLED` | No | Enable calendar (default: false) |
| `AGENT_TIMEZONE` | No | Timezone (default: Asia/Dhaka) |
| `AGENT_LANGUAGE` | No | Language: en, bn (default: en) |

*Required for write operations (create orders, payments, etc.)

## Development

```bash
pip install -r requirements.txt
python agent.py dev  # LiveKit dev mode
```

## Migrated From

Supersedes the previous `voice_dictation/` macOS-only PharmaVoice client. All ERP features (item search, POS, multi-language) are now real-time voice tools accessible from any device.
