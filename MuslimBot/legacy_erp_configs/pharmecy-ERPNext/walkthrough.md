# Antigravity Pharmacy — Walkthrough

## What Was Done

Created a complete from-scratch ERPNext pharmacy setup with 24-month seed data for **Antigravity Pharmacy** (Narayanganj, Bangladesh), expanding it to include distinct system users across various roles, documented standard business workflows, and detailed user registry maps.

---

## Deliverables

### 1. Architectural & Configuration Guides

- [antigravity_pharmacy_guide.md](file:///Users/qmranik/.gemini/antigravity-ide/brain/68878410-a43f-474b-aeab-fa787cd4162a/antigravity_pharmacy_guide.md) — 3-Phase Reference Setup Guide
- [workflows.md](file:///Users/qmranik/development/DOS/liteERP/pharmecy-ERPNext/workflows.md) — Standard Pharmacy Workflows (P2P, O2C, Cold Chain, Expiry Scrap, OTC, Consultation)
- [user-storing.md](file:///Users/qmranik/development/DOS/liteERP/pharmecy-ERPNext/user-storing.md) — Registry of 7 realistic system users, their departments, roles, and responsibilities.

### 2. Environment Files

- [.env.example](file:///Users/qmranik/development/DOS/liteERP/pharmecy-ERPNext/.env.example) — Docker environment template
- [setup_site.sh](file:///Users/qmranik/development/DOS/liteERP/pharmecy-ERPNext/setup_site.sh) — Site provisioning script

### 3. Seeding & Verification Scripts

- [seed_pharmacy.py](file:///Users/qmranik/development/DOS/liteERP/pharmecy-ERPNext/seed_pharmacy.py) — Python script to generate all core, user, and transactional seed records (idempotent setup).
- [verify_seed.py](file:///Users/qmranik/development/DOS/liteERP/pharmecy-ERPNext/verify_seed.py) — Post-seed integrity validator check.

---

## Seeding Hierarchy Overview

```mermaid
graph TD
    A[seed_all] --> B[seed_core_setup]
    A --> C[seed_items_and_suppliers]
    A --> D[seed_pos_and_healthcare]
    A --> E[seed_users]
    A --> F[seed_transactions]
    
    E --> E1[mustafa@antigravity.com - IT Admin]
    E --> E2[nigar@antigravity.com - Chief Pharmacist]
    E --> E3[tanvir@antigravity.com - Cashier]
    E --> E4[sultana@antigravity.com - Purchase Officer]
    E --> E5[jasim@antigravity.com - Storekeeper]
    E --> E6[rezaul@antigravity.com - OPD Physician]
    E --> E7[kamrul@antigravity.com - Finance Account]
```

---

## Setup & Execution Guide

### Step 1: Initialize Docker Stack
```bash
cd /Users/qmranik/development/DOS/liteERP/pharmecy-ERPNext
git clone https://github.com/frappe/frappe_docker.git
cd frappe_docker
cp ../.env.example .env
docker compose -f compose.yaml \
  -f overrides/compose.mariadb.yaml \
  -f overrides/compose.redis.yaml \
  up -d
```

### Step 2: Provision & Localize Site
Copy `setup_site.sh` into the container and execute it to create `antigravity.localhost` with Bangladesh settings:
```bash
docker compose cp ../setup_site.sh backend:/home/frappe/frappe-bench/setup_site.sh
docker compose exec backend bash /home/frappe/frappe-bench/setup_site.sh
```

### Step 3: Run the Data & User Seeding Script
```bash
docker compose cp ../seed_pharmacy.py backend:/home/frappe/frappe-bench/seed_pharmacy.py
docker compose exec backend bench --site antigravity.localhost execute seed_pharmacy.seed_all
```

### Step 4: Verify Data & User Profiles
```bash
docker compose cp ../verify_seed.py backend:/home/frappe/frappe-bench/verify_seed.py
docker compose exec backend bench --site antigravity.localhost execute verify_seed.verify_all
```
This prints the status of all created documents and verifies that all 7 users exist with their designated roles.
