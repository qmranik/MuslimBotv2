# Deployment — Fresh Demo VM

End-to-end guide to clone liteERP on a **new virtual machine** and bring up the **full demo stack** for investors or internal demos.

**What you get:** ERPNext + Small ERP (`/ops`), generative-ui (Command Center + Knowledge Hub), n8n, Muslimbot KB BFF, Chatwoot, Postiz, Temporal — optional LiveKit voice worker.

| Doc | Use when |
|-----|----------|
| [COMPOSE.md](COMPOSE.md) | Ports, profiles, env matrix, compose file differences |
| [wayToDemo.md](wayToDemo.md) | Presenter demo script, health checks, troubleshooting |
| [README.md](README.md) | Project overview |

All commands below run from the **repository root** unless noted.

---

## 1. VM requirements

| Resource | Minimum | Recommended (full demo) |
|----------|---------|-------------------------|
| vCPU | 4 | 8 (`e2-standard-8` on GCP) |
| RAM | 16 GB | 32 GB |
| Disk | 80 GB SSD | 200 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

**Inbound firewall ports** (security group / `ufw` / GCP firewall):

| Port | Service |
|------|---------|
| 8000 | Small ERP `/ops` (Frappe) |
| 5173 | generative-ui |
| 5678 | n8n |
| 8787 | Muslimbot KB BFF |
| 3000 | Chatwoot |
| 4007 | Postiz |
| 8088 | Temporal UI (optional) |

SSH (22) as needed. HTTPS termination is out of scope for this guide — demos typically use `http://<vm-ip>:<port>`.

---

## 2. Provision the VM (example: GCP)

```bash
# Adjust project, zone, and machine type to your environment
export PROJECT_ID=your-gcp-project
export ZONE=us-central1-a
export VM_NAME=liteerp-demo

gcloud config set project "$PROJECT_ID"

gcloud compute instances create "$VM_NAME" \
  --zone="$ZONE" \
  --machine-type=e2-standard-8 \
  --boot-disk-size=200GB \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --tags=liteerp-demo

# Allow demo ports (create once per VPC)
gcloud compute firewall-rules create liteerp-demo-ports \
  --allow=tcp:8000,tcp:5173,tcp:5678,tcp:8787,tcp:3000,tcp:4007,tcp:8088,tcp:22 \
  --target-tags=liteerp-demo \
  --description="liteERP demo stack"

gcloud compute ssh "$VM_NAME" --zone="$ZONE"
```

On AWS, Azure, or bare metal: match the same specs and open the ports above.

---

## 3. Install Docker on the VM

On Ubuntu 22.04+:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git

# Docker official install script
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker

docker --version
docker compose version
```

Verify: `docker run --rm hello-world`

---

## 4. Clone the repository

```bash
cd ~
git clone <your-repo-url> liteERP
cd liteERP
```

Use a release tag or branch you intend to demo. For a clean demo, use `main` or your designated release branch.

---

## 5. Configure environment (`.env`)

```bash
cp .env.template .env
nano .env   # or vim / your editor
```

### 5.1 Generate secrets (run on the VM)

```bash
# n8n encryption key (32+ characters)
openssl rand -hex 16

# Chatwoot SECRET_KEY_BASE
openssl rand -hex 64

# Postiz JWT
openssl rand -hex 32

# KB BFF shared secret (use the same value everywhere)
openssl rand -hex 24
```

### 5.2 Required variables

Set these before `docker compose up`:

| Variable | Notes |
|----------|-------|
| `DB_ROOT_PASSWORD` | MariaDB root |
| `ADMIN_PASSWORD` | ERPNext `Administrator` login |
| `N8N_PASSWORD` | n8n UI login |
| `N8N_ENCRYPTION_KEY` | From `openssl rand -hex 16` |
| `POSTGRES_SHARED_PASSWORD` | Shared Postgres superuser password |
| `CHATWOOT_DB_PASSWORD` | Chatwoot DB user password |
| `CHATWOOT_SECRET_KEY` | From `openssl rand -hex 64` |
| `POSTIZ_DB_PASSWORD` | Postiz DB user password |
| `POSTIZ_JWT_SECRET` | From `openssl rand -hex 32` |
| `KB_BFF_API_KEY` | Shared BFF + generative-ui proxy secret |
| `VITE_GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) key |
| `GEMINI_API_KEY` | **Same** key as above |
| `GOOGLE_API_KEY` | **Same** key as above |

`FRAPPE_API_KEY` and `FRAPPE_API_SECRET` are filled in **after** Frappe install (step 8).

### 5.3 Public URLs (replace with your VM IP)

