# Silo 4: Automation Test

This runbook focuses on the embedded automation workflows in n8n from Phase 5 of the MVP QA Prompt.

## Prerequisites
Ensure Silo 4 is running (n8n container):
```bash
docker compose down
docker compose -f docker-compose.silo4.yml up -d
```

## 1. Pre-flight Health Check
Run the following curl command to verify the n8n backend:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz
```
**Pass Criteria:** HTTP Status 200 OK.

## 2. Embedded Workspace Smoke Test
1. Start `generative-ui` natively.
2. Open `http://localhost:5173`.
3. Navigate to the **Automations** workspace (n8n).
4. **Pass Criteria:** The n8n UI loads correctly inside the iframe without connection refused errors.
