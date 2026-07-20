# MuslimBot — Environment Setup Runbook (post-VM)

> **For a fully self-contained, agent-executable end-to-end deployment** (terraform → unified
> system → seeded demo business → credentials handoff) use
> [`AGENT_DEPLOYMENT_GUIDE.md`](AGENT_DEPLOYMENT_GUIDE.md). This runbook remains the deeper
> per-step reference. Note: hostnames here that read `chat.`/`workflow.`/`app.` are stale —
> the compose truth is `chatwoot.` / `n8n.` / `ui.` (see the guide's hostname table).

**One runbook.** You have already created the VM (`terraform apply` in
`terraform/single-host/`). This takes you from a **bare VM** to a **fully wired,
verified MuslimBot environment** serving businesses. Follow it top-to-bottom on the VM.

Driver: [`../../setup.sh`](../../setup.sh) (root orchestrator). Deeper context:
[`MASTER_IMPLEMENTATION_PLAN.md`](MASTER_IMPLEMENTATION_PLAN.md) · infra spec
[`AS_BUILT.md`](../../terraform/single-host/AS_BUILT.md) · verify
[`../testing/TEST_PLAN_GENUI_ORCHESTRATOR.md`](../testing/TEST_PLAN_GENUI_ORCHESTRATOR.md).

---

## 0. Preconditions (already true after `terraform apply`)

- VM up (`e2-standard-8`), SSD mounted at `/opt/muslimbot/data`, Docker + Compose installed (startup script — verify `AS_BUILT.md` §7).
- You can SSH in:
  ```bash
  cd MuslimBot/terraform/single-host
  gcloud compute ssh "$(terraform output -raw instance_name)" --zone="$(terraform output -raw zone)"
  ```
- Have ready: your **domain**, a **Cloudflare API token** (DNS-01 ACME), and a **Gemini API key**.

---

## 1. Get the code + dependencies onto the VM

`deploy-on-vm.sh` clones the repo to `/opt/muslimbot/repo`, roots Docker on the SSD, inits
submodules, and generates the env-file skeleton:
```bash
REPO_URL=https://github.com/<you>/MuslimBotv2.git BRANCH=chore/repo-restructure \
  bash /path/to/deploy-on-vm.sh        # or scp it up first
cd /opt/muslimbot/repo/MuslimBot
git submodule update --init --recursive   # trypost + mcp-chatwoot + chatwoot-skills
```
> If `mcp-chatwoot` isn't a submodule yet, add it before building the orchestrator image, else only TryPost's HTTP MCP tools connect (ADR-0001 §7).

---

## 2. Configure the environment — `/opt/muslimbot/secrets/muslimbot.env` (0600)

This file **is** the configuration. Edit it (`chmod 600`). Generate secrets with
`openssl rand -hex 32` (64 for the two marked). **Production floor:** set `ENV=production`
and `AUTH_LOCAL_BYPASS=false` — the orchestrator refuses to boot (`config.MustValidate`) if a
required secret is empty or the bypass is on in production.

### 2.1 Core / identity / security
| Var | Value |
|---|---|
| `PUBLIC_DOMAIN` | `smb.<yourdomain>` (Traefik routers + GenUI use this) |
| `ENV` | `production` |
| `AUTH_LOCAL_BYPASS` | `false` |
| `TRUSTED_PROXY_CIDRS` | `172.28.0.2/32` (Traefik's static IP — already the compose default; keep) |
| `DB_ROOT_PASSWORD`, `DB_PASS` | `openssl rand -hex 32` (MariaDB root; platform Postgres) |
| `ADMIN_PASSWORD` | strong ERPNext Administrator password |
| `AUTHENTIK_SECRET_KEY` | `openssl rand -hex 64` |
| `WEBHOOK_SECRET` | `openssl rand -hex 32` |

### 2.2 AI / KB / n8n
| Var | Value |
|---|---|
| `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `VITE_GEMINI_API_KEY` | your Google AI Studio key (same value) |
| `ORCHESTRATOR_SERVICE_API_KEY`, `WORKLOAD_JWT_SECRET` (aliases: KBBFF_API_KEY) | `openssl rand -hex 32` |
| `AI_RATE_LIMIT_PER_MIN` / `AI_RATE_LIMIT_BURST` | `30` / `10` (P8 cost cap) |
| `N8N_PASSWORD`, `N8N_ENCRYPTION_KEY` | strong / `openssl rand -hex 32` |
| `FRAPPE_API_KEY`, `FRAPPE_API_SECRET` | **left blank now** → filled in step 5.1 |

### 2.3 Chatwoot / TryPost / MCP  *(add the TryPost + MCP keys — the template still ships stale `POSTIZ_*`/`TEMPORAL_*`; ignore those)*
| Var | Value |
|---|---|
| `CHATWOOT_DB_PASSWORD`, `CHATWOOT_SECRET_KEY` | `openssl rand -hex 32` / `-hex 64` |
| `CHATWOOT_API_TOKEN` | **blank now** → step 5.4 |
| `CHATWOOT_MCP_ENABLED` | `true` |
| `TRYPOST_APP_KEY` | `docker run --rm muslimbot/trypost:local php artisan key:generate --show` (step 5.5) |
| `TRYPOST_DB_PASSWORD` | `openssl rand -hex 32` |
| `TRYPOST_API_TOKEN` | **blank now** → step 5.5 |
| `TRYPOST_MCP_ENABLED` | `true` |
| `TRYPOST_MCP_URL` | `http://trypost/mcp/trypost` (compose default) |

### 2.4 Edge / TLS / GenUI auth
| Var | Value |
|---|---|
| `ACME_EMAIL` | your email (Let's Encrypt) |
| `CF_DNS_API_TOKEN` | Cloudflare token with DNS edit on the zone |
| `NEXT_PUBLIC_AUTHENTIK_URL` | `https://auth.<PUBLIC_DOMAIN>` (GenUI SSO screens) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL` | voice (optional; drop `--profile voice` if unused) |
| `TZ` | your timezone |

---

## 3. DNS + TLS

1. **DNS:** at your provider add `A  <PUBLIC_DOMAIN>` and `A  *.<PUBLIC_DOMAIN>` → the VM's static IP (`terraform output -raw instance_public_ip`).
2. **ACME:** ensure Traefik in `docker-compose.extended.yml` has the `le` resolver (Cloudflare DNS-01) and each router uses `certresolver=le` (`MASTER_IMPLEMENTATION_PLAN.md` §4). `CF_DNS_API_TOKEN`/`ACME_EMAIL` from step 2.4.

---

## 4. Bring up the unified stack

```bash
cd /opt/muslimbot/repo/MuslimBot
./setup.sh preflight          # tools/docker/submodule check
./setup.sh stack              # build + `docker compose ... --profile support --profile voice up -d`; waits for MariaDB
docker compose --env-file /opt/muslimbot/secrets/muslimbot.env \
  -f docker-compose.yml -f ../docker-compose.extended.yml ps
```
**Expect:** frappe-* , mariadb, redis-*, n8n, kb-bff, generative-ui, chatwoot-*, voice/livekit, traefik, authentik-*, platform-postgres/redis, go-orchestrator, trypost-* — all `Up`/healthy.

---

## 5. Install & configure each system (in order)

### 5.1 ERPNext + small_erp (automated)
```bash
./setup.sh init               # → small_erp/scripts/deploy.sh: creates site, installs erpnext + small_erp, builds assets, wires n8n, backup cron
```
Then in ERPNext (`https://erp.<domain>/app`, user `Administrator` / `ADMIN_PASSWORD`) → **change the password**, create an **API key/secret** (Settings → API Access) and put them in `FRAPPE_API_KEY`/`FRAPPE_API_SECRET`, then `./setup.sh stack` to restart with them.

### 5.2 Authentik (identity — web UI)
At `https://auth.<domain>`: set the admin password (bootstrap), then create:
- an **OIDC Provider** + **Application** for the platform;
- a **ForwardAuth outpost** (embedded) — Traefik middleware is `traefik/dynamic/authentik.yml`;
- the middleware chain **strip-identity-headers → authentik-forwardauth** so client-supplied `X-authentik-*` are blanked then set by Authentik (defense-in-depth with the orchestrator's `TRUSTED_PROXY_CIDRS`).

### 5.3 ERPNext ↔ Authentik OIDC (keep ERP reachable for tokens)
In ERPNext create a **Social Login Key** → Authentik (authorize/token endpoints; redirect
`…/frappe.integrations.oauth2_logins.custom_sso_callback`; "create user if not exists"). **Do not**
put ForwardAuth on `erp.` — n8n/webhooks/Socket.IO must reach it with `Authorization: token`.

### 5.4 Chatwoot
Finish first-run setup at `https://chat.<domain>`; create an **API access token** (Profile) →
set `CHATWOOT_API_TOKEN` in the env-file.

### 5.5 TryPost (social)
```bash
docker compose ... exec trypost php artisan migrate --force
```
Create an admin, then **Settings → API Keys** → generate a key → set `TRYPOST_API_TOKEN`.
(If `TRYPOST_APP_KEY` was blank, generate it and re-up.)

### 5.6 n8n
At `https://workflow.<domain>` import `configs/n8n/*.json`; add Frappe **token** credentials
(`FRAPPE_API_KEY:FRAPPE_API_SECRET`).

### 5.7 Enable the MCP layer
With `TRYPOST_API_TOKEN` + `CHATWOOT_API_TOKEN` now set and `*_MCP_ENABLED=true`, restart the orchestrator:
```bash
./setup.sh stack                                   # picks up the new env
curl -s -H "X-authentik-email: you@domain" https://api.<domain>/v1/mcp/servers   # trypost+chatwoot → connected:true
```

---

## 6. Seed ERPNext

```bash
./setup.sh seed               # finish_setup + seed_demo (demo company/items/customers/invoices) + setup_permissions
```
For a real business, skip the demo seed and go to step 8 (tenant onboarding) instead.

---

## 7. Wire GenUI auth

`NEXT_PUBLIC_AUTHENTIK_URL` (step 2.4) drives the branded login/signup screens. Rebuild GenUI if it
was built before the value was set: `./setup.sh stack`. Visiting `https://app.<domain>` unauthenticated
now shows the MuslimBot login → Authentik SSO.

---

## 8. Onboard a business (multi-tenant)

> **Prerequisite:** tenant resolution must fail closed (G10) before real businesses — verify in
> `internal/auth`. Then per business:
```bash
./setup.sh tenant acme "Acme Corp" 'StrongAdminPass'   # → scripts/provision-tenant.sh
#   creates Cloudflare DNS acme.<domain>, bench new-site (isolated DB), installs erpnext+small_erp,
#   calls onboard API. Also create the tenant's Authentik group, Chatwoot account, TryPost workspace.
```
**Isolation check:** a user in tenant A must not read/act on tenant B's ERP / Chatwoot account /
TryPost workspace via any path incl. `/v1/mcp/call`.

---

## 9. Backups & DR

```bash
./setup.sh backup                          # small_erp/scripts/backup.sh (MariaDB + files + n8n; extend for platform-pg/chatwoot/trypost)
# restore drill into a scratch stack — an untested backup is not a backup:
./setup.sh restore latest                  # DESTRUCTIVE (confirms)
```
Confirm the 2 AM cron (`deploy.sh` installed it) and add GCE **disk snapshots** for `muslimbot-data`.

---

## 10. Verify (go/no-go)

```bash
./setup.sh verify             # health + /v1/mcp/servers + prints any remaining human-gated items
```
Then run `TEST_PLAN_GENUI_ORCHESTRATOR.md` §A–G against the live domain. **Go-live is true when:**
- [ ] All subdomains serve valid TLS; `https://api.<domain>/v1/sys/health` green.
- [ ] SSO spans GenUI → ERP → Chatwoot → TryPost; ERP still reachable for API tokens.
- [ ] `/v1/mcp/servers` both `connected`; the GenUI agent drives Chatwoot + TryPost tools.
- [ ] Forged `X-authentik-email` from a non-Traefik peer → 401 (G2).
- [ ] No `changeme`/blank secrets (`MustValidate` passes); backups run **and a restore was drilled**.
- [ ] ≥1 business onboarded and tenant-isolated. **No HA claimed.**

---

## 10b. Knowledge Base cutover (ADR-0002 shared corpus)

1. Set in secrets env: `GCP_PROJECT_ID`, `GCP_LOCATION`, `GCS_BUCKET_NAME`,
   `GCP_RAG_CORPUS_ID_V2`, `RAG_ALLOW_UNFILTERED=false`, `REDIS_URL`.
2. Apply SQL: `go-orchestrator/migrations/20260718_kb_tenancy_v2.sql`.
3. Provision Vertex v2 corpus with metadata schema (`tenant_id`, `visibility`,
   `source_id`, `source_revision`, `schema_version`).
4. Re-import existing sources (staff upload/sync) so every RagFile has metadata.
5. Confirm `GET /v1/kb/health` reports `filtered_retrieval: true`.
6. Run [`../testing/TEST_PLAN_REALTIME_KB_TENANT_ISOLATION.md`](../testing/TEST_PLAN_REALTIME_KB_TENANT_ISOLATION.md).
7. Keep legacy `GCP_RAG_CORPUS_ID` read-only until rollback window closes.

Voice workers consume Redis Stream `kb:events:<tenant>` and call
`/v1/agent/kb/context` + `update_instructions` mid-call.

---

## 11. Day-2 quick reference

```bash
# status / logs
docker compose --env-file /opt/muslimbot/secrets/muslimbot.env -f docker-compose.yml -f ../docker-compose.extended.yml ps
docker compose ... logs -f go-orchestrator
# update
git -C /opt/muslimbot/repo pull && ./setup.sh stack && ./setup.sh init   # bench migrate runs via deploy.sh
# cost control (from the workstation)
gcloud compute instances stop "$(terraform output -raw instance_name)" --zone="$(terraform output -raw zone)"
# NEVER `docker compose down -v` in prod (destroys volumes). Roll back per-service to the previous image tag.
```
