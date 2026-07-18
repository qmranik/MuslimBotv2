# liteERP Unified Backend Orchestrator — System Specifications

This document defines the unified backend orchestration layer (`go-orchestrator`).

## 1. Executive Summary

The Unified Backend Orchestrator sits behind **Traefik** (edge proxy) and **Authentik** (IdP) to provide:

- One tenant-aware API for all clients (`/v1/*`)
- Authentik-based identity (no custom JWT)
- ERP proxy, AI brain, portals SSO, webhook aggregation, event outbox
- **Vertex AI RAG Engine adapter** (ingest via GCS + `ImportRagFiles`, retrieve via `retrieveContexts`) — no custom vector store

## 2. Authentication

```
Browser → Traefik → ForwardAuth → Authentik
  → X-authentik-* headers → Go Orchestrator
```

| Header | Required | Description |
|--------|----------|-------------|
| `X-authentik-email` | yes | Verified user email |
| `X-authentik-username` | no | Display username |
| `X-authentik-groups` | no | Comma-separated groups |
| `X-authentik-name` | no | Full name |

Service agents may use `X-KB-API-Key` (+ optional `X-Tenant-Id`). Tenant resolution: Host subdomain (`PLATFORM_BASE_DOMAIN`) → `X-Tenant-Id` → email mapping → `default`.

### Local `ENV=local` auth bypass (MVT)

When `ENV=local`, the orchestrator skips Authentik/Traefik for browser and curl testing:

- If `X-authentik-email` or a valid `X-KB-API-Key` is present, those paths win unchanged.
- Otherwise identity is injected as `Administrator@small.localhost` / groups `admins` / tenant from Host or `X-Tenant-Id` or `default`.
- `GET /v1/auth/me` reports `"auth": "local-bypass"` when the mock was used.

Do not set `ENV=local` in production or staging behind Traefik.

## 3. Architecture

```
go-orchestrator/
├── cmd/server/main.go
└── internal/
    ├── auth/           # Authentik middleware + TenantFromHost
    ├── ai/             # generate-ui, tool executor, Vertex KB handlers
    ├── knowledge/      # org KB metadata + public/private visibility
    ├── gateway/        # Frappe token-masked proxy
    ├── portals/        # iframe SSO URLs
    ├── webhooks/       # public ingress → n8n
    ├── events/         # outbox ingest + dispatcher
    ├── workflows/      # POST /workflows/trigger → outbox
    ├── tenants/        # create / onboard / features / status
    ├── config/
    └── store/          # Tenant, TenantUserMapping, EventOutbox, KBSource
```

## 4. Endpoints

### Public

| Method | Path | Notes |
|--------|------|-------|
| GET | `/v1/sys/health` | Dependency probes + `vertex_rag` configured/unconfigured |
| POST | `/v1/webhooks/:source` | Secret-gated; outbox + async n8n |

### Protected (Authentik or service key)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/v1/auth/me` | Identity + tenant |
| ANY | `/v1/erp/*path` | Frappe proxy with masked token |
| GET/POST/DELETE | `/v1/kb/sources*` | Source CRUD + upload/URL → GCS → Vertex |
| POST | `/v1/kb/retrieve` | Vertex `retrieveContexts` |
| POST | `/v1/kb/chat` | Vertex retrieve + Gemini |
| POST/GET/DELETE | `/v1/kb/org*` | Org metadata + visibility governance |
| GET | `/v1/portals/:app/url` | erp-ops, n8n, chatwoot, postiz, nextcloud |
| POST | `/v1/ai/chat` | Legacy plain chat |
| POST | `/v1/ai/generate-ui` | UiDescriptor brain |
| POST | `/v1/ai/tool/execute` | 21-tool catalog (KB tool = Vertex) |
| POST | `/v1/workflows/trigger` | Enqueue → outbox dispatcher → n8n |
| POST | `/v1/events/ingest` | Outbox pending |
| POST | `/v1/tenants` | Create |
| POST | `/v1/tenants/:id/onboard` | Shared-schema v1 activate |
| GET | `/v1/tenants/:id/status` | Status |
| PATCH | `/v1/tenants/:id/features` | Feature flags JSON |
| GET | `/v1/platform/services` | Same as health |

## 5. Knowledge = Vertex AI RAG Engine (shared corpus + metadata filters)

See [ADR-0002-SHARED_VERTEX_RAG_TENANCY.md](./ADR-0002-SHARED_VERTEX_RAG_TENANCY.md).

| Step | Owner |
|------|--------|
| Upload / URL scrape | Orchestrator → GCS (`rag-imports/<tenant>/<source_id>/<revision>/…`) |
| Chunk / embed / index | **Vertex RagCorpus** (`GCP_RAG_CORPUS_ID_V2`, fallback `GCP_RAG_CORPUS_ID`) |
| File metadata | `tenant_id`, `visibility`, `source_id`, `source_revision`, `schema_version` |
| Retrieve | `retrieveContexts` with **mandatory CEL metadata_filter** (fail closed) |
| ACL metadata | Postgres `KBSource` + `TenantKBState.generation` |
| Cache | Generation-versioned Redis brief/retrieve keys |
| Active voice refresh | Outbox → Redis Stream `kb:events:<tenant>` → worker `update_instructions` |

Required env: `GCP_PROJECT_ID`, `GCP_LOCATION`, `GCS_BUCKET_NAME`, active corpus ID,
`RAG_ALLOW_UNFILTERED=false`. Without them, KB retrieve/chat/upload return **503**
(fail closed — no SQLite RAG fallback, no unfiltered production path).

Workload agent surface:

| Method | Path | Notes |
|--------|------|--------|
| POST | `/v1/agent/kb/retrieve` | Filtered retrieve + `kb_generation` |
| GET | `/v1/agent/kb/voice-brief` | Versioned brief; supports `If-None-Match` |
| GET | `/v1/agent/kb/context` | Compact revision/digest/context for watchers |
| POST | `/v1/agent/sessions/heartbeat` | Session liveness + generation reconcile |
| POST | `/v1/agent/sessions/end` | Close `VoiceSession` |

## 6. Integration Matrix

| System | Auth | Notes |
|--------|------|-------|
| Go Orchestrator | Forward Auth | `X-authentik-*` |
| Nextcloud | OIDC | Portal URL + files workspace |
| n8n | Forward Auth | `N8N_PUBLIC_URL` |
| Chatwoot | Platform API SSO | `CHATWOOT_PLATFORM_TOKEN` → `/platform/api/v1/users/{id}/login` |
| Postiz | OIDC | |
| Frappe | Token proxy | `Authorization: token` + `X-Frappe-User` + `X-Tenant-Id` |
| Vertex RAG | ADC / workload identity | Managed RAG only |

## 7. Infra

See `docker-compose.extended.yml`: platform-postgres/redis, Authentik, Traefik, go-orchestrator on `api.smb.localhost`.

## 8. Related

- Voice SIP: [VOICE_SIP_CHECKLIST.md](VOICE_SIP_CHECKLIST.md)
- n8n templates: `configs/n8n/workflow-chatwoot-support-vertex.json`, `configs/n8n/workflow-nextcloud-kb-ingest.json`
