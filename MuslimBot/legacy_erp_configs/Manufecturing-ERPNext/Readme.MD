# Antigravity ERPNext Manufacturing Sandbox Setup

This plan outlines the steps to initialize the ERPNext sandbox for "Antigravity", answer the requested Master Prompt (Phase 1 and Phase 2), and execute the necessary scripts to seed the data into the local instance.

## User Review Required

> [!IMPORTANT]
> The initial docker compose command will download several images and initialize a local database, which will consume space and memory on your machine.
> The data seeding script will create numerous database entries to simulate 2 years of operational data, which could take a few minutes to complete.

## Proposed Changes

### Phase A: Environment Provisioning & App Installation

I will run the following operations in the `Manufecturing-ERPNext` directory:
1. Clone the official `frappe_docker` repository.
2. Initialize the `.env` file.
3. Start the containers using `docker compose up -d` with the development overrides.
4. Execute `bench new-site antigravity.localhost` with the requested credentials.
5. Install the `erpnext` application onto the new site.
6. Enable `developer_mode`.

### Phase B: Phase 1 & 2 Output Generation (Artifact)

I will generate a comprehensive artifact (`antigravity_erpnext_roadmap.md`) addressing your prompt for:
- **Phase 1**: The ERPNext Enterprise Manufacturing Roadmap (Accounts, Workstations, Items, BOMs, Logistics, etc.)
- **Phase 2**: The 2-Year "Lived-In" Operational Dataset (tables and transaction traces).

### Phase C: Programmatic Data Injection (Option B)

I will write a Python seeding script (`seed_antigravity.py`) using the Frappe API.
This script will be injected into the `backend` Docker container and executed to programmatically create:
- **Core structural records**: Item Groups, Items (Raw Materials, Sub-Assemblies, Finished Goods), Workstations, Operations, BOMs, Warehouses, Cost Centers, Customers, and Suppliers.
- **Transactional records**: A trace of a Sales Order -> Production Plan -> Work Order -> Stock Entries -> Purchase Order -> Quality Inspection -> Sales Invoice.

The script will use `frappe.get_doc(...).insert()` to ensure all Frappe-level validation and naming series are respected.

## Verification Plan

### Automated/Programmatic Verification
- Use `docker compose ps` to verify all containers are healthy.
- Connect to the `backend` container and run python queries to verify that the core structural records (e.g. `frappe.db.count("Workstation")`) have been created.

### Manual Verification
- Once the setup is complete, you can log into the local instance at `http://antigravity.localhost:8000` (or the appropriate exposed port) using `Administrator` / `admin` to verify the generated data on the frontend Desk.
