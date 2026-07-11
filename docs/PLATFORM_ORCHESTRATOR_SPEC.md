# liteERP Unified Backend Orchestrator — System Specifications

This document defines the unified backend orchestration layer (`go-orchestrator`).

## 1. Executive Summary
The Unified Backend Orchestrator sits behind **Traefik** (edge proxy) and **Authentik** (IdP) to provide:
- **One tenant-aware API** for all clients (`/v1/*`)
- **Authentik-based identity** — no custom JWT or password handling
- **Service registry & proxy** routing to Frappe, n8n, KB BFF, Chatwoot, Postiz
- **Event facade** for cross-service events via the outbox pattern

## 2. Authentication Architecture

### Auth Flow
```
Browser → Traefik (:443) → ForwardAuth → Authentik validates .smb.localhost cookie
  → Traefik injects X-authentik-* headers → Go Orchestrator reads headers
```

### Identity Headers (set by Authentik → Traefik → Go)
| Header | Required | Description |
|--------|----------|-------------|
| `X-authentik-email` | ✅ | Verified user email |
| `X-authentik-username` | ○ | Display username |
| `X-authentik-groups` | ○ | Comma-separated group slugs |
| `X-authentik-name` | ○ | Full display name |

### What Was Removed
- ~~`POST /v1/auth/login`~~ — Authentik handles login
- ~~`POST /v1/auth/refresh`~~ — Authentik handles token refresh
- ~~`POST /v1/auth/logout`~~ — Authentik handles logout
- ~~`POST /v1/auth/exchange/frappe`~~ — Obsolete session exchange
- ~~JWT issuance / bcrypt password hashing~~ — Authentik owns credentials
- ~~`User` and `Session` GORM models~~ — Authentik owns user/session state

## 3. Architecture

```
go-orchestrator/
├── cmd/server/main.go       # Engine entrypoint
├── internal/
│   ├── auth/middleware.go   # Authentik ForwardAuth header middleware
│   ├── gateway/proxy.go     # Frappe and KB BFF proxy (token masking)
│   ├── ai/router.go         # Generative AI Chat handler (Gemini)
│   ├── portals/handler.go   # SSO Bridge for embedded iframes
│   ├── config/config.go     # Environment parsing
│   ├── events/handler.go    # Event outbox ingestion
│   ├── tenants/handler.go   # Tenant lifecycle APIs
│   └── store/db.go          # GORM models (TenantUserMapping, Tenant, EventOutbox)
├── go.mod
└── go.sum
```

## 4. Endpoints

### Public
* `GET /v1/sys/health` — Service health + connectivity diagnostics

### Protected (Authentik ForwardAuth required)
* `GET /v1/auth/me` — Returns authenticated user context from Authentik headers
* `ANY /v1/erp/*path` — Reverse proxies ERPNext, injects `X-Frappe-User` from Authentik identity
* `ANY /v1/kb/*path` — Proxies KB BFF with API key masking and tenant context
* `GET /v1/portals/:app/url` — Returns embed URLs with SSO handshake per app
* `POST /v1/ai/chat` — Generative AI responses via Gemini (server-side API key)
* `POST /v1/events/ingest` — Platform event ingestion into outbox
* `POST /v1/tenants` — Create tenant
* `GET /v1/tenants/:id/status` — Tenant status
* `POST /v1/tenants/:id/onboard` — Tenant onboarding
* `PATCH /v1/tenants/:id/features` — Feature flag updates
* `GET /v1/platform/services` — Service registry status

## 5. Integration Matrix

| System | Auth Mechanism | Handshake Flow |
|--------|---------------|----------------|
| **Go Orchestrator** | Forward Auth | Traefik → Authentik → Go reads `X-authentik-*` headers |
| **Nextcloud** | OIDC (Native) | Iframe loads → Nextcloud reads OIDC config → Authentik validates `.smb.localhost` cookie → User is in |
| **n8n** | Forward Auth | Iframe loads → Traefik intercepts → Authentik validates cookie → Traefik injects headers |
| **Chatwoot** | Magic Link API | React calls Go `/v1/portals/chatwoot/url` → Go requests Chatwoot API → Returns magic link URL |
| **Postiz** | OIDC (Native) | Same as Nextcloud — Authentik cookie handles SSO |
| **Frappe/ERPNext** | Token Proxy | Go injects master `Authorization: token` header + `X-Frappe-User` from Authentik identity |

## 6. Infrastructure (docker-compose.extended.yml)

| Service | Image | Purpose |
|---------|-------|---------|
| `platform-postgres` | `postgres:15-alpine` | Shared DB: Authentik config + orchestrator tenant data |
| `platform-redis` | `redis:7-alpine` | Authentik session cache + token validation |
| `authentik-server` | `ghcr.io/goauthentik/server` | Identity Provider — web UI, OIDC, ForwardAuth outpost |
| `authentik-worker` | `ghcr.io/goauthentik/server` | Background tasks (email, sync, cleanup) |
| `traefik` | `traefik:v3.1` | Edge proxy — TLS termination, ForwardAuth middleware |

## 7. Next Steps
1. Configure Authentik OIDC providers for Nextcloud, Postiz
2. Build async event dispatcher to route outbox events to n8n webhooks
3. Implement tenant provisioning workflow (Authentik group → Frappe site)
4. Add Chatwoot SSO token API integration with real credentials
