# Antigravity Pharmacy — User Profiles & Role Matrix

To run a fully integrated pharmacy business using ERPNext, a clear division of labor is required across the inventory, retail sales (POS), accounting, and healthcare modules. 

This document defines the 7 realistic user profiles created in the Antigravity Pharmacy ERPNext system, mapping their responsibilities, system roles, and credentials.

---

## 1. Role Matrix Overview

| Name | Designation | Email | Key Responsibilities | Primary ERPNext Roles |
|---|---|---|---|---|
| **Mustafa Rahman** | Pharmacy Administrator | `mustafa@antigravity.com` | Overall IT operations, system settings, domain config, user access control. | System Manager, Administrator |
| **Dr. Nigar Sultana** | Chief Pharmacist / Manager | `nigar@antigravity.com` | Medicine catalog approval, batch control, audit approvals, expiry reviews. | Pharmacist, Stock Manager, Health Care Manager |
| **Tanvir Ahmed** | POS Cashier | `tanvir@antigravity.com` | Over-the-counter (OTC) sales, processing prescription invoices, daily cash closing. | Sales User, POS Cashier |
| **Sultana Kamal** | Purchase Coordinator | `sultana@antigravity.com` | Reorder checking, raising RFQs, Purchase Orders (POs) to Beximco, Square, etc. | Purchase User, Purchase Manager |
| **Jasim Uddin** | Storekeeper / Cold Chain | `jasim@antigravity.com` | Receiving shipments, physical count verification, cold-chain temp logs, stock transfers. | Stock User, Stock Auditor |
| **Dr. Rezaul Karim** | Referring Physician (In-house) | `rezaul@antigravity.com` | Patient consultation, writing Patient Encounter documents and prescriptions. | Healthcare Practitioner, Physician |
| **Kamrul Hasan** | Senior Accountant | `kamrul@antigravity.com` | Supplier payment processing, bank reconciliations, P&L reporting, drug expiry write-offs. | Accounts User, Accounts Manager |

---

## 2. Detailed User Profiles

### 2.1 — Mustafa Rahman (Pharmacy Administrator)
* **Email:** `mustafa@antigravity.com`
* **Department:** IT Operations
* **Primary Roles in ERPNext:** `System Manager`, `Administrator`
* **Responsibilities:**
  - Configures global and system settings (BDT, Asia/Dhaka localization).
  - Manages active domains (Healthcare, Stock, Accounts).
  - Provisions users, assigns roles, and maintains security policies.
  - Backups and ERPNext/Docker maintenance.

### 2.2 — Dr. Nigar Sultana (Chief Pharmacist & Operations Manager)
* **Email:** `nigar@antigravity.com`
* **Department:** Pharmacy Operations
* **Primary Roles in ERPNext:** `Pharmacist`, `Stock Manager`, `Healthcare Manager`
* **Responsibilities:**
  - Manages the Item Master (verifying generic names, dosage forms, barcodes).
  - Approves batch creations, assigns shelf-life days, and oversees the FEFO policy.
  - Reviews and signs off on expired stock write-offs (Material Issues).
  - Evaluates clinical safety protocols in the Patient Encounter flow.

### 2.3 — Tanvir Ahmed (POS Cashier)
* **Email:** `tanvir@antigravity.com`
* **Department:** Sales & Billing
* **Primary Roles in ERPNext:** `Sales User`, `POS Cashier` (customized role profile)
* **Responsibilities:**
  - Handles the front retail counter daily.
  - Scans product barcodes, confirms batch selections, and receives BDT payments (Cash, BKash, Nagad).
  - Verifies walk-in patients or links counter sales to prescriptions.
  - Reconciles daily register sales at the end of the shift.

### 2.4 — Sultana Kamal (Procurement Officer)
* **Email:** `sultana@antigravity.com`
* **Department:** Purchase & Logistics
* **Primary Roles in ERPNext:** `Purchase User`, `Purchase Manager`
* **Responsibilities:**
  - Evaluates system-generated `Material Requests` from automated reorder thresholds.
  - Manages relationships with local pharmaceutical distributors (Square, Beximco, ACI, etc.).
  - Raises Purchase Orders (POs) and negotiates bulk pricing/discounts.

### 2.5 — Jasim Uddin (Storekeeper & Cold Chain Logistics)
* **Email:** `jasim@antigravity.com`
* **Department:** Inventory Control
* **Primary Roles in ERPNext:** `Stock User`, `Stock Auditor`
* **Responsibilities:**
  - Inspects incoming deliveries and submits `Purchase Receipts` in Main Distribution Store.
  - Performs physical counts and runs monthly `Stock Reconciliations`.
  - Ensures insulin and vaccines are immediately moved to the `Cold Storage` warehouse.
  - Transfers items from Bulk Main Store to the Retail POS Front shelves.

### 2.6 — Dr. Rezaul Karim (In-house Physician)
* **Email:** `rezaul@antigravity.com`
* **Department:** Outpatient Department (OPD)
* **Primary Roles in ERPNext:** `Healthcare Practitioner`, `Physician`
* **Responsibilities:**
  - Reviews patient vitals, medical history, and records consultation logs.
  - Logs `Patient Encounter` sessions and inputs drug prescriptions (linked to the Item master).
  - Triggers the prescription invoice directly to the POS billing counter.

### 2.7 — Kamrul Hasan (Senior Accountant)
* **Email:** `kamrul@antigravity.com`
* **Department:** Finance & Accounts
* **Primary Roles in ERPNext:** `Accounts User`, `Accounts Manager`
* **Responsibilities:**
  - Books `Purchase Invoices` against completed Purchase Receipts.
  - Processes supplier payments (Payment Entries) via bank accounts.
  - Posts journal entries for pharmacy expenses, payroll, and stock write-offs.
  - Prepares financial statements (Profit and Loss, Balance Sheet) in BDT.

---

## 3. Seed Security & Credentials Policy
For local development and testing, all seeded accounts are provisioned with the default password: **`Antigravity123!`**.
These accounts are marked as active and can be used to simulate realistic concurrent multi-user workflows.
