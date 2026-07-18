# Backup & Restore — Disaster Recovery Runbook

**Closes readiness gap P1** (the DR half). Pairs `small_erp/scripts/backup.sh` (existing) with the new `small_erp/scripts/restore.sh`.

> A backup you have not restored is not a backup. This runbook exists to be **executed on a schedule**, not just read.

---

## 1. What is backed up

| Artifact | Produced by | Contents |
|---|---|---|
| `db_<TS>.sql.gz` | `mysqldump --single-transaction` | MariaDB — the ERP **system of record** |
| `files_<TS>.tar.gz` | `tar` of the site | Frappe `public/files`, `private/files`, `site_config.json` |
| `n8n_<TS>.tar.gz` | `tar` of `/home/node/.n8n` | n8n workflows, credentials, execution DB |

`<TS>` = `YYYYMMDD_HHMMSS`. All three share one timestamp per run and form one **backup set**.

> **Scope note (still open):** this set covers the demo/single-host compose. The platform Postgres (Authentik identity) and Chatwoot Postgres are **not yet** in `backup.sh` — tracked as P1-remainder; add `pg_dump` targets when the edge tier is promoted to production (Phase C).

## 2. Schedule & retention

- **Cadence:** nightly via cron (`0 2 * * *`) calling `backup.sh`.
- **Retention:** 14 days local (`RETENTION_DAYS` in `backup.sh`); off-site to S3/GCS when `S3_BUCKET`/`S3_ENDPOINT` are set.
- **Pre-deploy:** the deploy pipeline (Phase H, `deploy.yml`) runs `backup.sh` and **aborts the deploy if it fails**.

Example crontab:
```cron
0 2 * * * cd /opt/muslimbot-os/MuslimBot && bash small_erp/scripts/backup.sh >> /var/log/smb-backup.log 2>&1
```

## 3. Restore

```bash
# List available sets
ls small_erp/backups/db_*.sql.gz

# Dry run first — prints every action, changes nothing
bash small_erp/scripts/restore.sh 20260718_020000 --dry-run

# Real restore (interactive confirmation: type RESTORE)
bash small_erp/scripts/restore.sh 20260718_020000

# Newest set, pulling from S3 if not present locally
bash small_erp/scripts/restore.sh latest --from-s3
```

`restore.sh` is **destructive**: it drops+recreates `DB_NAME`, overwrites site files, restores n8n, then runs `bench migrate` + `clear-cache` and restarts the services. It refuses to run without typing `RESTORE` unless `RESTORE_ASSUME_YES=1` (the drill sets this).

## 4. The restore drill (run monthly + before any risky migration)

Restore into a **scratch stack**, never production. Steps:

1. **Provision a scratch stack** on a throwaway host/VM or a separate compose project name:
   ```bash
   COMPOSE_PROJECT_NAME=smb_drill docker compose -f docker-compose.yml up -d mariadb frappe-web n8n
   ```
2. **Restore the latest set** non-interactively:
   ```bash
   RESTORE_ASSUME_YES=1 COMPOSE_FILE=docker-compose.yml \
     bash small_erp/scripts/restore.sh latest --from-s3
   ```
3. **Verify** (all must pass — this is the DoD):
   - [ ] `/ops` loads and login succeeds.
   - [ ] Seeded demo company, items, and at least one Sales Invoice are present:
         `bench --site "$FRAPPE_SITE_NAME" execute "frappe.db.count" --args "['Sales Invoice']"` → > 0.
   - [ ] n8n workflows list is non-empty and credentials decrypt (open one workflow).
   - [ ] Uploaded KB files are readable from `private/files`.
4. **Record the result** in the drill log table below (date, set restored, RTO observed, pass/fail, notes).
5. **Tear down** the scratch stack: `COMPOSE_PROJECT_NAME=smb_drill docker compose down -v`.

## 5. Targets (owner to confirm — readiness §7)

| Metric | Target | Notes |
|---|---|---|
| RPO (max data loss) | ≤ 24 h | nightly cadence; tighten with more frequent DB dumps if needed |
| RTO (max downtime) | ≤ 1 h | single-host restore; measured during the drill |
| Encryption at rest | required | dumps encrypted before off-site; never written into the repo tree |

## 6. Drill log

| Date | Set restored | RTO observed | Result | Notes |
|---|---|---|---|---|
| _pending first execution_ | | | | run `restore.sh latest` into a scratch stack |

---

*Scripts: [`../../small_erp/scripts/backup.sh`](../../small_erp/scripts/backup.sh) · [`../../small_erp/scripts/restore.sh`](../../small_erp/scripts/restore.sh)*
