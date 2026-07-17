# MuslimBot — Production Runbook (W6/W7)

Companion to [MUSLIMBOT_PRODUCTION_PLAN.md](MUSLIMBOT_PRODUCTION_PLAN.md). Tracks
what has been **implemented in-repo** vs. what needs an **operator action** on
your infrastructure (remote, VM, real secrets, app stores) that cannot be done
from a code checkout.

## Security checklist (W7)

| Item | Status | Where |
|---|---|---|
| Repo under version control | ✅ done | `git` initialized; 379 files, secrets excluded |
| Comprehensive `.gitignore` (no secrets/heavy dirs) | ✅ done | `.gitignore` |
| `cookie.txt` session artifact removed | ✅ done | deleted |
| gitleaks secret scanning in CI | ✅ done | `.gitleaks.toml`, `.github/workflows/ci.yml` |
| `login_to_get_keys`: rate-limit + TLS guard + audit | ✅ done | `small_erp/.../api/auth.py` |
| Key revocation endpoint | ✅ done | `revoke_keys` in `api/auth.py` |
| Constant-time KB-BFF key compare | ✅ done | `go-orchestrator/internal/auth/middleware.go` |
| Gemini key server-side; surfaces call `/v1/ai/generate-ui` | ✅ done | orchestrator brain; genUI `serverBrain.js`; flutter `MuslimBotClient` |
| Config-driven pinned AI models | ✅ done | `config.go` (`GEMINI_ROUTER_MODEL`), `services/config.py` (`GEMINI_VOICE_MODEL`) |
| Request logging / trace ids | ✅ done | `internal/observability/middleware.go` |
| **Rotate `FRAPPE_API_SECRET` that was in `.env.mvp`** | ⚠️ operator | `bench ... execute frappe.client.generate_keys`; then `revoke_keys` old |
| **Rotate all `.env` secrets ever on disk** | ⚠️ operator | Chatwoot/Postiz/JWT/Gemini keys |
| **TLS everywhere (Traefik certresolver + HSTS)** | ⚠️ operator | see Staging below |
| **Enable `enforce_tls_login` in prod site_config** | ⚠️ operator | `bench set-config enforce_tls_login 1` |
| **Push repo to a private remote + branch protection** | ⚠️ operator | `git remote add origin … && git push -u origin main` |
| **Pin base image digests** | ⚠️ operator | `frappe/erpnext:v15` → exact `v15.x.y`/digest in Dockerfile + compose |
| Run `/security-review` on api/handlers before GA | ⬜ pending | small_erp api, orchestrator, KB BFF |

## Staging & TLS (W6)

Staging = the `extended` topology (Authentik + Traefik + orchestrator + platform
Postgres/Redis) with TLS and observability, on a VM.

```bash
# On the staging VM
cp .env.template .env      # fill real values (never commit)
docker compose -f docker-compose.extended.yml up -d
bash small_erp/scripts/install-demo.sh
docker compose -f docker-compose.extended.yml exec frappe-web \
  bench --site $FRAPPE_SITE_NAME execute small_erp.setup_permissions.run
```

**Traefik TLS** — add a certresolver (Let's Encrypt) to the Traefik static
config and require HTTPS routers:
```yaml
# traefik static config
certificatesResolvers:
  le:
    acme:
      email: ops@yourdomain
      storage: /letsencrypt/acme.json
      httpChallenge: { entryPoint: web }
entryPoints:
  web:   { address: ":80", http: { redirections: { entryPoint: { to: websecure, scheme: https } } } }
  websecure: { address: ":443" }
```
Routers use `tls.certresolver: le` and the `authentik-forwardauth` middleware
(already defined in `traefik/dynamic/authentik.yml`). Add HSTS via a headers
middleware. Set `enforce_tls_login=1` on the Frappe site once HTTPS is live.

**Health/alerting**: `/v1/sys/health` now returns per-dependency status
(`frappe`, `kb_bff`, `platform_db`) + active model ids. Point an uptime probe at
it; alert when `status != healthy`. Layer Prometheus/Grafana/Loki as a compose
`observability` profile and Sentry DSNs per surface (W5.2) when ready.

## Backup & restore drill (W4.3 — do this before GA)

`small_erp/scripts/backup.sh` covers MariaDB + Frappe files + n8n. Extend to
platform Postgres, KB SQLite/GCS, and Authentik, then **prove a restore**:

```bash
# 1. Take a backup
bash small_erp/scripts/backup.sh
# 2. Restore into an isolated silo (never prod)
docker compose -f test-silos/docker-compose.silo2.yml up -d
gunzip < backups/db_<ts>.sql.gz | docker compose -f test-silos/docker-compose.silo2.yml exec -T mariadb mysql -uroot -p"$DB_ROOT_PASSWORD" "$DB_NAME"
# 3. Verify: log in, open /ops, run a report; record pass/fail + timing.
```
Target **RPO ≤ 24h, RTO ≤ 4h**. Write the runbook from whatever breaks the first
time; schedule the drill (cron / routine) monthly.

## Release train (W6)
CI green → build & push versioned images → deploy staging (auto) → run
`test-silos` smoke suite → manual promote to prod (git tag) → mobile tracks
(internal → beta → prod). Rollback = previous image tag + latest restore point.
