# MuslimBot — Agent Deployment Guide (Terraform VM → Unified Business System)

**Audience:** an autonomous agent (or operator) with SSH/gcloud access. This ONE document
takes you from nothing to a **fully unified MuslimBot system** on a fresh GCP VM:

- ERPNext + small_erp (`/ops`), **Frappe Builder** (blog/website), Chatwoot (support),
  TryPost (social), n8n (automation), Knowledge Base (RAG), voice (optional)
- **go-orchestrator** as the single `/v1/*` backend: Authentik **SSO**, portal **embeds**,
  and the **MCP host** (Chatwoot + TryPost tools)
- **generative-ui** as the ONE pane: dashboards, embedded sub-system UIs, and an
  MCP-capable agent chat that drives every system
- A **seeded demo business** (company, items, stock, customers, invoices, payments,
  support conversation, workflows, blog) and a **final credentials handoff**

Grounded in: [`setup.sh`](../../setup.sh) (root orchestrator),
[`terraform/single-host/`](../../terraform/single-host/) (infra + `deploy-on-vm.sh`),
[`RUNBOOK.md`](RUNBOOK.md), [`COMPOSE.md`](../../../COMPOSE.md),
[`GENUI_UNIFIED_IMPLEMENTATION_PLAN.md`](../architecture/GENUI_UNIFIED_IMPLEMENTATION_PLAN.md),
[ADR-0001](../architecture/ADR-0001-social-trypost-and-chatwoot-mcp.md).

---

## Agent rules (read first)

1. **Run phases in order.** Each phase ends with a ✅ *Verify* block — do not proceed until it
   passes. Phases are idempotent; re-running a phase is safe unless marked DESTRUCTIVE.
2. **Two contexts.** Phases 1–2 run on the **operator workstation** (terraform + gcloud).
   Everything from Phase 3 runs **on the VM** at `/opt/muslimbot/repo/MuslimBot`.
3. **The env-file is the config:** `/opt/muslimbot/secrets/muslimbot.env` (mode 0600). Edit it
   only there. Never commit it, never paste its full contents into logs; the credentials
   handoff (Phase 15) names the specific keys to report.
4. **Billable/destructive actions** (terraform apply/destroy, `restore`) always confirm.
   NEVER run `docker compose down -v` on this stack — it destroys data volumes.
5. **Canonical hostnames** (older docs use stale ones — `chat.`, `workflow.`, `app.` are WRONG):

   | Subdomain | System | Notes |
   |---|---|---|
   | `ui.<domain>` | **generative-ui** — the single pane | SSO-protected |
   | `api.<domain>` | go-orchestrator `/v1/*` | SSO-protected (strip-then-auth chain) |
   | `auth.<domain>` | Authentik | identity provider |
   | `erp.<domain>` | ERPNext / small_erp `/ops` | **NO ForwardAuth** (token clients) |
   | `builder.<domain>` | Frappe Builder (same frappe-web) | blog/website editor |
   | `chatwoot.<domain>` | Chatwoot | support |
   | `social.<domain>` | TryPost | social scheduling |
   | `n8n.<domain>` | n8n | workflows |

6. **Shell prelude on the VM** — every VM phase assumes:
   ```bash
   cd /opt/muslimbot/repo/MuslimBot
   ENVF=/opt/muslimbot/secrets/muslimbot.env
   dc() { docker compose --env-file "$ENVF" -f docker-compose.yml -f ../docker-compose.extended.yml --profile support --profile voice "$@"; }
   SITE="$(grep '^FRAPPE_SITE_NAME=' "$ENVF" | cut -d= -f2)"
   DOMAIN="$(grep '^PUBLIC_DOMAIN=' "$ENVF" | cut -d= -f2)"
   bench_exec() { dc exec -T frappe-web bench --site "$SITE" "$@"; }
   ```

---

## Phase 0 — Inputs (collect before starting)

| Input | Required | Where used |
|---|---|---|
| GCP project with billing + `gcloud` auth (`gcloud auth application-default login`) | yes | Phase 1 |
| **Gemini API key** (Google AI Studio) | yes | AI brain + MCP agent (Phase 3) |
| Domain choice: default **`<IP>.nip.io`** (zero-config, self-signed TLS) or a **real domain** + Cloudflare DNS token (ACME) | yes | Phase 4 |
| LiveKit URL/key/secret | optional | voice profile |
| GCP Vertex RAG project vars (`GCP_PROJECT_ID`, `GCS_BUCKET_NAME`, …) | optional | KB v2 cutover (RUNBOOK §10b) |

