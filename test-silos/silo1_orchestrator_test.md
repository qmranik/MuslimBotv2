# Silo 1: Orchestrator & GenUI Test

This runbook covers **Phase 2 (Orchestrator API)** and **Phase 3 (Generative UI Command Center)** of the MVP QA Prompt. 

## Prerequisites
Ensure Silo 1 is running:
```bash
docker compose down
docker compose -f docker-compose.silo1.yml up -d
```
Also ensure you have started `generative-ui` and `go-orchestrator` natively, configured with the correct `.env` files (including the `GEMINI_API_KEY`).

## 1. Orchestrator API Health & Readiness (Phase 2)

Open a terminal and run the following curl commands to verify the gateway:

### 1.1 Authentication
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smb.localhost","password":"admin"}' | jq -r .token)
curl -s http://localhost:8080/v1/auth/me -H "Authorization: Bearer $TOKEN"
```
**Pass Criteria:** 200 OK, email returned, role claims present.

### 1.2 Server-side Gemini Chat
```bash
curl -s -X POST http://localhost:8080/v1/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Summarize what MuslimBot can do for a small pharmacy ERP owner in 3 bullet points."}'
```
**Pass Criteria:** 200 OK, non-empty response, no 500 error.

### 1.3 Protected Route Rejection
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/v1/ai/chat \
  -H "Content-Type: application/json" -d '{"prompt":"test"}'
```
**Pass Criteria:** 401 Unauthorized.

## 2. Generative UI Flows (Phase 3)

Since we are testing in a silo without the full Frappe backend seeded, the mock router will automatically take over if the Frappe connection fails or if you clear the `VITE_GEMINI_API_KEY`. 

### Automated Audit Screenshots
Run the playwright script to execute the login and dashboard flows:
```bash
cd ../audit-screenshots
node 01-login-flow.js
node 02-genui-management.js
```
*Note: Verify that the screenshots are generated in the `audit-screenshots/output` directory.*

### Manual UI Sanity Check
1. Open `http://localhost:5173`
2. Test the mock fallback by asking: "Show overdue invoices".
3. **Pass Criteria:** A table renders with dummy/mock names.
