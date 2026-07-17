# MuslimBot — Full VM Deployment Plan (single host)

**Audience:** operator deploying the whole MuslimBot platform onto one VM (GCE / any cloud / bare
metal). **Ceiling:** single-host Docker Compose — **no HA** (see `PRODUCTION_READINESS_PLAN.md` §8).
**Companion:** `GCP_DEPLOYMENT_ROADMAP.md` (strategy/phasing) and `ADR-0001` (TryPost + MCP).

This is an operational runbook: provision → configure → build → bring up in order → initialize →
verify → operate. It calls out the current integration gaps you must reconcile.

---

## 0. What gets deployed (system map)

Three Compose layers run together on the VM:

| Layer | File | Services |
|---|---|---|
| **Application** (baked image) | `MuslimBot/docker-compose.yml` | ERPNext+`small_erp` (`frappe-web`,`-worker-default`,`-scheduler`,`-socketio`), `mariadb`, `redis-cache/-queue/-socketio`, `n8n`, `muslimbot-kb-bff` (:8787), `generative-ui` |
| ↳ profile `support` | same | `chatwoot-rails` (:3000), `chatwoot-worker`, `postgres-shared`, `shared-redis` |
| ↳ profile `voice` | same | `muslimbot-voice-worker`, `livekit`, `livekit-redis`, `egress` |
| **Platform / edge** | `docker-compose.extended.yml` | `traefik` (:80/:443), `authentik-server/-worker`, `platform-postgres`, `platform-redis`, `go-orchestrator` (MCP host) |
| ↳ Social + agentic | same | `trypost`, `trypost-postgres`, `trypost-horizon`, `trypost-scheduler` |

Agentic layer: `go-orchestrator` ingests **TryPost MCP** (HTTP `/mcp/trypost`) and
**fazer-ai/mcp-chatwoot** (stdio, 129 tools); GenUI's AI drives both via `/v1/ai/chat`.

## 1. Resource budget & VM sizing

| Group | Approx RAM |
|---|---|
| Core app (frappe+mariadb+redis+n8n+kb+genui) | ~4.5 GB |
| `support` (Chatwoot + shared PG/Redis) | ~3.3 GB |
| `voice` (LiveKit + worker + egress) | ~2.1 GB |
| Platform (Traefik + Authentik + orchestrator) | ~1.6 GB |
| TryPost (app + PG + horizon + scheduler) | ~1.2 GB |
| **Full stack + OS headroom** | **~14–15 GB → provision 16 GB min, 32 GB comfortable** |

- **VM:** 8 vCPU / 32 GB (e.g. GCE `e2-standard-8`), Ubuntu 22.04 LTS, **PD-SSD ≥ 100 GB**.
- Constrained host? Start core-only; add `--profile support` / `--profile voice` later.
- **Firewall:** inbound **22, 80, 443** only. LiveKit voice also needs **7880/7881 TCP + 50000-50100/UDP**
  (open only if voice is public).

## 2. Prerequisites (on the VM)

```bash
# Docker Engine + Compose v2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # re-login
docker compose version

# Build toolchain for images (Go, Node, bun for the Chatwoot MCP)
sudo apt-get update && sudo apt-get install -y git make
curl -fsSL https://bun.sh/install | bash    # if building mcp-chatwoot outside the image

# DNS: create A records for the base domain and wildcard →
#   smb.<domain>  and  *.smb.<domain>  → VM public IP
```

## 3. Get the code + vendored submodules

```bash
git clone <repo> && cd liteERP     # branch: chore/repo-restructure (until merged)
cd MuslimBot

# Agentic dependencies (ADR-0001 §7)
git submodule add https://github.com/trypostit/trypost           vendor/trypost
git submodule add https://github.com/fazer-ai/mcp-chatwoot        mcp-servers/chatwoot-mcp/vendor/mcp-chatwoot
git submodule add https://github.com/fazer-ai/chatwoot-skills     mcp-servers/chatwoot-mcp/vendor/chatwoot-skills
git submodule update --init --recursive
```

> **Image change required:** the orchestrator image must bundle **`bun`** + the vendored
> `mcp-chatwoot` so it can spawn the stdio Chatwoot MCP. Add to `go-orchestrator/Dockerfile`:
> install bun, `COPY mcp-servers/chatwoot-mcp/vendor/mcp-chatwoot` and `scripts/mcp/`, `bun install`.
> Without this, only TryPost's HTTP MCP tools are available (TryPost still works).

## 4. Secrets & `.env` (fail loud, no defaults)

