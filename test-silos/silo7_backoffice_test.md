# Silo 7: Backoffice Loop Test

This runbook covers the extended backoffice/accounting loop including inventory low-stock alerts, invoicing, payments, and P&L snapshots.

## Prerequisites
Ensure Silo 7 (using the Silo 2 compose base) is running:
```bash
docker compose down
docker compose -f docker-compose.silo2.yml up -d
```

## Automated Verification
To execute the backoffice scenario checks:
```bash
export SCENARIO=backoffice
node qa_evidence/business-owner-ui-test.js
```

## Pass Criteria
1. Low-stock indicators or items load properly in `/ops/inventory`.
2. Sales invoices can be loaded and partial payments recorded.
3. Accounting P&L snapshots display correct, live summaries.
