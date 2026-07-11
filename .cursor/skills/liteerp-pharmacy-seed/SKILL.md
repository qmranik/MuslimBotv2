---
name: liteerp-pharmacy-seed
description: Seed and test the liteERP Agent pharmacy inventory — national daily-use medicines, antihistamines, herbal cough syrups, and immunity boosters — in the ERPNext database and the BFF fallback. Use when the user wants to add pharmacy items, refresh operator command suggestions, or try the gated Human-In-The-Loop action prompts for stock checks, stock-in, and KPI/low-stock views.
disable-model-invocation: true
---

# liteERP Pharmacy Seed & Test

Seeds daily-use medicines, antihistamines, herbal cough syrups, and immunity boosters into the ERPNext database (and the BFF sandbox fallback), and exercises the gated Action security flow.

## What is seeded

Added to the ERPNext database fallback:
- **Napa Extra** (Paracetamol + Caffeine)
- **Tofen 1mg** (Ketotifen) — antihistamine
- **Adovas Herbal Syrup** — herbal cough syrup
- **Ceevit Vitamin C** — immunity booster
- **Provit Daily Multivitamin** — immunity booster

The frontend operator command suggestions are updated to immediately support testing these medicines.

## Rigid Gated Action Security

All write mutations route through the "Human-In-The-Loop" confirmation cards — write actions are never executed without structural pharmacy approval. After the operator taps **Confirm & Submit**, the BFF calls the real ERPNext write endpoint.

## Seed into the live ERPNext stack

```bash
docker compose exec frappe-web bench --site small.localhost execute small_erp.seed_pharma.seed_pharma_data
```

Verify:

```bash
docker compose exec frappe-web bench --site small.localhost console <<< "import frappe; print(frappe.db.count('Item'))"
```

## Seed prompts to try

Ask the agent:

- `"Check active inventory stock for Napa Extra, Tofen, and Adovas"` — renders a dynamic searchable table.
- `"Add 50 boxes of Napa Extra to main stock"` — gathers parameters and prompts for gated Action validation.
- `"Show our seasonal supplements and low stock alerts"` — generates immediate health KPIs with up/down metric trends.
