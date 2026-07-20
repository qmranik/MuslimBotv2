-- Explicit SQL migration for ADR-0002 shared-corpus tenancy.
-- AutoMigrate covers additive columns; this script documents indexes/backfills
-- for production cutover. Run against the platform Postgres (authentik_db).

-- Tenant KB generation tracker
CREATE TABLE IF NOT EXISTS tenant_kb_states (
  tenant_id   TEXT PRIMARY KEY,
  generation  BIGINT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Durable ingestion jobs
CREATE TABLE IF NOT EXISTS kb_ingestion_jobs (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  source_id            TEXT NOT NULL,
  revision             BIGINT NOT NULL DEFAULT 1,
  status               TEXT NOT NULL DEFAULT 'pending',
  attempts             INT NOT NULL DEFAULT 0,
  max_attempts         INT NOT NULL DEFAULT 5,
  available_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at            TIMESTAMPTZ,
  locked_by            TEXT,
  vertex_operation_id  TEXT,
  result_sink          TEXT,
  last_error           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_ingestion_jobs_status ON kb_ingestion_jobs (status, available_at);

-- KBSource extensions (idempotent)
ALTER TABLE kb_sources ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE kb_sources ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE kb_sources ADD COLUMN IF NOT EXISTS metadata_status TEXT DEFAULT 'pending';
ALTER TABLE kb_sources ADD COLUMN IF NOT EXISTS vertex_operation_id TEXT;
ALTER TABLE kb_sources ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ;
ALTER TABLE kb_sources ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE kb_sources ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_kb_sources_deleted_at ON kb_sources (deleted_at);

-- VoiceSession extensions
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS allowed_visibilities_json TEXT;
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS kb_generation BIGINT DEFAULT 0;
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS last_kb_refresh_at TIMESTAMPTZ;
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS end_reason TEXT;

-- EventOutbox hardening
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS event_id TEXT;
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS aggregate_type TEXT;
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS aggregate_id TEXT;
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 8;
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ;
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE event_outboxes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Backfill blank idempotency keys so unique index does not collide
UPDATE event_outboxes
SET idempotency_key = 'legacy-' || id::text
WHERE idempotency_key IS NULL OR idempotency_key = '';

-- Seed generation rows for existing tenants with KB sources
INSERT INTO tenant_kb_states (tenant_id, generation, updated_at)
SELECT DISTINCT tenant_id, 1, NOW()
FROM kb_sources
WHERE tenant_id IS NOT NULL AND tenant_id <> ''
ON CONFLICT (tenant_id) DO NOTHING;