Workstation tools: `git`, `terraform`, `gcloud`. Check with `./setup.sh preflight`.

---

## Phase 1 — Provision the VM (workstation, BILLABLE)

```bash
cd MuslimBot
./setup.sh preflight
./setup.sh provision          # terraform -chdir=terraform/single-host: init → validate → plan → CONFIRM → apply
```

Defaults (override with `-var` / tfvars): `e2-standard-8` (32 GB), 100 GB `pd-ssd` data disk
mounted at `/opt/muslimbot/data`, static public IP, custom VPC + firewall (80/443/SSH/LiveKit),
service account with Secret Manager access. Low-cost profile: `machine_type=e2-standard-4`,
`data_disk_type=pd-balanced`.

✅ **Verify**
```bash
terraform -chdir=terraform/single-host output -raw instance_public_ip   # note this IP
terraform -chdir=terraform/single-host output -raw instance_name
gcloud compute ssh "$(terraform -chdir=terraform/single-host output -raw instance_name)" \
  --zone="$(terraform -chdir=terraform/single-host output -raw zone)" --command='docker --version && df -h /opt/muslimbot/data'
```

---

## Phase 2 — Bootstrap the VM (workstation drives it)

```bash
./setup.sh deploy    # streams terraform/single-host/deploy-on-vm.sh to the VM over SSH
```

What `deploy-on-vm.sh` does (idempotent): directory layout on the SSD, Docker
`data-root` → `/opt/muslimbot/data/docker`, clone repo (branch `chore/repo-restructure`) to
`/opt/muslimbot/repo`, init submodules (**trypost**, mcp-chatwoot, chatwoot-skills), generate
`/opt/muslimbot/secrets/muslimbot.env` from `.env.template` with **random secrets
auto-generated** (DB/admin/n8n/Chatwoot/Authentik/TryPost keys) and
`PUBLIC_DOMAIN=<IP>.nip.io` auto-detected, then build + start the full merged stack and run
`install-demo.sh`.

✅ **Verify** — SSH in; all subsequent phases run there:
```bash
gcloud compute ssh <instance_name> --zone=<zone>
ls /opt/muslimbot/repo/MuslimBot && ls -la /opt/muslimbot/secrets/muslimbot.env   # 0600
git -C /opt/muslimbot/repo submodule status | grep -E "trypost|mcp-chatwoot"      # both present
```
> If `mcp-chatwoot` is missing, the Chatwoot MCP server cannot spawn (ADR-0001 §7) — fix the
> submodule before Phase 11.

---

## Phase 3 — Finish the env-file (VM)

`deploy-on-vm.sh` generated most secrets. Set what it cannot know (edit `$ENVF`):

```bash
# REQUIRED — production floor (orchestrator refuses to boot otherwise: config.MustValidate)
ENV=production
AUTH_LOCAL_BYPASS=false
TRUSTED_PROXY_CIDRS=172.28.0.2/32        # Traefik's static IP on platform-net (G2)

# REQUIRED — AI brain (same key, three names)
GEMINI_API_KEY=<key>  GOOGLE_API_KEY=<key>  VITE_GEMINI_API_KEY=<key>

# REQUIRED — MCP layer flags (tokens filled in Phases 8–10)
CHATWOOT_MCP_ENABLED=true
TRYPOST_MCP_ENABLED=true
TRYPOST_MCP_URL=http://trypost/mcp/trypost

# REQUIRED — GenUI SSO screens
NEXT_PUBLIC_AUTHENTIK_URL=https://auth.<PUBLIC_DOMAIN>

# Cost cap
AI_RATE_LIMIT_PER_MIN=30
AI_RATE_LIMIT_BURST=10

# LEFT BLANK FOR NOW (filled by later phases): FRAPPE_API_KEY, FRAPPE_API_SECRET,
# CHATWOOT_API_TOKEN, TRYPOST_API_TOKEN
```

