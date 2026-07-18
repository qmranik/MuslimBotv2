# MuslimBot — Deployment & Unification Log (as-deployed)

Factual record of bringing the platform online on GCP and starting the silos→unified
transition. Host: **`muslimbot-host-prod`**, IP **`34.14.132.165`**, project
`gen-lang-client-0113022969`, zone `asia-south1-a`. Live behind Traefik on `*.34.14.132.165.nip.io`.

> Secrets and one-time links (Authentik recovery tokens, API keys) are **never** stored in this file.
> Procedures are documented; live values are handled out-of-band.

---

## 1. Infrastructure (Terraform)

- `terraform apply` in `terraform/single-host/` provisioned 10 resources: VPC, subnet, static IP,
  3 firewalls (22 / 80,443 / LiveKit), 100 GB `pd-ssd` data disk, `e2-standard-8` instance, service
  account + Secret Manager accessor. Spec in [`AS_BUILT.md`](../../terraform/single-host/AS_BUILT.md).
- VM startup script mounted the SSD at `/opt/muslimbot/data` and installed Docker + Compose.
- `deploy-on-vm.sh` cloned the repo, rooted Docker on the SSD, generated
  `/opt/muslimbot/secrets/muslimbot.env`, and set `PUBLIC_DOMAIN=34.14.132.165.nip.io` (nip.io
  wildcard — no registrar needed for the demo).

## 2. Application bring-up & fixes (single merged Compose project `muslimbot`)

Stack = `MuslimBot/docker-compose.yml` + `docker-compose.extended.yml`, profiles `support` + `voice`.

| Fix | Detail |
|---|---|
| Chatwoot Gemfile | Missing `devise-secure_password`; patched via a `chatwoot-gemfile` mounted into `chatwoot-rails`. |
| Chatwoot DB | `db:chatwoot_prepare` needed `pg_stat_statements`; temporarily granted the `chatwoot` PG user superuser to install the extension. |
| `DATABASE_URL` | Pointed to the shared Postgres correctly in `muslimbot.env`, then re-ran DB prepare. |
| Generative UI routing | Next.js served on **5173**, not 80/3000; Traefik label updated to route `ui.…nip.io` → `5173`. |

## 3. Post-deployment seeding & integration

- **Frappe/ERPNext seed:** ran `small_erp.finish_setup` + `small_erp.seed_demo`. Patch: Frappe v15
  lacked UoMs `Bottle`/`Box` → substituted `Nos`; demo items/customers seeded.
- **Frappe API keys:** generated Administrator key/secret via `bench execute` (CLI limitation
  workaround); written to `muslimbot.env`; restarted n8n + generative-ui to pick them up.
- **n8n workflows:** raw JSON copied in; CLI import flagged schema — imported manually in the n8n UI.

## 4. Edge unification fix — silos → reachable brain + SSO  (2026-07-18)

**Symptom:** apps reachable (`ui/erp/n8n` 200, `chatwoot/social` 302) but the **unifying layer was
not**: `api.` (go-orchestrator brain) and `auth.` (Authentik SSO) both **404** → no single sign-on,
and the GenUI agent couldn't reach `/v1/ai/*` or `/v1/mcp/*`. Root causes (from Traefik logs):

1. **`api.` 404** — orchestrator router referenced middleware **`authentik-auth@file`**, but the
   dynamic config defines **`authentik-forwardauth`** → router never loaded.
2. **`auth.` 404** — the Authentik container declared 2 routers + 2 services with no explicit
   `.service=`; Traefik: *"Router authentik cannot be linked automatically with multiple Services."*

**Fix (in `docker-compose.extended.yml`, committed to git):**
```yaml
- "traefik.http.routers.orchestrator.middlewares=authentik-forwardauth@file"   # was authentik-auth@file
- "traefik.http.routers.authentik.service=authentik"
- "traefik.http.routers.authentik-outpost.service=authentik-outpost"
```
Recreated only `go-orchestrator` + `authentik-server` (working silos untouched).

**Result (verified):**
- `auth.34.14.132.165.nip.io` → **302 → Authentik login** (SSO backbone online). ✅
- Orchestrator router now loads with ForwardAuth attached. ✅
- `api.` → **404 by design** until the Authentik **outpost** exists: ForwardAuth calls
  `authentik-server:9000/outpost.goauthentik.io/auth/traefik`, which 404s on a fresh Authentik
  (confirmed). Resolving that is **U1** below.

## 5. Authentik admin access (recovery procedure)

No `AUTHENTIK_BOOTSTRAP_PASSWORD` was set, so the admin password is whatever was chosen in the
first-run wizard, or is (re)set via a **recovery link**. To (re)gain admin access as `akadmin`
without handling any password:
```bash
sudo docker exec muslimbot-authentik-server-1 ak create_recovery_key 1 akadmin
#  → prints /recovery/use-token/<token>/  — open https://auth.34.14.132.165.nip.io<that-path>
#  → logs in as akadmin and lets you SET a new password. One-time, 1-day, admin-level: keep it private.
```
For a permanent bootstrap on future deploys, set `AUTHENTIK_BOOTSTRAP_PASSWORD` +
`AUTHENTIK_BOOTSTRAP_EMAIL` before Authentik's first boot (fresh DB only).

## 6. Current state & next steps (unification)

Full plan: [`UNIFIED_EXPERIENCE_PLAN.md`](UNIFIED_EXPERIENCE_PLAN.md).

- ✅ **U0** — edge routers fixed; `auth.` online; orchestrator router loads.
- ⏭ **U1** — log into Authentik (recovery link) → create the **OIDC Provider + Application** and the
  **embedded ForwardAuth outpost**. This makes `api.` serve and turns on SSO everywhere.
- ⏭ **U2** — set `GEMINI_API_KEY` server-side; point GenUI chat at `/v1/ai/chat` so the agent uses
  the MCP host (currently GenUI calls Gemini directly and never `/v1/ai/chat` or `/v1/mcp/*`).
- ⏭ **U3/U4** — set `TRYPOST_API_TOKEN` + `CHATWOOT_API_TOKEN` → `/v1/mcp/servers` connected → agent
  automates TryPost scheduling and drives Chatwoot support (129 tools).
- ⏭ **U5/U6** — unified Command Center + events; multi-tenant + hardening + move off `nip.io`.

## 7. Live URLs

| System | URL | Notes |
|---|---|---|
| Generative UI | https://ui.34.14.132.165.nip.io | control plane (agent wiring = U2) |
| ERPNext | https://erp.34.14.132.165.nip.io | seeded; token-reachable |
| n8n | https://n8n.34.14.132.165.nip.io | workflows imported manually |
| Chatwoot | https://chatwoot.34.14.132.165.nip.io | support (agent MCP = U4) |
| TryPost | https://social.34.14.132.165.nip.io | scheduling (agent MCP = U3) |
| Authentik | https://auth.34.14.132.165.nip.io | ✅ online — configure outpost (U1) |
| Orchestrator API | https://api.34.14.132.165.nip.io | live after U1 (outpost) |
