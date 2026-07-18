# MuslimBot — Master Implementation Plan (current state → unified GCP VM, multi-business)

The single, ordered runbook to take MuslimBot from its **current repo state** to a
**production-grade, unified deployment on one GCP VM**, then **onboard multiple businesses**
(multi-tenant). It ties together the assets that already exist and fills the gaps.

**Ceiling:** single-host Docker Compose. No HA/multi-region (see `PRODUCTION_READINESS_PLAN.md` §8).

**Assets this plan orchestrates (already in the repo):**
- Infra: [`terraform/single-host/`](../../terraform/single-host/) (+ [`AS_BUILT.md`](../../terraform/single-host/AS_BUILT.md)) — VPC, VM, SSD data disk, firewalls, static IP, SA w/ Secret Manager accessor, disk-mount + Docker bootstrap.
- Unified app deploy: [`terraform/single-host/deploy-on-vm.sh`](../../terraform/single-host/deploy-on-vm.sh) — clones repo, roots Docker on the SSD, generates secrets, and brings up the **merged** stack.
- App init: `small_erp/scripts/deploy.sh`, `backup.sh`; `configs/n8n/*`.
- Mechanics reference: [`VM_DEPLOYMENT_PLAN.md`](VM_DEPLOYMENT_PLAN.md); strategy: [`GCP_DEPLOYMENT_ROADMAP.md`](GCP_DEPLOYMENT_ROADMAP.md); MCP/social: [`../architecture/ADR-0001-social-trypost-and-chatwoot-mcp.md`](../architecture/ADR-0001-social-trypost-and-chatwoot-mcp.md); verify: [`../testing/TEST_PLAN_GENUI_ORCHESTRATOR.md`](../testing/TEST_PLAN_GENUI_ORCHESTRATOR.md).

---

## Current-state snapshot (what's done vs pending)

| Area | State |
|---|---|
| GCP infra module | ✅ Proven (applied then destroyed for cost — `AS_BUILT.md`). Re-apply to recreate. |
| Unified stack deploy | ✅ `deploy-on-vm.sh` merges `docker-compose.yml` + `docker-compose.extended.yml` (`--profile support --profile voice`) on one env-file → resolves the old network/compose split (G3/P6). |
| Orchestrator hardening | ✅ Trusted-proxy (G2), fail-closed local bypass (G4), AI rate-limit (P8), boot config validation, MCP host + corner-case hardening. |
| Edge hardening wired in compose | ✅ `docker-compose.extended.yml`: Traefik pinned to static IP `172.28.0.2`; orchestrator defaults `ENV=production`, `AUTH_LOCAL_BYPASS=false`, `TRUSTED_PROXY_CIDRS=172.28.0.2/32`; `--api.insecure` dropped + dashboard unpublished (G5). Routers use `${PUBLIC_DOMAIN}`. |
| Social + agentic | ✅ TryPost stack + MCP host (TryPost HTTP + Chatwoot stdio); GenUI auth UI. |
| DNS / ACME TLS | ⛔ Pending (`AS_BUILT.md` §10). |
| Secret Manager values + boot fetch | ⛔ Pending — `deploy-on-vm.sh` self-generates today; SA already has accessor. |
| Backups / restore drill (P1) | ⛔ Pending (extend `backup.sh`). |
| Tenant fail-closed (G10) | ⛔ Pending — required before real multi-business onboarding. |
| bun in orchestrator image (Chatwoot stdio MCP) | ⛔ Pending (ADR-0001 §7). |

---

## PHASE 0 — Freeze the code (on your workstation)

**0.1** Land the pending hardening + finish the branch.
```bash
cd MuslimBot/go-orchestrator && go build ./... && go vet ./... && go test ./...
# commit the uncommitted hardening (config validate, ratelimit, trusted-proxy) on chore/repo-restructure
```
**0.2** Add **bun + vendored mcp-chatwoot** to `go-orchestrator/Dockerfile` so the Chatwoot stdio MCP can spawn in the container (else only TryPost HTTP tools connect).
**0.3** Confirm submodules resolve: `trypostit/trypost` → `vendor/trypost`; `fazer-ai/mcp-chatwoot` + `chatwoot-skills` under `mcp-servers/chatwoot-mcp/vendor/`.
**0.4** Push the branch to the remote `deploy-on-vm.sh` clones from.
**Done when:** CI green; branch pushed; submodules present.

