# LiteERP (MuslimBot System) - 4GB RAM QA & Testing Plan

Running the full LiteERP stack (Frappe, MariaDB, Redis x3, n8n, KB BFF, Voice Worker, Go Orchestrator, Generative UI, Chatwoot) simultaneously requires approximately 15-17GB of RAM. On a memory-constrained machine like a Mac M1 with 4GB RAM, Docker Desktop overhead combined with these services will cause Out-Of-Memory (OOM) crashes and severe swap thrashing.

To test the unified system locally, you must adopt a **fragmented testing strategy (Silo Testing)**. This involves:
1. Running lightweight services (Generative UI, Go Orchestrator) **natively** outside of Docker.
2. Spinning up only the specific Docker containers required for the feature being tested.
3. Tearing down the stack between silos.

## Pre-requisites & Global Configuration

1. **Docker Desktop Limits**: Ensure Docker Desktop is allocated a maximum of **2GB RAM** and **1.5GB Swap** in its resource settings.
2. **Native Execution**: 
   - You must have Node.js (for `generative-ui`) and Go (for `go-orchestrator`) installed on your Mac M1.
   - Always run these services directly on the host rather than containerizing them during local dev.
3. **Clean Slate**: Before starting any silo, ensure all containers are stopped:
   ```bash
   docker compose -f docker-compose.local.yml down
   ```

---

## Silo 1: Authentication & Go Orchestrator Integration
**Goal**: Test SSO, API Gateway routing, and the `generative-ui` Command Center interface without heavy backend workers.

- **Required Services**: 
  - Docker: `mariadb`, `redis-cache`, `frappe-web` (Needed for ERP API Key exchange)
  - Native: `go-orchestrator`, `generative-ui`
- **Estimated RAM**: ~1.2GB (Docker) + ~300MB (Native)

**Steps:**
1. Start the minimal Frappe backend:
   ```bash
   docker compose -f docker-compose.local.yml up -d mariadb redis-cache frappe-web
   ```
2. Start the Go Orchestrator natively (Terminal 1):
   ```bash
   cd go-orchestrator
   export PORT=8080
   export FRAPPE_URL=http://localhost:8000
   export FRAPPE_API_KEY=<your_key>
   export FRAPPE_API_SECRET=<your_secret>
   go run cmd/server/main.go
   ```
3. Start Generative UI natively (Terminal 2):
   ```bash
   cd generative-ui
   # Ensure .env points FRAPPE_URL and KB_BFF_URL to the Go Orchestrator or direct localhost ports
   npm run dev
   ```
4. **Test**: Log in via the Go Orchestrator auth flow and ensure `generative-ui` loads and proxies `/api` calls successfully to Frappe.

---

## Silo 2: Core ERP & HTMX (small_erp)
**Goal**: Test business logic (POS, Inventory, Accounting, Doc Events) and the `/ops` UI.

- **Required Services**: 
  - Docker: `mariadb`, `redis-cache`, `redis-queue`, `frappe-web`, `frappe-worker-default`
- **Excluded**: Generative UI, Go Orchestrator, KB BFF, n8n.
- **Estimated RAM**: ~1.8GB (Docker)

**Steps:**
1. Spin up the core ERP stack:
   ```bash
   docker compose -f docker-compose.local.yml up -d mariadb redis-cache redis-queue frappe-web frappe-worker-default
   ```
2. Rebuild HTMX assets if you made changes:
   ```bash
   docker compose -f docker-compose.local.yml exec frappe-web bench build --app small_erp
   ```
3. **Test**: Navigate directly to `http://localhost:8000/ops`. Test creating an invoice, receiving stock, and navigating the HTMX pages.

---

## Silo 3: Knowledge Hub & RAG (MuslimBot BFF)
**Goal**: Test Knowledge Base ingest, URL scraping, and RAG test chat.

- **Required Services**: 
  - Docker: `redis-cache`, `muslimbot-kb-bff`
  - Native: `generative-ui`
- **Excluded**: Frappe, MariaDB, n8n, Go Orchestrator.
- **Estimated RAM**: ~500MB (Docker) + ~150MB (Native)

**Steps:**
1. Start the Knowledge Hub backend:
   ```bash
   docker compose -f docker-compose.local.yml up -d redis-cache muslimbot-kb-bff
   ```
2. Start Generative UI natively (Terminal 1):
   ```bash
   cd generative-ui
   export KB_BFF_URL=http://localhost:8787
   npm run dev
   ```
3. **Test**: Open `http://localhost:5173`, switch to the Knowledge Hub tab. Test uploading a document, adding a URL, and querying the Test Knowledge Chat. *(Note: ERP connectivity tests in the BFF will fail since Frappe is down, but RAG will work).*

---

## Silo 4: Automation (n8n Webhooks)
**Goal**: Test AI workflows, webhook ingestion, and notifications.

- **Required Services**: 
  - Docker: `mariadb`, `redis-cache`, `frappe-web`, `frappe-worker-default`, `n8n`
- **Excluded**: Generative UI, KB BFF, Chatwoot.
- **Estimated RAM**: ~2.2GB (Docker) — *Warning: Pushes 4GB M1 to its limits.*

**Steps:**
1. Start the ERP + Automation stack:
   ```bash
   docker compose -f docker-compose.local.yml up -d mariadb redis-cache frappe-web frappe-worker-default n8n
   ```
2. **Test**: Log into n8n at `http://localhost:5678`. Open Frappe at `http://localhost:8000/ops` and trigger an event (e.g., submit an order) that fires a webhook to n8n. Monitor the n8n execution logs.

---

## Silo 5: Voice Assistant (MuslimBot WebRTC)
**Goal**: Test LiveKit WebRTC connection and voice tool dispatch.

- **Required Services**: 
  - Docker: `redis-cache`, `muslimbot-kb-bff`, `muslimbot-voice-worker` (using `--profile voice`)
  - Native: `generative-ui`
- **Estimated RAM**: ~800MB (Docker)

**Steps:**
1. Start the Voice stack:
   ```bash
   docker compose -f docker-compose.local.yml up -d redis-cache muslimbot-kb-bff
   docker compose -f docker-compose.local.yml --profile voice up -d muslimbot-voice-worker
   ```
2. Run `generative-ui` natively.
3. **Test**: In Generative UI, click **Call Muslimbot**. Ensure the microphone connects and the worker picks up the LiveKit session. *(Note: Ask non-ERP questions, as Frappe is not running).*
