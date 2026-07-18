# ADR-0002 — Shared Vertex RAG corpus with mandatory tenant metadata filters

**Status:** Accepted (2026-07-18)  
**Scope:** Knowledge Base retrieval, ingestion, voice-brief cache, and mid-call context refresh  
**Related:** [PLATFORM_ORCHESTRATOR_SPEC.md](./PLATFORM_ORCHESTRATOR_SPEC.md), [VOICE_BFF_REMOVAL.md](./VOICE_BFF_REMOVAL.md)

---

## 1. Context

MuslimBot uses a single Vertex AI RagCorpus for all tenants. Postgres `KBSource` already
stores `tenant_id` and `visibility`, but `retrieveContexts` previously queried the shared
corpus with **no metadata filter**. That breaks tenant isolation for browser chat, agent
tools, and voice.

Voice sessions also load a Redis-cached brief once at join time with no invalidation and
no mid-call refresh when sources are indexed, deleted, or visibility-changed.

## 2. Decision

1. **Keep one shared Vertex corpus** (`GCP_RAG_CORPUS_ID_V2` after cutover).
2. **Require file-level metadata** on every imported RagFile:
   - `tenant_id` (string)
   - `source_id` (string)
   - `visibility` (`public` | `private`)
   - `schema_version` (int/string, current `2`)
   - `source_revision` (int)
   - optional `content_hash`, `ingest_id`
3. **Fail closed:** every retrieve path builds a CEL `metadata_filter` server-side from
   authenticated context. Never accept tenant/filter expressions from request JSON.
4. **Visibility policy:**
   - External / non-staff: `tenant_id == "<t>" && visibility == "public"`
   - Staff / workload voice with staff scopes:  
     `tenant_id == "<t>" && (visibility == "public" || visibility == "private")`
5. **Generation-versioned cache:** `TenantKBState.generation` increments on indexed /
   deleted / visibility-changed. Redis keys include generation; stale writers must not
   overwrite a newer generation.
6. **Realtime fan-out:** outbox publishes `kb.generation.changed` to Redis Stream
   `kb:events:<tenant>`. Voice workers `XREAD` per session, refetch brief/context, and
   call `agent.update_instructions`. Live per-question retrieve remains authoritative.
7. **No unfiltered production path:** `RAG_ALLOW_UNFILTERED` defaults false and is
   rejected in production validation.

## 3. Consequences

- Existing corpus files without metadata must be re-imported into the v2 corpus before
  cutover; unfiltered fallback is not used.
- Ingestion must attach metadata **before** marking a source `indexed`.
- GCS objects are namespaced: `rag-imports/<tenant>/<source_id>/<revision>/<safe-name>`.
- Outbox gains retry/lease fields; KB events go to Redis Streams (n8n remains for other
  event types).
- GenUI and voice docs must describe rebuild-before-session and mid-call refresh.

## 4. Env contract

| Variable | Purpose |
|---|---|
| `RAG_TENANCY_MODE` | `shared_metadata` (default) |
| `RAG_METADATA_SCHEMA_VERSION` | `2` |
| `GCP_RAG_CORPUS_ID` | Legacy corpus (read-only during rollback) |
| `GCP_RAG_CORPUS_ID_V2` | Active metadata-tagged corpus |
| `RAG_ALLOW_UNFILTERED` | Must be `false` in production |
| `KB_EVENT_STREAM_PREFIX` | Default `kb:events:` |
| `KB_BRIEF_TTL_SEC` | Soft TTL on versioned brief keys |
| `KB_RETRIEVE_CACHE_TTL_SEC` | Optional short retrieve cache TTL |
| `KB_EVENT_STREAM_MAXLEN` | Approximate stream cap |

## 5. Migration outline

1. Provision v2 corpus + RagDataSchema fields.
2. Re-import all `KBSource` rows with metadata.
3. Shadow-query v2; run adversarial isolation tests.
4. Cut over retrieve/chat/voice-brief/agent retrieve together.
5. Keep legacy corpus read-only; disable unfiltered permanently.
