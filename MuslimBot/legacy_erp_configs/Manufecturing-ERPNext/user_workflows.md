# Antigravity Manufacturing: ERPNext User Workflows & Playbook

This playbook documents the realistic, domain-specific workflows used by the **Antigravity** team to manage our high-performance Magnetic Levitation (MagLev) stabilization ring (`SA-MAG-RING`) and high-speed drone propulsion motor (`FG-DRONE-M1`) manufacturing operations.

---

## 1. Organization Owner (Executive & Financial Controls)

**Primary Goals:** Monitor business health, review capacity margins, audit manufacturing costs, and analyze financial reports.

### Workflow 1.1: Multi-Level Production Costing Analysis
1. **Navigation:** Go to **Manufacturing > Reports > Bill of Materials Costing Report**.
2. **Action:** Select `BOM-FG-DRONE-M1-001` (BOM for High-Speed Drone Propulsion Motor).
3. **Inspection:**
   - Review **Raw Material Costs** (e.g., $10 for NeoDymium Magnet `RM-NEO-01` and $25 for Coil Winding Reel `RM-COIL-02`).
   - Review **Sub-Assembly Costs** ($50 valuation for MagLev Ring `SA-MAG-RING`).
   - Audit **Operating Costs** (e.g., Coil Winding, Core Alignment, Motor Shell Assembly, Final Calibrations) mapped directly from workstation hourly rates.
   - Analyze target margins against standard selling rate ($350/unit) to ensure profitability.

### Workflow 1.2: General Ledger & Stock Valuation Auditing
1. **Navigation:** Go to **Accounts > Reports > General Ledger** or **Stock > Reports > Stock Balance**.
2. **Action:** Set filter for Company to **Antigravity**.
3. **Execution:**
   - Audit the **Stock In Hand - A** asset account to check raw materials inventory value.
   - Review **GL Entries** generated during manufacturing completions (`Manufacture` stock entries). Verify operating costs are credited to the **Stock Adjustment - A** clearing account and capitalized into finished goods valuation.
   - Audit the **Profit and Loss Statement** to check Sales Income vs. Cost of Goods Sold (COGS).

---

## 2. Production Manager (Capacity Planning & Shop-Floor Execution)

**Primary Goals:** Formulate production plans, schedule work orders, coordinate shop floor routing, and track operation completions.

### Workflow 2.1: Material Requirements & Production Planning
1. **Navigation:** Go to **Manufacturing > Production Plan**.
2. **Action:** Create a new Production Plan.
   - Select **Get Items From > Sales Order**.
   - Pull in `SAL-ORD-2026-00001` (Sales Order for AeroDyne Defense Corp for 20 units of `FG-DRONE-M1`).
3. **Material Planning:**
   - Click **Get Raw Materials for Production** to run the MRP engine.
   - The system checks stock across `Raw Materials - AG - A` and generates **Material Requests** for shortages.
4. **Execution:** Click **Make Work Order** to spin off downstream shop-floor instructions.

### Workflow 2.2: Work Order Routing & Job Cards
1. **Navigation:** Go to **Manufacturing > Work Order**.
2. **Action:** Open `MFG-WO-2026-00001`.
3. **Operation Tracking:**
   - Review operations table (Coil Winding, Magnetic Core Alignment, Motor Shell Assembly, Final Calibrations).
   - Click **Start** to instantiate **Job Cards** for each workstation.
   - Shop-floor operators log their timesheets against the Job Cards, which automatically calculates and rolls up **Actual Operating Costs**.

---

## 3. Store Keeper (Inventory, Stock Movements & Shipments)

**Primary Goals:** Maintain stock accuracy, issue raw materials, transfer sub-assemblies to WIP, receive finished goods, and execute client dispatches.

### Workflow 3.1: Material Transfer to WIP
1. **Navigation:** Go to **Stock > Stock Entry** (or trigger directly from the Work Order).
2. **Action:** Create a Stock Entry of type **Material Transfer for Manufacture** for Work Order `MFG-WO-2026-00001`.
3. **Execution:**
   - Verify materials are pulled from `Raw Materials - AG - A` (Source Warehouse).
   - Transfer materials to `WIP - AG - A` (Target Warehouse).
   - Save and Submit.

### Workflow 3.2: Manufacturing Stock Receipt
1. **Navigation:** Go to **Stock > Stock Entry**.
2. **Action:** Create a Stock Entry of type **Manufacture** against the Work Order.
3. **Execution:**
   - Consume materials from `WIP - AG - A` (Source Warehouse).
   - Receipt finished items (`FG-DRONE-M1`) into `Finished Goods - AG - A` (Target Warehouse).
   - Verify the operating costs are appended. Save and Submit.

### Workflow 3.3: Customer Delivery Dispatch
1. **Navigation:** Go to **Stock > Delivery Note** (or trigger via **Create > Delivery** from Sales Order).
2. **Action:** Create Delivery Note `MAT-DN-2026-00001` mapping to `SAL-ORD-2026-00001`.
3. **Execution:**
   - Verify dispatch of 20 units of `FG-DRONE-M1` from `Finished Goods - AG - A`.
   - Submit Delivery Note to trigger stock depletion and create general ledger entries.

---

## 4. Quality Inspector (Inspections & Calibrations)

**Primary Goals:** Inspect raw materials upon receipt, perform in-process checks, audit final calibrations, and manage pass/fail flows.

### Workflow 4.1: Raw Material Quality Inspection (Inward)
1. **Navigation:** Go to **Stock > Quality Inspection**.
2. **Action:** Create a Quality Inspection for raw materials (e.g., `RM-NEO-01` Magnetics).
3. **Evaluation:**
   - Measure magnetic flux density (Target: > 1.2 Tesla).
   - Enter reading values. Set Status to **Accepted** or **Rejected**.
   - Link inspection to the corresponding **Purchase Receipt**.

### Workflow 4.2: Finished Good Calibration & Audits
1. **Navigation:** Go to **Stock > Quality Inspection**.
2. **Action:** Create an inspection for finished `FG-DRONE-M1` motors.
3. **Calibration Checks:**
   - Measure RPM performance (Target: 15,000 RPM @ 12V).
   - Enter the calibration logs.
   - Link the Quality Inspection to the **Manufacture Stock Entry** or **Delivery Note** to authorize customer delivery.
