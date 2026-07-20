# Test plan — Realtime KB tenant isolation (ADR-0002)

**Scope:** Shared Vertex corpus with mandatory metadata filters, generation cache,
Redis Stream mid-call refresh, GenUI rebuild-before-session.

## Unit (Go)

| Case | Location |
|------|----------|
| CEL filter builder staff/public/fail-closed | `internal/knowledge/vertex_metadata_test.go` |
| Access policy from caller / workload | `internal/knowledge/access_test.go` |
| GCS path + display name uniqueness | `internal/knowledge/ingestion_path_test.go` |
| Generation bump + outbox destination | `internal/knowledge/events_test.go` (DB optional) |

## Unit (Python)

| Case | Location |
|------|----------|
| Debounce / dedupe / hard vs soft change | `tests/test_kb_update_service.py` |
| Stream payload parse | same |

## Integration / E2E acceptance

1. Ingest uniquely marked docs for tenants A and B into one corpus (v2).
2. Browser chat for A never returns B content.
3. Public vs private visibility works for staff vs non-staff.
4. Start A voice call; ask same question; verify worker hits `/v1/agent/kb/retrieve`.
5. Upload/update A source mid-call; worker refreshes instructions; next answer uses new content.
6. Delete/make private a source mid-call; answer stops using it.
7. Concurrent A/B sessions show no cache/session bleed.
8. Tampered tenant headers/workload JWT fail 401/403.
9. Missing metadata/tenant fails closed (`RAG_ALLOW_UNFILTERED=false`).

## Cutover checklist

1. Provision v2 corpus + RagDataSchema fields.
2. Apply `migrations/20260718_kb_tenancy_v2.sql`.
3. Re-import all `KBSource` rows with metadata.
4. Shadow-query v2; pass adversarial suite.
5. Cut over retrieve/chat/voice-brief/agent retrieve together.
6. Keep legacy corpus read-only for rollback.
7. Remove `KBBFF_*` aliases after one release window.
