# Silo 8: Pharma Intelligence Test

This runbook covers the pharmacy business scenario featuring seeded Lazz Pharma items, n8n webhook automation, and KB upload.

## Prerequisites
Start the ERP and n8n stack (Silo 4 base) and seed the pharmacy demo data:
```bash
docker compose down
docker compose -f docker-compose.silo4.yml up -d
docker compose -f docker-compose.silo4.yml exec frappe-web bench --site small.localhost execute small_erp.seed_pharma.create_demo_data
```

## Automated Verification
To execute the pharmacy intelligence checks:
```bash
export SCENARIO=pharma
node qa_evidence/business-owner-ui-test.js
```

If memory constraints are tight, shut down Silo 4 and boot up Silo 3 (KB only) to verify RAG queries:
```bash
docker compose down
docker compose -f docker-compose.silo3.yml up -d --build
```
Verify the FAQ upload manually or via:
```bash
export SCENARIO=knowledge
node qa_evidence/business-owner-ui-test.js
```