## PHASE 1 — GCP project, APIs, auth (one-time)

```bash
gcloud auth login && gcloud auth application-default login
gcloud config set project <PROJECT_ID>
gcloud auth application-default set-quota-project <PROJECT_ID>
gcloud services enable compute.googleapis.com iam.googleapis.com \
  secretmanager.googleapis.com cloudresourcemanager.googleapis.com dns.googleapis.com
```
**Done when:** APIs enabled and propagated (the first `terraform apply` fails otherwise — see `AS_BUILT.md` §6).

## PHASE 2 — Secrets in Secret Manager (production path)

Store real secret **values** (the module already grants the VM SA `secretmanager.secretAccessor`):
```bash
for s in DB_ROOT_PASSWORD ADMIN_PASSWORD FRAPPE_API_KEY FRAPPE_API_SECRET \
         CHATWOOT_SECRET_KEY AUTHENTIK_SECRET_KEY GEMINI_API_KEY KB_BFF_API_KEY \
         WEBHOOK_SECRET TRYPOST_APP_KEY TRYPOST_DB_PASSWORD TRYPOST_API_TOKEN \
         CHATWOOT_API_TOKEN DB_PASS N8N_ENCRYPTION_KEY; do
  printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create "$s" --data-file=- 2>/dev/null \
    || echo "$s exists"
done
# (set real values for GEMINI_API_KEY, TRYPOST_API_TOKEN after TryPost is up, etc.)
```
Then have the VM fetch them into the env-file at deploy time (extends `deploy-on-vm.sh`):
```bash
gcloud secrets versions access latest --secret=GEMINI_API_KEY   # via SA on the VM, no keys on disk
```
**Guardrail:** `config.MustValidate()` fails the orchestrator's boot if a required secret is empty in production — so a misconfigured deploy stops loudly instead of running open.
**Done when:** all required secrets exist; the VM can read them with its SA.

## PHASE 3 — Provision the VM (Terraform)

```bash
cd MuslimBot/terraform/single-host
terraform init && terraform validate
terraform plan -out=tfplan          # Full profile = e2-standard-8 + pd-ssd (as-built)
terraform apply tfplan
terraform output instance_public_ip zone instance_name service_account_email
```
Low/MVP host: `-var='machine_type=e2-standard-4' -var='data_disk_type=pd-balanced'`.
For lasting prod also set `-var='deletion_protection=true'` and tighten `ssh_source_ranges`/`web_source_ranges`.
**Done when:** VM up; SSD mounted at `/opt/muslimbot/data`; Docker installed (bootstrap does this — verify per `AS_BUILT.md` §7).

## PHASE 4 — DNS + TLS (close the ACME gap)

