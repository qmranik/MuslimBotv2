# Silo 1: Orchestrator & GenUI Test

Covers orchestrator API + Generative UI Command Center against **Authentik ForwardAuth** (not JWT login).

## Prerequisites

```bash
docker compose -f docker-compose.extended.yml up -d
# generative-ui + go-orchestrator reachable; GEMINI_API_KEY set on orchestrator
```

For Vertex smoke (optional): set `GCP_PROJECT_ID`, `GCP_LOCATION`, `GCP_RAG_CORPUS_ID`, `GCS_BUCKET_NAME` on the orchestrator.

## 1. Health

```bash
curl -s http://localhost:8080/v1/sys/health | jq .
```

**Pass:** `status` healthy/degraded; `services.vertex_rag` is `configured` or `unconfigured`.

## 2. Auth (Authentik headers)

```bash
curl -s http://localhost:8080/v1/auth/me \
  -H "X-authentik-email: admin@smb.localhost" \
  -H "X-authentik-groups: admins" | jq .
```

**Pass:** 200, `email`, `tenant_id`, `auth: authentik`.

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/v1/auth/me
```

**Pass:** `401`.

## 3. Generate-UI brain

```bash
curl -s -X POST http://localhost:8080/v1/ai/generate-ui \
  -H "Content-Type: application/json" \
  -H "X-authentik-email: admin@smb.localhost" \
  -d '{"prompt":"Show low stock items","history":[],"surface":"web"}' | jq .
```

**Pass:** JSON with `component` (table/metrics/text/…).

## 4. Workflows trigger + tenant onboard

```bash
curl -s -X POST http://localhost:8080/v1/workflows/trigger \
  -H "Content-Type: application/json" \
  -H "X-authentik-email: admin@smb.localhost" \
  -d '{"workflow":"chatwoot","payload":{"ping":true}}' | jq .

curl -s -X POST http://localhost:8080/v1/tenants/acme/onboard \
  -H "Content-Type: application/json" \
  -H "X-authentik-email: admin@smb.localhost" \
  -d '{"frappe_site":"acme.localhost"}' | jq .
```

**Pass:** workflow `accepted` with `event_id`; onboard `status: active`, `mode: shared_schema_v1`.

## 5. Vertex retrieve smoke (when GCP configured)

```bash
# after uploading a source via GenUI Knowledge Hub or:
curl -s -X POST http://localhost:8080/v1/kb/retrieve \
  -H "Content-Type: application/json" \
  -H "X-authentik-email: admin@smb.localhost" \
  -H "X-authentik-groups: admins" \
  -d '{"query":"return policy","top_k":3}' | jq .
```

**Pass with GCP:** 200 + `chunks` array. **Pass without GCP:** 503 with config error (fail closed).

## 6. Generative UI

1. Open `http://localhost:5173/command-center` (or Traefik GenUI host).
2. Confirm live Command Center shell (not mock KPI placeholders alone).
3. Ask: "Show low stock items".
4. Open Connected Systems → Nextcloud Files / Chatwoot (portal URL fetch).

**Pass:** generative table/chart or server-brain text; portals resolve via `/v1/portals/:app/url`.