```bash
VM_IP=34.x.x.x   # your external IP

DEMO_PUBLIC_URL=http://${VM_IP}
N8N_HOST=${VM_IP}
N8N_PROTOCOL=http
N8N_WEBHOOK_URL=http://${VM_IP}:5678
CHATWOOT_FRONTEND_URL=http://${VM_IP}:3000
POSTIZ_PUBLIC_URL=http://${VM_IP}:4007
```

Keep internal Frappe host header as-is:

```bash
FRAPPE_SITE_NAME=small.localhost
FRAPPE_SITE_HOST=small.localhost:8000
```

### 5.4 Voice demo (optional but recommended)

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

Get credentials from [livekit.io](https://livekit.io) → Project → Settings → API keys.

### 5.5 Vertex RAG (optional — skip for first demo)

Leave empty to use SQLite keyword RAG on the KB BFF:

```bash
GOOGLE_CLOUD_PROJECT=
GCS_KB_BUCKET=
VERTEX_LOCATION=asia-southeast1
```

---

## 6. Build the production image

Bakes `small_erp` into ERPNext v15. Run from repo root; takes several minutes on first build.

```bash
docker build -t small-erp:latest .
```

Rebuild this image whenever you pull backend changes that affect `small_erp/`.

---

## 7. Start the demo stack

### 7.1 Fresh VM only (destroys all databases)

```bash
docker compose down -v
```

Use **only** on a brand-new VM. Skip on upgrades.

### 7.2 Start all services

```bash
docker compose up -d
```

This starts:

- MariaDB, Redis (×3), Frappe web + workers + scheduler + socketio
- n8n, generative-ui (nginx), **muslimbot-kb-bff**
- Chatwoot (rails + worker), Postiz, Temporal + Elasticsearch

First boot may take 2–5 minutes while Postgres init and Temporal Elasticsearch become healthy. Monitor:

```bash
docker compose ps
docker compose logs -f postiz temporal
```

---

## 8. Run first-time install script

```bash
bash small_erp/scripts/install-demo.sh
```

The script:

1. Waits for MariaDB and shared Postgres
2. Ensures `chatwoot`, `postiz`, and `temporal` databases exist
3. Creates Frappe site `small.localhost` (or migrates if it exists)
4. Installs `erpnext` + `small_erp`, builds HTMX assets
5. Seeds SMB role permissions
6. Sets `n8n_url` and `google_api_key` on the site (when `GOOGLE_API_KEY` is set)
7. Prepares Chatwoot database
8. Restarts Frappe and Chatwoot

On success you will see URLs for `/ops`, generative-ui, n8n, Chatwoot, Postiz, Temporal, and KB BFF.

---

## 9. Post-install configuration

### 9.1 Generate Frappe API keys

```bash
docker compose exec frappe-web bench --site small.localhost \
  execute frappe.client.generate_keys --args '["Administrator"]'
```

Add the printed `api_key` and `api_secret` to `.env`:

```bash
FRAPPE_API_KEY=...
FRAPPE_API_SECRET=...
```

Restart consumers:

```bash
docker compose restart generative-ui n8n muslimbot-kb-bff
```

### 9.2 Import n8n workflows

Open `http://<vm-ip>:5678` → log in with `N8N_USER` / `N8N_PASSWORD` → **Workflows** → **Import from file**:

| File | Webhook | Purpose |
|------|---------|---------|
| `small_erp/configs/n8n/workflow-erp-events.json` | `/webhook/erp-event` | ERP document events |
| `small_erp/configs/n8n/workflow-ai-assistant.json` | `/webhook/ai-assistant` | `/ops/ai` assistant |
| `small_erp/configs/n8n/workflow-chat-support-rag.json` | `/webhook/chat-support` | Text RAG via KB BFF |

**Activate** each workflow. Ensure n8n can reach the BFF (container env or n8n variables):

- `KB_BFF_URL=http://muslimbot-kb-bff:8787`
- `KB_BFF_API_KEY` — must match root `.env`

### 9.3 Seed demo ERP data

```bash
docker compose exec frappe-web bench --site small.localhost execute small_erp.finish_setup.finish
docker compose exec frappe-web bench --site small.localhost execute small_erp.seed_demo.create_demo_data
```

Login: `Administrator` / your `ADMIN_PASSWORD`. SMB demo users are created by the seed script.

### 9.4 Rebuild generative-ui (if Gemini or LiveKit keys were set late)

`VITE_GEMINI_API_KEY` and LiveKit URL are embedded at **image build** time:

```bash
docker compose build generative-ui
docker compose up -d generative-ui
```

### 9.5 Enable voice worker (optional)

```bash
docker compose --profile voice up -d
```

Requires `LIVEKIT_*`, `GOOGLE_API_KEY`, and `FRAPPE_API_KEY` / `FRAPPE_API_SECRET` in `.env`.

---

## 10. Verify the deployment

Run on the VM before sharing URLs with stakeholders:

```bash
# Frappe /ops
curl -s -o /dev/null -w "ops: %{http_code}\n" http://localhost:8000/ops

# KB BFF
curl -s http://localhost:8787/health

# generative-ui (static + proxy)
curl -s -o /dev/null -w "generative-ui: %{http_code}\n" http://localhost:5173/

# KB proxy through nginx
curl -s http://localhost:5173/kb-api/health

# n8n
curl -s -o /dev/null -w "n8n: %{http_code}\n" http://localhost:5678/healthz
```

Expected KB BFF response (abbreviated):

```json
{"status": "ok", "tenant_id": "default", "vertex_configured": false}
```

### Demo URLs (replace `<vm-ip>`)

| Surface | URL |
|---------|-----|
| Small ERP | `http://<vm-ip>:8000/ops` |
| Generative UI | `http://<vm-ip>:5173` |
| Knowledge Hub | generative-ui → **Knowledge** in top nav |
| n8n | `http://<vm-ip>:5678` |
| Chatwoot | `http://<vm-ip>:3000` |
| Postiz | `http://<vm-ip>:4007` |
| KB BFF (direct) | `http://<vm-ip>:8787/health` |

Presenter walkthrough: [wayToDemo.md § Part 5](wayToDemo.md#part-5--demo-script-presenter-walkthrough).

---

## 11. Day-2 operations

### Start after VM reboot

```bash
cd ~/liteERP
docker compose up -d
docker compose --profile voice up -d   # if voice was enabled
```

### Stop demo VM (GCP — keeps disk and static IP)

```bash
gcloud compute instances stop liteerp-demo --zone=<zone>
```

### Pull updates and redeploy

```bash
git pull
docker build -t small-erp:latest .
docker compose up -d
docker compose exec frappe-web bench --site small.localhost migrate
bash small_erp/scripts/install-demo.sh
docker compose build generative-ui && docker compose up -d generative-ui
docker compose --profile voice up -d
```

Re-import n8n workflows if JSON files changed.

### Useful logs

```bash
docker compose logs -f frappe-web
docker compose logs -f muslimbot-kb-bff
docker compose logs -f generative-ui
docker compose logs -f postiz
```

---

## 12. Troubleshooting (quick)

| Symptom | Action |
|---------|--------|
| `/ops` blank or 502 | `docker compose logs frappe-web`; re-run `bash small_erp/scripts/install-demo.sh` |
| Postiz / Temporal not healthy | Wait 3–5 min; `docker compose logs temporal temporal-elasticsearch postiz` |
| generative-ui `/kb-api` 401 | Match `KB_BFF_API_KEY` in `.env` and restart `generative-ui` + `muslimbot-kb-bff` |
| Voice call fails | Set `LIVEKIT_*`; rebuild generative-ui; `docker compose --profile voice up -d` |
| `/ops/ai` generic replies | Activate `workflow-chat-support-rag.json`; verify `GOOGLE_API_KEY` |
| Out of memory | See memory budget in [COMPOSE.md](COMPOSE.md); stop Postiz/Temporal when not demoing |

Full troubleshooting: [wayToDemo.md § Part 8](wayToDemo.md#part-8--troubleshooting).

---

## 13. Checklist summary

Use this as a printable run sheet:

- [ ] VM provisioned (8 vCPU / 32 GB RAM / 200 GB disk)
- [ ] Firewall: 8000, 5173, 5678, 8787, 3000, 4007 (+ 8088 optional)
- [ ] Docker + Compose v2 installed
- [ ] Repo cloned
- [ ] `.env` filled (passwords, Postgres, Chatwoot, Postiz, Gemini keys, public URLs)
- [ ] `docker build -t small-erp:latest .`
- [ ] `docker compose up -d` (fresh: `docker compose down -v` first)
- [ ] `bash small_erp/scripts/install-demo.sh`
- [ ] Frappe API keys generated → `.env` → restart generative-ui, n8n, BFF
- [ ] n8n workflows imported and activated
- [ ] Demo data seeded (`finish_setup` + `seed_demo`)
- [ ] generative-ui rebuilt if keys changed after first build
- [ ] Voice profile started (optional)
- [ ] Health checks pass
- [ ] Presenter script reviewed ([wayToDemo.md](wayToDemo.md))

---

## Related documentation

- [COMPOSE.md](COMPOSE.md) — compose modes, profiles, env matrix
- [wayToDemo.md](wayToDemo.md) — demo script, API reference, troubleshooting
- [generative-ui/README.md](generative-ui/README.md) — proxy and local dev
- [Muslimbot-voice-agent/README.md](Muslimbot-voice-agent/README.md) — voice tools and BFF
