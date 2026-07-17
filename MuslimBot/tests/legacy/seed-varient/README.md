# Seed Variant — AI-Driven SMB Management Suite

Bootstraps an **ERPNext + Open WebUI** environment with realistic demo data for different business variants. The AI agent in Open WebUI can autonomously query and manage the ERP via Python tools.

## Variants

| Variant | Business | Description |
|---------|----------|-------------|
| `tech/` | **Quazi-Tech** | Computer & electronics store (laptops, components, custom builds) |
| `pharma/` | **Quazi-Pharma** | Pharmacy store (medicines, health products, FMCG) |

## Directory Structure

```
seed-varient/
├── docker-compose.yml          # ERPNext + Open WebUI + Ollama
├── .env                        # Environment variables
├── tech/
│   ├── demo_erp_data/          # JSON data files (items, customers, suppliers, orders)
│   ├── demo_knowledge_base/    # Markdown docs for Open WebUI RAG
│   ├── tools/                  # Open WebUI Python tools (ERPNext API)
│   └── seed_erpNext/           # Python seeder script
└── pharma/
    ├── demo_erp_data/
    ├── demo_knowledge_base/
    ├── tools/
    └── seed_erpNext/
```

## Quick Start

### 1. Start the Stack

```bash
cp .env.template .env   # edit with your values
docker compose up -d
```

Wait ~3-5 minutes for the `configurator` service to create the ERPNext site. Check progress:

```bash
docker compose logs -f configurator
```

### 2. Generate API Credentials

Login to ERPNext at `http://localhost:8080` (default: Administrator / admin).

1. Go to **User Settings** → **API Access** → **Generate Keys**
2. Copy the API Key and Secret into `.env`:
   ```
   FRAPPE_API_KEY=your_key
   FRAPPE_API_SECRET=your_secret
   ```

### 3. Seed Demo Data (Tech Variant)

```bash
cd tech/seed_erpNext
pip install -r requirements.txt
python seed.py --url http://localhost:8080 --user Administrator --password admin
```

### 4. Set Up Open WebUI

1. Open `http://localhost:3000`, create an admin account.
2. Pull the LLM model:
   ```bash
   docker exec seed-ollama ollama pull hermes3:8b
   docker exec seed-ollama ollama pull nomic-embed-text
   ```
3. **Upload Knowledge Base**: Go to **Workspace → Knowledge** → create a collection → upload all files from `tech/demo_knowledge_base/`.
4. **Import Tools**: Go to **Workspace → Tools** → **+ New Tool** → paste each file from `tech/tools/`. Set the Valves (ERPNEXT_URL, API_KEY, API_SECRET).

### 5. Test

Open a chat in Open WebUI and try:
- "What laptops do you have in stock?"
- "Create a sales order for Rafiq Ahmed — 2x ThinkPad T14s"
- "What's the outstanding balance for Dhaka IT Solutions?"
- "Add 20 units of RTX 4060 to inventory at cost price 27,000 each"

## Open WebUI Tools

| Tool | Description |
|------|-------------|
| `check_inventory` | Search items, check stock levels and pricing |
| `check_account_status` | Financial summary or customer balance lookup |
| `add_inventory_items` | Bulk stock receipt via Material Receipt |
| `create_sales_order` | Create and submit sales orders |

All tools authenticate to ERPNext via API key/secret configured in Open WebUI Valves.