Copy the template and fill **every** secret. Generate strong values; the platform must refuse to
start if any required secret is empty (readiness G6/P5).

```bash
cp .env.template .env
# generate secrets
openssl rand -hex 32   # DB/root, AUTHENTIK_SECRET_KEY, N8N_ENCRYPTION_KEY, CHATWOOT_SECRET_KEY, WEBHOOK_SECRET
# TryPost app key (Laravel):  docker run --rm muslimbot/trypost:local php artisan key:generate --show
```

Required keys (superset — trim per enabled profiles). **Replace the stale `POSTIZ_*`/`TEMPORAL_*`
entries in the template with the `TRYPOST_*` set below:**

| Group | Vars |
|---|---|
| Core DB / admin | `DB_ROOT_PASSWORD`, `DB_PASSWORD`, `DB_NAME`, `ADMIN_PASSWORD`, `FRAPPE_SITE_NAME`, `FRAPPE_SITE_HOST` |
| Frappe ↔ n8n | `FRAPPE_API_KEY`, `FRAPPE_API_SECRET`, `N8N_USER`, `N8N_PASSWORD`, `N8N_ENCRYPTION_KEY` |
| AI / KB | `GEMINI_API_KEY`, `KB_BFF_API_KEY` |
| Identity / edge | `DOMAIN`, `ACME_EMAIL`, `CF_DNS_API_TOKEN`, `DB_PASS` (platform PG), `AUTHENTIK_SECRET_KEY` |
| Chatwoot | `CHATWOOT_DB_PASSWORD`, `CHATWOOT_SECRET_KEY`, `CHATWOOT_API_TOKEN`, `POSTGRES_SHARED_PASSWORD` |
| **TryPost** | `TRYPOST_APP_KEY`, `TRYPOST_DB_PASSWORD`, `TRYPOST_API_TOKEN` (Settings→API Keys, post-boot) |
| **MCP** | `TRYPOST_MCP_ENABLED=true`, `TRYPOST_MCP_URL=http://trypost/mcp/trypost`, `CHATWOOT_MCP_ENABLED=true` |
| Voice (optional) | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` |
| Webhooks | `WEBHOOK_SECRET` |

> `.env` is gitignored — never commit it. Long term, source these from a secret manager at boot (P5).

## 5. Reconcile the network + edge (required — current gap)

The edge overlay (`docker-compose.extended.yml`) today `extends` the **dev** compose and uses the
external network `liteerp_smb-net-local`, while the baked app stack uses `smb-net`. On a VM you must
join them on one shared network (gap G3/P6):

```bash
# 1) one shared data-plane network both stacks attach to
docker network create smb-shared

# 2) point BOTH compose files' external app network at smb-shared:
#    - MuslimBot/docker-compose.yml       networks.smb-net  -> external, name: smb-shared
#    - docker-compose.extended.yml        networks.smb-net-local -> external, name: smb-shared
#    (or add a small compose override that redefines these networks)
```

Also add a **real ACME resolver** to Traefik (none is configured — self-signed only, gap P4). Use
Cloudflare DNS-01 with `CF_DNS_API_TOKEN`:

```yaml
# add to the traefik service command in docker-compose.extended.yml
- "--certificatesresolvers.le.acme.email=${ACME_EMAIL}"
- "--certificatesresolvers.le.acme.storage=/etc/traefik/acme.json"
- "--certificatesresolvers.le.acme.dnschallenge.provider=cloudflare"
# and per-router: traefik.http.routers.<r>.tls.certresolver=le
# drop "--api.insecure=true" and the :8090 dashboard port for production (gap G5)
```

## 6. Build images

```bash
cd MuslimBot
docker build -t small-erp:latest .                                  # ERPNext + small_erp (root Dockerfile)
docker build -t muslimbot-voice-agent:latest ./Muslimbot-voice-agent
docker build -t generative-ui:latest ./generative-ui
docker compose -f docker-compose.extended.yml build go-orchestrator  # after adding bun to its Dockerfile
docker compose -f docker-compose.extended.yml build trypost          # from vendor/trypost
```

## 7. Bring-up order (state → app → edge → agentic)

```bash
cd MuslimBot
# 7.1 Application stack (+ profiles you want)
docker compose --profile support --profile voice up -d

# 7.2 Initialize Frappe site + ERPNext + small_erp (idempotent script)
bash small_erp/scripts/deploy.sh            # or install-demo.sh for the baked image path
#   creates site, installs erpnext + small_erp, builds assets, wires n8n, sets backup cron

