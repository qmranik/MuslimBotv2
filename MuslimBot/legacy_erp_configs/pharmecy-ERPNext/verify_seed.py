"""
Antigravity Pharmacy — Seed Data Verification Script
=====================================================
Run after seed_pharmacy.py to verify all data was created correctly.

Usage:
    bench --site antigravity.localhost execute verify_seed.verify_all
"""

import frappe


def verify_all() -> None:
    """Verify all seeded data exists and print a summary report."""
    print("\n")
    print("╔══════════════════════════════════════════════════════╗")
    print("║  Antigravity Pharmacy — Seed Verification Report    ║")
    print("╚══════════════════════════════════════════════════════╝")

    checks: list[tuple[str, bool]] = []

    # ── Company ──
    company_exists = bool(frappe.db.exists("Company", "Antigravity Pharmacy"))
    checks.append(("Company: Antigravity Pharmacy", company_exists))

    # ── Warehouses ──
    expected_warehouses = [
        "Main Distribution Store - AG",
        "Retail POS Front - AG",
        "Cold Storage - AG",
        "Quarantine / Expired - AG",
    ]
    for wh in expected_warehouses:
        checks.append((f"Warehouse: {wh}", bool(frappe.db.exists("Warehouse", wh))))

    # ── Cost Centers ──
    for cc in ["Retail Counter - AG", "Procurement - AG", "Cold Chain - AG"]:
        checks.append((f"Cost Center: {cc}", bool(frappe.db.exists("Cost Center", cc))))

    # ── Item Groups ──
    expected_groups = [
        "Medicines", "Antibiotics", "Analgesics & Antipyretics",
        "Gastro-Intestinal", "Anti-Diabetics", "OTC",
    ]
    for ig in expected_groups:
        checks.append((f"Item Group: {ig}", bool(frappe.db.exists("Item Group", ig))))

    # ── Suppliers ──
    supplier_count = frappe.db.count("Supplier", {"supplier_group": "Pharmaceutical"})
    checks.append((f"Suppliers (Pharmaceutical): {supplier_count}/7", supplier_count >= 7))

    # ── Items ──
    expected_items = ["NAPA-EXT-665", "SECLO-20", "AMOXICIL-500", "NOVORAPID-FP", "ACE-PLUS"]
    for item_code in expected_items:
        exists = bool(frappe.db.exists("Item", item_code))
        has_batch = bool(frappe.db.get_value("Item", item_code, "has_batch_no")) if exists else False
        has_expiry = bool(frappe.db.get_value("Item", item_code, "has_expiry_date")) if exists else False
        checks.append((f"Item: {item_code} (batch={has_batch}, expiry={has_expiry})", exists and has_batch and has_expiry))

    # ── Batches ──
    batch_count = frappe.db.count("Batch")
    checks.append((f"Batches created: {batch_count}/10", batch_count >= 10))

    # ── Expired batch check ──
    expired = frappe.db.get_value("Batch", "INC-AX-2409D", "expiry_date")
    checks.append((f"Expired batch INC-AX-2409D (exp: {expired})", expired is not None))

    # ── POS Profile ──
    pos_exists = bool(frappe.db.exists("POS Profile", "Antigravity Retail Counter"))
    checks.append(("POS Profile: Antigravity Retail Counter", pos_exists))

    # ── Healthcare ──
    practitioner_count = frappe.db.count("Healthcare Practitioner")
    checks.append((f"Healthcare Practitioners: {practitioner_count}/3", practitioner_count >= 3))

    patient_exists = bool(frappe.db.exists("Patient", {"patient_name": "Rahima Akter"}))
    checks.append(("Patient: Rahima Akter", patient_exists))

    # ── Users ──
    expected_users = [
        "mustafa@antigravity.com",
        "nigar@antigravity.com",
        "tanvir@antigravity.com",
        "sultana@antigravity.com",
        "jasim@antigravity.com",
        "rezaul@antigravity.com",
        "kamrul@antigravity.com"
    ]
    for email in expected_users:
        checks.append((f"User: {email}", bool(frappe.db.exists("User", email))))

    # ── Transactions ──
    pr_count = frappe.db.count("Purchase Receipt", {"docstatus": 1})
    checks.append((f"Purchase Receipts (submitted): {pr_count}", pr_count >= 1))

    sinv_count = frappe.db.count("Sales Invoice", {"docstatus": 1, "is_pos": 1})
    checks.append((f"POS Invoices (submitted): {sinv_count}", sinv_count >= 1))

    ste_count = frappe.db.count("Stock Entry", {"docstatus": 1, "stock_entry_type": "Material Issue"})
    checks.append((f"Stock Entries - Material Issue (submitted): {ste_count}", ste_count >= 1))

    # ── Stock Levels ──
    print("\n─── Current Stock Levels ───")
    stock_data = frappe.db.sql("""
        SELECT item_code, warehouse, batch_no, actual_qty
        FROM `tabStock Ledger Entry`
        WHERE is_cancelled = 0
        GROUP BY item_code, warehouse, batch_no
        HAVING SUM(actual_qty) > 0
        ORDER BY item_code, warehouse
    """, as_dict=True)
    for s in stock_data:
        print(f"  📦 {s['item_code']} | {s['warehouse']} | Batch: {s['batch_no']} | Qty: {s['actual_qty']}")

    # ── Print Results ──
    print("\n─── Verification Results ───")
    passed = 0
    failed = 0
    for label, ok in checks:
        icon = "✅" if ok else "❌"
        print(f"  {icon} {label}")
        if ok:
            passed += 1
        else:
            failed += 1

    print(f"\n  Total: {passed} passed, {failed} failed out of {len(checks)} checks")

    if failed == 0:
        print("\n  🎉 ALL VERIFICATIONS PASSED!")
    else:
        print(f"\n  ⚠ {failed} verification(s) failed — review above for details.")


if __name__ == "__main__":
    verify_all()
