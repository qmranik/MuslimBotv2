# Silo 6: Business Owner Day Integrated Test

This runbook covers the integrated daily workflow of a Business Owner, checking the dashboard, POS, knowledge base search, and gateway APIs.

## Prerequisites
Ensure Silo 6 (which uses the Silo 2 compose base, native Orchestrator, and native Generative UI) is primed:
```bash
docker compose down
docker compose -f docker-compose.silo2.yml up -d
```
Start native orchestrator and generative-ui services.

## Automated Verification
To execute the automated Owner Day flow:
```bash
export SCENARIO=all
export USE_GENUI_DASHBOARD=1
node qa_evidence/business-owner-ui-test.js
node qa_evidence/api-integration-test.js
```

## Pass Criteria
1. Revenue, Orders, and Pending KPI cards display correct live data.
2. POS checkout completes successfully for `ITM001` (Super Widget A).
3. The Knowledge Hub returns relevant answers from RAG.