**4.1** Point DNS at `instance_public_ip`: `A  <domain>` and `A  *.<domain>` for your `PUBLIC_DOMAIN` (wildcard covers `erp. app. api. chat. social. workflow. files. auth.`). `deploy-on-vm.sh` and the compose router rules read `PUBLIC_DOMAIN` from the env-file.
**4.2** Add a real ACME resolver to Traefik in `docker-compose.extended.yml` (today it's self-signed only). Cloudflare DNS-01 (works for wildcard, no port-80 dependency):
```yaml
- "--certificatesresolvers.le.acme.email=${ACME_EMAIL}"
- "--certificatesresolvers.le.acme.storage=/opt/muslimbot/data/traefik/acme.json"
- "--certificatesresolvers.le.acme.dnschallenge.provider=cloudflare"
# each router: traefik.http.routers.<r>.tls.certresolver=le
```
Set `CF_DNS_API_TOKEN`, `ACME_EMAIL`, `PLATFORM_BASE_DOMAIN=smb.<domain>` in the env-file. Drop `--api.insecure` and unpublish `:8090` for prod (G5).
**Done when:** `https://api.<domain>/v1/sys/health` serves a valid cert.

## PHASE 5 — Deploy the unified stack on the VM

```bash
gcloud compute ssh "$(terraform output -raw instance_name)" --zone="$(terraform output -raw zone)"
# on the VM — deploy-on-vm.sh does: clone, root Docker on SSD, gen/patch env-file, build, and:
#   docker compose --env-file /opt/muslimbot/secrets/muslimbot.env \
#     -f docker-compose.yml -f ../docker-compose.extended.yml \
#     --profile support --profile voice up -d
REPO_URL=<git-url> BRANCH=<branch> bash /path/to/deploy-on-vm.sh
```
Edit `/opt/muslimbot/secrets/muslimbot.env` (0600) with the Phase-2 secrets + Phase-4 domain/ACME + the wiring vars in Phase 7. Re-run the compose up.
**Done when:** `docker compose ps` shows all core + support + voice + edge + trypost services healthy.

## PHASE 6 — Initialize the datastores & apps

Run in order (idempotent):
1. **Frappe/ERPNext + small_erp:** `bash small_erp/scripts/deploy.sh` (creates the site, installs erpnext + small_erp, builds assets, wires n8n, installs the 2 AM backup cron). Then `bench ... execute small_erp.setup_permissions.run`.
2. **Authentik:** bootstrap admin at `https://auth.<domain>`; create the OIDC provider + application; configure the **ForwardAuth outpost**; add the `strip-identity-headers` → `authentik-forwardauth` middleware chain (see `traefik/dynamic/authentik.yml`).
3. **TryPost:** `php artisan migrate --force`; create admin; **Settings → API Keys** → set `TRYPOST_API_TOKEN`.
4. **Chatwoot:** finish setup; create an API access token → `CHATWOOT_API_TOKEN`.
**Done when:** each app reachable via its subdomain behind Traefik.

## PHASE 7 — Wire the system into one unified platform

Set in the env-file, then restart the affected services:

| Concern | Setting |
|---|---|
| Identity gate | Traefik ForwardAuth on `app. workflow. files. social.`; **ERP + TryPost MCP + Socket.IO stay reachable** for token/bearer clients (no ForwardAuth on `erp.` / `/mcp/trypost`) |
| Trusted proxy (G2) | Already defaulted in compose to Traefik's static IP `172.28.0.2/32` — **verify** Traefik holds that IP and nothing else on `platform-net` shares it; override `TRUSTED_PROXY_CIDRS` only if you change the topology |
| Local bypass (G4) | Compose defaults `AUTH_LOCAL_BYPASS=false`, `ENV=production` (bypass fails closed) — keep them |
| GenUI auth | `NEXT_PUBLIC_AUTHENTIK_URL=https://auth.<PUBLIC_DOMAIN>` (SSO login/signup screens) |
| MCP host | `TRYPOST_MCP_ENABLED=true`, `TRYPOST_MCP_URL=http://trypost/mcp/trypost`, `TRYPOST_API_TOKEN=…`, `CHATWOOT_MCP_ENABLED=true` |
| AI cost caps (P8) | `AI_RATE_LIMIT_PER_MIN`, `AI_RATE_LIMIT_BURST` |
| ERPNext OIDC | Social Login Key → Authentik (redirect `…/frappe.integrations.oauth2_logins.custom_sso_callback`) |
| n8n | import `configs/n8n/*`; set Frappe token credentials |

**Verify unity:**
```bash
curl -s https://api.<domain>/v1/sys/health
curl -s https://api.<domain>/v1/mcp/servers   # trypost + chatwoot → connected:true, tool_count>0
```
GenUI chat "What MCP tools can you use?" must trigger a real `mcp_list_tools`/`mcp_call` round-trip.
**Done when:** one SSO session moves across GenUI → ERP → Chatwoot → TryPost; the agent drives Chatwoot/TryPost tools; forged `X-authentik-email` → 401.

## PHASE 8 — Onboard different businesses (multi-tenant)

> **Blocker first:** close **G10** — tenant resolution must **fail closed** (no silent `"default"`) before onboarding real businesses. MCP tool calls and ERP/Chatwoot/TryPost access must carry and enforce tenant scope.

Per business (tenant), provision the isolated slice:
1. **ERP:** a Frappe site/company seed (see `scripts/provision-tenant.sh`, `api/admin.py`, `/v1/tenants` → `/v1/tenants/:id/onboard`).
2. **Identity:** an Authentik group; users mapped to the tenant (`TenantUserMapping`).
3. **Support:** a Chatwoot account (the MCP `account_id` scopes the 129 tools per tenant).
4. **Social:** a TryPost workspace + its own API token.
5. **Knowledge:** a per-tenant KB corpus/visibility.
6. **Routing:** tenant derived from host (`TenantFromHost`) — e.g. `acme.<domain>` → tenant `acme`.

**Isolation checks (must pass):** user A cannot read/act on tenant B's ERP, Chatwoot account, or TryPost workspace via any path incl. `/v1/mcp/call`.
**Done when:** two isolated tenants provisioned; cross-tenant access denied (verified).

## PHASE 9 — Backups & DR (before real data lands)

Extend `small_erp/scripts/backup.sh` to also dump **platform-postgres** (Authentik), **chatwoot**, **trypost-postgres**, and tar `frappe-sites`, `muslimbot-kb-data`, `authentik_media`, `trypost_storage`; push encrypted to a **GCS bucket**; keep the 2 AM cron. Write + **execute** `restore.sh` into a scratch stack (an untested backup is not a backup). Add GCE **disk snapshots** for `muslimbot-data`.
**Done when:** a full restore reproduces seeded ERP data, Authentik logins, and TryPost schedules.

## PHASE 10 — Observability, CI/CD, verification

- **Ops:** GCE Ops Agent; uptime checks on each `*.smb.<domain>`; scrape `/v1/sys/health` + `/v1/mcp/servers`; alert on container restarts and disk usage.
- **CI/CD:** build → test → image scan → push to Artifact Registry → VM `git pull` + `compose up -d`. Add a `/v1/mcp/servers` health assertion.
- **Acceptance:** run `TEST_PLAN_GENUI_ORCHESTRATOR.md` §A–G against the live domain.
**Done when:** dashboards + alerts live; acceptance suite green.

## PHASE 11 — Go-live Definition of Done

- [ ] Unified stack up behind Traefik with valid TLS; `/v1/sys/health` green.
- [ ] SSO works end-to-end incl. ERP-stays-reachable-for-tokens; forged identity header → 401 (G2).
- [ ] `/v1/mcp/servers` both connected; agent drives Chatwoot + TryPost from GenUI.
- [ ] No default/`changeme` secrets; `MustValidate` passes; secrets from Secret Manager.
- [ ] Tenant isolation fails closed (G10); ≥2 businesses provisioned and isolated.
- [ ] Backups run **and a restore drill is executed**; disk snapshots scheduled.
- [ ] **No HA claimed** — single-VM recoverable-not-highly-available.

## Day-2 operations

- **Update:** `git pull` on the VM → rebuild changed images → `compose up -d`; `bench migrate` after app changes.
- **Scale profiles:** drop `--profile voice`/`support` on constrained hosts; bump `machine_type` via Terraform for more headroom (still not HA).
- **Cost:** `gcloud compute instances stop` pauses vCPU/RAM billing (disks + IP still bill); `terraform destroy` clears the stack; snapshot-then-destroy to keep data cheaply (`AS_BUILT.md` §9).
- **Rollback:** per-service `compose up -d --no-deps <svc>` at the previous tag; data from the latest verified backup. **Never** `down -v` in prod.
