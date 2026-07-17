# Silo 2: Core ERP Test

This runbook covers the ERP layer testing (Frappe/ERPNext) from Phase 0 and Phase 1 of the MVP QA Prompt.

## Prerequisites
Ensure Silo 2 is running (Frappe stack with MariaDB and Redis):
```bash
docker compose down
docker compose -f docker-compose.silo2.yml up -d
```

## 1. Environment Bootstrap (Phase 0)

If the database is empty, seed the demo data:
```bash
docker compose -f docker-compose.silo2.yml exec frappe-web bench --site small.localhost execute small_erp.finish_setup.finish
docker compose -f docker-compose.silo2.yml exec frappe-web bench --site small.localhost execute small_erp.seed_demo.create_demo_data
```

Generate the API keys required for the Go Orchestrator and Generative UI:
```bash
docker compose -f docker-compose.silo2.yml exec frappe-web bench --site small.localhost execute frappe.client.generate_keys --args '["Administrator"]'
```
*Note: Copy these keys into your `.env` files.*

## 2. Pre-flight Health Check (Phase 1)
Run the following curl command to ensure the `/ops` route is active:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/login
```
**Pass Criteria:** HTTP Status 200 or 302.

## 3. Automated POS Checkout Test
We have a Playwright script configured to test the POS Checkout flow directly against the ERP.
```bash
cd ../audit-screenshots
node 03-pos-checkout.js
```
*Note: Verify that the screenshots of the invoice and checkout process are generated.*