✅ **Verify:** `grep -E '^(ENV|AUTH_LOCAL_BYPASS|GEMINI_API_KEY|NEXT_PUBLIC_AUTHENTIK_URL)=' $ENVF`
shows all four set (don't print the key value in logs).

---

## Phase 4 — DNS + TLS

**Path A (default, demo): nip.io** — nothing to do; `PUBLIC_DOMAIN=<IP>.nip.io` resolves every
subdomain to the VM. Traefik serves self-signed TLS → use `curl -k` and accept browser warnings.
⚠ Third-party-cookie SSO inside iframes is flaky on self-signed certs; full embed UX needs Path B.

**Path B (production): real domain** — at your DNS provider add `A <domain>` and
`A *.<domain>` → the VM IP. Set `PUBLIC_DOMAIN=<domain>`, `ACME_EMAIL`, `CF_DNS_API_TOKEN` in
`$ENVF`; confirm Traefik's `le` (Cloudflare DNS-01) certresolver is enabled on routers
(MASTER_IMPLEMENTATION_PLAN §4). Then re-run Phase 5.

---

## Phase 5 — Bring up the unified stack

```bash
cd /opt/muslimbot/repo/MuslimBot
./setup.sh stack     # build + up -d (base + edge + trypost, profiles support+voice); waits for MariaDB
dc ps
```

✅ **Verify:** all of these are `Up`/healthy: `frappe-web` + workers/scheduler/socketio,
`mariadb`, `redis-*`, `n8n`, `generative-ui`, `chatwoot-*`, `traefik`, `authentik-server/worker`,
`platform-postgres`, `platform-redis`, `go-orchestrator`, `trypost`+`horizon`+`scheduler`
(+ voice/livekit if profiled). And the edge answers:
```bash
curl -sk https://api.$DOMAIN/v1/sys/health | head -c 200    # JSON health
curl -sk -o /dev/null -w '%{http_code}\n' https://auth.$DOMAIN/   # 200/302 (Authentik)
```

---

## Phase 6 — ERPNext + small_erp init, API keys

```bash
./setup.sh init      # small_erp/scripts/deploy.sh: creates site, installs erpnext+small_erp, builds assets, wires n8n webhooks, backup cron
```

Then mint the machine credentials n8n/orchestrator use:
1. Open `https://erp.$DOMAIN/app` — login `Administrator` / `ADMIN_PASSWORD` (from `$ENVF`).
2. Create API key+secret (User → Administrator → Settings → API Access → Generate Keys).
3. Put them in `$ENVF` as `FRAPPE_API_KEY` / `FRAPPE_API_SECRET`, then `./setup.sh stack`.

✅ **Verify:**
```bash
curl -sk https://erp.$DOMAIN/api/method/frappe.auth.get_logged_user \
  -H "Authorization: token $FRAPPE_API_KEY:$FRAPPE_API_SECRET"     # → "Administrator"
```

---

## Phase 7 — Frappe Builder (blog/website)

The Traefik route `builder.$DOMAIN` → frappe-web already exists, but the **builder app is not
installed** in the image — install it into the running bench:

```bash
dc exec -T frappe-web bash -lc "cd /home/frappe/frappe-bench && bench get-app builder https://github.com/frappe/builder"
bench_exec install-app builder
dc exec -T frappe-web bash -lc "cd /home/frappe/frappe-bench && bench build --app builder"
# Single-site host resolution: make every Host (incl. builder.<d>) resolve to the site
dc exec -T frappe-web bash -lc 'echo "'"$SITE"'" > /home/frappe/frappe-bench/sites/currentsite.txt'
dc restart frappe-web frappe-worker-default frappe-worker-short frappe-worker-long frappe-scheduler
```
> ⚠ `bench get-app` installs into the container's writable layer — it will NOT survive an image
> rebuild. For permanence, add builder to the root `Dockerfile` bake (`get-app` + `apps.txt`)
> and rebuild `small-erp:latest`. Do the container install now, note the Dockerfile follow-up.

Create the demo blog: open `https://builder.$DOMAIN/builder` (Administrator), create a site
from a template, add 2 posts ("Welcome to our store", "This month's offers"), **Publish**.

✅ **Verify:** `curl -sk -o /dev/null -w '%{http_code}\n' https://builder.$DOMAIN/builder` → `200`;
the published page renders at its route.

---

## Phase 8 — Authentik SSO (the ONE login)

At `https://auth.$DOMAIN`:
1. **Bootstrap admin** (`akadmin`) — set a strong password; record for Phase 15.
2. Create **OIDC Provider + Application** for the platform (name: `muslimbot-platform`).
3. Enable the **embedded ForwardAuth outpost** covering the protected hosts.
4. The Traefik middleware chain already exists ([`traefik/dynamic/authentik.yml`](../../traefik/dynamic/authentik.yml)):
   `authentik-auth` = `strip-identity-headers` → `authentik-forwardauth` (S-1). Routers for
   `ui.` and `api.` already reference `authentik-auth@file`; `erp.` deliberately has none.
5. **ERPNext ↔ Authentik OIDC:** in ERPNext create a Social Login Key (Authentik authorize/token
   endpoints; redirect `…/api/method/frappe.integrations.oauth2_logins.custom_sso_callback`;
   enable "create user if not exists"). ERP stays token-reachable for n8n/webhooks.
6. Create the **demo business user**: Authentik → Users → `demo@<domain>` (name "Demo Manager"),
   set password, add to the platform application's group.

✅ **Verify:** private-browser → `https://ui.$DOMAIN` redirects to Authentik login; after login
as `demo@…` the GenUI workspace loads. Forged identity is rejected:
```bash
curl -sk -H "X-authentik-email: attacker@evil" https://api.$DOMAIN/v1/auth/me   # 302→login or 401, NEVER 200 (G2/S-1)
```

---

## Phase 9 — Chatwoot (support)

1. Finish first-run at `https://chatwoot.$DOMAIN` → create the admin account (record creds).
2. Create an **API access token** (Profile Settings) → `CHATWOOT_API_TOKEN=` in `$ENVF`.
   If a Platform App token is available, also set `CHATWOOT_PLATFORM_TOKEN` (used by the
   magic-link portal embed).
3. Create an **Inbox** (Website channel, name "Website") and add agent(s).
4. Add a **webhook** (Settings → Integrations → Webhooks) → `https://n8n.$DOMAIN/webhook/chat-support`
   for the support-RAG loop (activated in Phase 11).
5. **Demo conversation** (so the seeded business has a support queue):
   ```bash
   CW=https://chatwoot.$DOMAIN/api/v1/accounts/1
   T="api_access_token: $CHATWOOT_API_TOKEN"
   CID=$(curl -sk -H "$T" -XPOST $CW/contacts -d 'name=Ayesha Rahman&email=ayesha@example.com' | python3 -c 'import sys,json;print(json.load(sys.stdin)["payload"]["contact"]["id"])')
   CONV=$(curl -sk -H "$T" -XPOST $CW/conversations -H 'Content-Type: application/json' \
     -d "{\"contact_id\":$CID,\"inbox_id\":1}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
   curl -sk -H "$T" -XPOST $CW/conversations/$CONV/messages -H 'Content-Type: application/json' \
     -d '{"content":"Salam — do you have the Classic Prayer Mat in stock? I need 3 for Friday.","message_type":"incoming"}'
   ```

✅ **Verify:** conversation visible in the Chatwoot UI; `CHATWOOT_API_TOKEN` set in `$ENVF`.

---

## Phase 10 — TryPost (social)

```bash
dc exec trypost php artisan migrate --force        # if first-run didn't
```
1. Create the admin at `https://social.$DOMAIN` (record creds), create workspace "Demo Business".
2. **Settings → API Keys** → generate → `TRYPOST_API_TOKEN=` in `$ENVF`.
3. (Optional, needs real provider OAuth apps) connect social accounts. Without them the agent
   can still draft/schedule internally — publishing to networks stays pending.

✅ **Verify:** `TRYPOST_API_TOKEN` set; `https://social.$DOMAIN` logs in.

---

## Phase 11 — n8n (automation fabric)

At `https://n8n.$DOMAIN` (basic auth `admin` / `N8N_PASSWORD` from `$ENVF`):
1. Add **Header Auth credential** for Frappe: header `Authorization`, value
   `token FRAPPE_API_KEY:FRAPPE_API_SECRET`.
2. Import + **activate** every workflow JSON:
   - [`small_erp/configs/n8n/`](../../small_erp/configs/n8n/): `workflow-ai-assistant.json`,
     `workflow-erp-events.json`, `workflow-chat-support-rag.json`
   - [`configs/n8n/`](../../configs/n8n/): `workflow-chatwoot-support-vertex.json`,
     `workflow-nextcloud-kb-ingest.json`
3. Point workflow credentials at Chatwoot (`CHATWOOT_API_TOKEN`) and the orchestrator KB
   (`ORCHESTRATOR_SERVICE_API_KEY`) where the imported nodes require them.

This wires the cross-system loops: **ERP doc events → n8n → Chatwoot notes**, and
**Chatwoot webhook → n8n → KB RAG → suggested reply** (loop-guarded).

✅ **Verify:** create a draft Sales Invoice in `https://erp.$DOMAIN/ops/orders` → the
`erp-events` execution appears in n8n; send a new customer message in Chatwoot → the
support-RAG workflow fires.

---

## Phase 12 — Enable the MCP layer (agent tools)

All tokens now exist. Restart so the orchestrator connects its MCP servers:
```bash
./setup.sh stack
sleep 10
curl -sk https://api.$DOMAIN/v1/mcp/servers -H "Cookie: <authentik session>"   # or run via GenUI below
```
Chatwoot MCP is a **stdio subprocess** (bun + vendored `fazer-ai/mcp-chatwoot`, launched by
[`scripts/mcp/run-chatwoot-mcp.sh`](../../scripts/mcp/run-chatwoot-mcp.sh)); the orchestrator
compose must bind-mount `mcp-servers/chatwoot-mcp/vendor/mcp-chatwoot` →
`/opt/mcp/chatwoot-mcp/vendor/mcp-chatwoot` (see the note in
[`go-orchestrator/Dockerfile`](../../go-orchestrator/Dockerfile)). TryPost MCP is plain HTTP
(`TRYPOST_MCP_URL`).

✅ **Verify:** `/v1/mcp/servers` shows **`trypost` and `chatwoot` with `connected: true`** and
non-zero `tool_count`. If chatwoot is missing: check the submodule + bind-mount; if trypost:
check `TRYPOST_API_TOKEN` and that `trypost` container is healthy.

---

## Phase 13 — generative-ui: the single pane

The canonical GenUI is the repo-root [`generative-ui/`](../../../generative-ui/) (Next.js 16).
Build notes (already wired in compose):
- `NEXT_PUBLIC_API_URL` stays **empty** → browser calls same-origin `/v1/*`, which
  `next.config.ts` rewrites to `ORCHESTRATOR_URL` (default `http://go-orchestrator:8080`).
  The orchestrator has no CORS layer — same-origin is the only working path.
- `NEXT_PUBLIC_AUTHENTIK_URL` must be set at **build** time (it's inlined) — set it in `$ENVF`
  before `./setup.sh stack` builds the image, or force: `dc build generative-ui && dc up -d generative-ui`.
- Embeds: the `allow-embed` Traefik middleware (on chatwoot/n8n/trypost routers) strips
  `X-Frame-Options` and pins `frame-ancestors https://ui.<domain>`. Real-domain TLS is required
  for `SameSite=None` third-party cookies inside iframes (Phase 4 Path B).

✅ **Verify (the unified experience):** login at `https://ui.$DOMAIN` as `demo@…`:
1. **Dashboard** shows ERP KPIs (orchestrator gateway → live seeded data after Phase 14).
2. Nav → **Support / Social / Workflows** → each SecurePortal loads the embedded app with **no
   second login** (Chatwoot magic-link; n8n/TryPost via SSO). No `X-Frame-Options` console error.
3. Chat FAB → **Agent mode** → ask **“What tools can you use?”** → a real `mcp_list_tools`
   round-trip listing Chatwoot + TryPost tools.
4. Ask **“Summarize open support conversations”** → the agent calls Chatwoot MCP and returns
   Ayesha's prayer-mat question.
5. Ask **“Draft 3 posts for next week about our new arrivals”** → TryPost MCP drafts appear in
   `social.$DOMAIN`; **nothing publishes without an explicit confirm**.

---

## Phase 14 — Seed the demo business

```bash
./setup.sh seed
# = bench execute small_erp.finish_setup.finish          (skip setup wizard)
#   bench execute small_erp.seed_demo.create_demo_data   (fixtures, company "Lite Demo Inc",
#     3 warehouses, item groups, items + price list + stock, fiscal year,
#     customers, sales invoices + payment entries)
#   bench execute small_erp.setup_permissions.run        (SMB Manager/Operator grants)
```

Business operator login for `/ops` (desk-blocked, redirects to `/ops`):
```bash
dc exec -T frappe-web bench --site "$SITE" add-user demo.manager@business.local \
  --first-name Demo --last-name Manager --password '<StrongPass!>'
bench_exec execute frappe.client.insert --kwargs '{"doc":{"doctype":"Has Role","parenttype":"User","parent":"demo.manager@business.local","parentfield":"roles","role":"SMB Manager"}}'
```

Knowledge Base: in GenUI → Knowledge Base, upload 2–3 business docs (product FAQ, return
policy) so agent/RAG answers are grounded. (Vertex v2 corpus: RUNBOOK §10b.)

✅ **Verify:** `https://erp.$DOMAIN/ops` as `demo.manager@…` shows KPI cards with seeded revenue,
invoices in Orders, stock in Inventory; GenUI dashboard mirrors the same numbers; KB chat answers
from an uploaded doc.

---

## Phase 15 — Go/no-go + credentials handoff

```bash
./setup.sh verify        # health + /v1/mcp/servers + prints remaining human gates
./setup.sh backup        # first backup NOW; confirm the 2AM cron exists
```

**Go-live checklist** (all must pass — from RUNBOOK §10):
- [ ] All subdomains in the Phase-5 table serve TLS; `api./v1/sys/health` green
- [ ] ONE login (Authentik) spans GenUI → ERP → Chatwoot → TryPost → n8n
- [ ] `/v1/mcp/servers`: both `connected:true`; GenUI agent drives Chatwoot + TryPost (Phase 13 tests)
- [ ] Forged `X-authentik-email` → rejected (Phase 8 check)
- [ ] ERP events ripple: invoice → n8n → Chatwoot (Phase 11 check)
- [ ] Builder blog published; `/ops` + GenUI show the seeded business
- [ ] No `changeme`/blank secrets; backup taken **and restore drilled** (`./setup.sh restore` in a scratch window)

**Credentials to hand the user** (values live in `$ENVF` unless noted; deliver over a secure
channel, never in a commit or public log):

| System | URL | Account | Credential source |
|---|---|---|---|
| **Unified pane** | `https://ui.<domain>` | `demo@<domain>` | Authentik password (Phase 8.6) |
| Authentik admin | `https://auth.<domain>` | `akadmin` | set in Phase 8.1 |
| ERPNext admin | `https://erp.<domain>/app` | `Administrator` | `ADMIN_PASSWORD` |
| Business ops | `https://erp.<domain>/ops` | `demo.manager@business.local` | set in Phase 14 |
| Builder | `https://builder.<domain>/builder` | ERPNext Administrator | `ADMIN_PASSWORD` |
| Chatwoot | `https://chatwoot.<domain>` | admin created Phase 9 | recorded Phase 9 |
| TryPost | `https://social.<domain>` | admin created Phase 10 | recorded Phase 10 |
| n8n | `https://n8n.<domain>` | `admin` | `N8N_PASSWORD` |
| Machine: Frappe API | — | token pair | `FRAPPE_API_KEY:FRAPPE_API_SECRET` |
| Machine: MCP tokens | — | — | `CHATWOOT_API_TOKEN`, `TRYPOST_API_TOKEN` |

---

## Appendix A — Day-2 quick reference

```bash
dc ps                                   # status
dc logs -f go-orchestrator              # brain logs
git -C /opt/muslimbot/repo pull && ./setup.sh stack && ./setup.sh init   # update
gcloud compute instances stop <name> --zone=<zone>                      # cost control (workstation)
```

## Appendix B — Troubleshooting map

| Symptom | Likely cause | Fix |
|---|---|---|
| `api.`/`auth.` → 404 | router/middleware label drift | compare labels to Phase-5 table; `dc up -d traefik go-orchestrator authentik-server` |
| Portal iframe blank + `X-Frame-Options` console error | `allow-embed` middleware missing on that router | Phase 13 notes |
| Embedded app loops to its own login | third-party cookies blocked (self-signed / no `SameSite=None`) | move to real domain + ACME (Phase 4 B) |
| `/v1/mcp/servers`: chatwoot missing | mcp-chatwoot submodule or bind-mount absent | Phase 12 |
| GenUI chat: “Unable to reach the AI brain” | `GEMINI_API_KEY` empty, or GenUI built before env was set | Phase 3 + rebuild genui |
| Orchestrator won't boot | `MustValidate` failed (blank secret / bypass in prod) | `dc logs go-orchestrator`; fix `$ENVF` |
| `builder.` 404 after rebuild | builder app lives in container layer only | re-run Phase 7; bake into Dockerfile |