# 7.3 Platform / edge + TryPost
docker compose -f docker-compose.extended.yml up -d
```

`deploy.sh` already: validates `.env`, hardens the host (ufw, sshd, unattended-upgrades), waits for
MariaDB health, creates the site, installs ERPNext + `small_erp`, and installs a **2 AM backup cron**.

## 8. Post-deploy configuration

1. **ERPNext:** log in at `https://erp.<domain>/app` as `Administrator`, **change the password now**.
   Run `bench ... execute small_erp.setup_permissions.run` and `small_erp.seed_demo.create_demo_data` (demo).
2. **Authentik:** bootstrap admin, create the OIDC provider + application; configure the Traefik
   **ForwardAuth outpost**; add `strip-identity-headers` then `authentik-forwardauth` middleware chain
   (blank client-supplied `X-authentik-*`, then validate) — closes gap G2.
3. **ERPNext OIDC** (keep ERP reachable for API tokens/webhooks/Socket.IO — no ForwardAuth on `erp.*`):
   create the Social Login Key pointing at Authentik (`/application/o/authorize/`, token endpoint,
   redirect `…/frappe.integrations.oauth2_logins.custom_sso_callback`).
4. **Chatwoot:** first-run setup; create an **API access token** → set `CHATWOOT_API_TOKEN` (used by
   both the portal SSO bridge and the Chatwoot MCP). Import n8n support-RAG workflow.
5. **TryPost:** run migrations (`php artisan migrate --force`), create an admin, then **Settings → API
   Keys** → generate a key → set `TRYPOST_API_TOKEN`. MCP endpoint is `http://trypost/mcp/trypost`.
6. **n8n:** import workflows from `configs/n8n/`; set Frappe token credentials.
7. **Enable MCP:** with `TRYPOST_MCP_ENABLED`/`CHATWOOT_MCP_ENABLED=true`, restart `go-orchestrator`;
   confirm `GET /v1/mcp/servers` shows both `connected: true`.

## 9. Verify

Run the suite in `docs/testing/TEST_PLAN_GENUI_ORCHESTRATOR.md` (sections A–G) against the live VM:

```bash
curl -sf https://api.<domain>/v1/sys/health
curl -s https://api.<domain>/v1/mcp/servers    # trypost + chatwoot connected:true, tool_count>0
```
Then drive GenUI: sidebar shows **TryPost** (no Postiz); chat "What MCP tools can you use?" triggers a
real `mcp_list_tools` round-trip; Chatwoot/TryPost tabs load via SSO.

## 10. Operate

- **Backups (P1):** extend `small_erp/scripts/backup.sh` to also `pg_dump` platform-postgres,
  chatwoot, and **trypost-postgres**, tar volumes (`frappe-sites`, `muslimbot-kb-data`,
  `authentik_media`, `trypost_storage`), push to off-VM object storage (GCS), encrypt at rest.
  **Run a restore drill** — an untested backup is not a backup.
- **Updates:** `git pull` → rebuild changed images → `docker compose up -d` (rolling per-service).
  Run `bench migrate` after `small_erp`/ERPNext changes.
- **TLS:** Traefik auto-renews via ACME; monitor `acme.json`.
- **Monitoring:** scrape `/v1/sys/health`, `/v1/mcp/servers`; watch `docker compose ps` + logs;
  alert on container restarts and disk usage.
- **Snapshots:** schedule PD snapshots (recoverable, not HA).

## 11. Known gaps to close before onboarding real businesses

| Gap | Action |
|---|---|
| **G3/P6** compose layers don't unify; network name mismatch | §5 reconciliation now; long-term move to `infra/compose/` base+overlays (restructure Phase 2) |
| **G6/P5** default secrets / no secret manager | fail-loud `.env`; wire GCP Secret Manager |
| **P4/G5** no ACME; Traefik insecure API | §5 adds Cloudflare DNS-01; drop `--api.insecure` |
| **G2** orchestrator trusts `X-authentik-*` directly | strip-then-validate middleware (§8.2) |
| **G10** tenant resolution falls back to `default` | make fail-closed before multi-tenant onboarding |
| **P1** no backups/restore | §10 backup+restore drill before go-live |
| bun/MCP image | §3 bundle bun+vendored mcp-chatwoot into orchestrator image |

## 12. Rollback

- Per-service: `docker compose up -d --no-deps <service>` with the previous image tag.
- Data: restore from the latest verified backup into a scratch stack, validate, then cut over.
- Full: `docker compose down` (keep volumes) → redeploy prior tag. **Never** `down -v` in prod (destroys data).
