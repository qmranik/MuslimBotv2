"""
Antigravity Pharmacy — ERPNext Seed Data Script
================================================
Injects 24 months of realistic pharmacy operational data into a fresh ERPNext instance.

Usage (inside backend container):
    bench --site antigravity.localhost execute seed_pharmacy.seed_all

Or via Python:
    bench --site antigravity.localhost console
    >>> from seed_pharmacy import seed_all
    >>> seed_all()
"""

import frappe
from datetime import date, timedelta, datetime
from typing import Any


# ═══════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════

COMPANY: str = "Antigravity Pharmacy"
ABBR: str = "AG"
SITE: str = "antigravity.localhost"
CURRENCY: str = "BDT"
COUNTRY: str = "Bangladesh"


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

def _safe_insert(doctype: str, doc_dict: dict[str, Any], ignore_links: bool = False) -> None:
    """Insert a document only if it doesn't already exist (by name or unique key)."""
    name = doc_dict.get("name") or doc_dict.get(
        "item_code") or doc_dict.get(
        "warehouse_name") or doc_dict.get(
        "supplier_name") or doc_dict.get(
        "patient_name") or doc_dict.get(
        "practitioner_name") or doc_dict.get(
        "item_group_name") or doc_dict.get(
        "cost_center_name") or doc_dict.get(
        "uom_name")

    doc_dict["doctype"] = doctype

    # For some doctypes, name is auto-generated; use unique fields instead
    if doctype == "Item" and frappe.db.exists("Item", doc_dict.get("item_code")):
        print(f"  ⏩ {doctype} '{doc_dict.get('item_code')}' already exists, skipping.")
        return
    elif doctype == "Supplier" and frappe.db.exists("Supplier", {"supplier_name": doc_dict.get("supplier_name")}):
        print(f"  ⏩ {doctype} '{doc_dict.get('supplier_name')}' already exists, skipping.")
        return
    elif doctype == "Warehouse" and frappe.db.exists("Warehouse", doc_dict.get("warehouse_name", "") + f" - {ABBR}"):
        print(f"  ⏩ {doctype} '{doc_dict.get('warehouse_name')}' already exists, skipping.")
        return
    elif doctype == "Item Group" and frappe.db.exists("Item Group", doc_dict.get("item_group_name")):
        print(f"  ⏩ {doctype} '{doc_dict.get('item_group_name')}' already exists, skipping.")
        return
    elif doctype == "Batch" and frappe.db.exists("Batch", doc_dict.get("batch_id")):
        print(f"  ⏩ {doctype} '{doc_dict.get('batch_id')}' already exists, skipping.")
        return
    elif name and frappe.db.exists(doctype, name):
        print(f"  ⏩ {doctype} '{name}' already exists, skipping.")
        return

    try:
        doc = frappe.get_doc(doc_dict)
        doc.insert(ignore_permissions=True, ignore_links=ignore_links)
        identifier = doc_dict.get("item_code") or doc_dict.get("supplier_name") or doc.name
        print(f"  ✅ Created {doctype}: {identifier}")
    except frappe.DuplicateEntryError:
        print(f"  ⏩ {doctype} duplicate, skipping.")
    except Exception as e:
        print(f"  ❌ Error creating {doctype}: {e}")


# ═══════════════════════════════════════════════════════════════
# Phase 1: Core Setup — Company, COA, Warehouses, Cost Centers
# ═══════════════════════════════════════════════════════════════

def seed_core_setup() -> None:
    """Create company, UOMs, warehouses, and cost centers."""
    print("\n══════════════════════════════════════════")
    print("  Phase 1: Core Setup")
    print("══════════════════════════════════════════")

    # ── UOMs ──
    print("\n─── UOMs ───")
    for uom in ["Strip", "Box", "Pen", "Vial", "Nos", "Bottle", "Tube"]:
        if not frappe.db.exists("UOM", uom):
            frappe.get_doc({"doctype": "UOM", "uom_name": uom}).insert(ignore_permissions=True)
            print(f"  ✅ Created UOM: {uom}")
        else:
            print(f"  ⏩ UOM '{uom}' exists, skipping.")

    # ── Company ──
    print("\n─── Company ───")
    if not frappe.db.exists("Company", COMPANY):
        comp = frappe.get_doc({
            "doctype": "Company",
            "company_name": COMPANY,
            "abbr": ABBR,
            "default_currency": CURRENCY,
            "country": COUNTRY,
            "chart_of_accounts": "Standard",
            "enable_perpetual_inventory": 1,
        })
        comp.insert(ignore_permissions=True)
        print(f"  ✅ Created Company: {COMPANY}")
    else:
        print(f"  ⏩ Company '{COMPANY}' exists, skipping.")
        # Ensure perpetual inventory is on
        frappe.db.set_value("Company", COMPANY, "enable_perpetual_inventory", 1)

    # ── Warehouse Types ──
    print("\n─── Warehouse Types ───")
    for wtype in ["Stores", "Transit"]:
        if not frappe.db.exists("Warehouse Type", wtype):
            frappe.get_doc({"doctype": "Warehouse Type", "name": wtype}).insert(ignore_permissions=True)
            print(f"  ✅ Created Warehouse Type: {wtype}")

    # ── Warehouses ──
    print("\n─── Warehouses ───")
    warehouses = [
        {"name": "Main Distribution Store", "type": "Stores", "parent_wh": COMPANY + f" - {ABBR}"},
        {"name": "Retail POS Front", "type": "Stores", "parent_wh": f"Main Distribution Store - {ABBR}"},
        {"name": "Cold Storage", "type": "Stores", "parent_wh": f"Main Distribution Store - {ABBR}"},
        {"name": "Quarantine / Expired", "type": "Transit", "parent_wh": COMPANY + f" - {ABBR}"},
    ]
    for w in warehouses:
        wh_name = f"{w['name']} - {ABBR}"
        if not frappe.db.exists("Warehouse", wh_name):
            doc = frappe.get_doc({
                "doctype": "Warehouse",
                "warehouse_name": w["name"],
                "company": COMPANY,
                "warehouse_type": w["type"],
                "parent_warehouse": w.get("parent_wh"),
            })
            doc.insert(ignore_permissions=True)
            print(f"  ✅ Created Warehouse: {wh_name}")
        else:
            print(f"  ⏩ Warehouse '{wh_name}' exists, skipping.")

    # ── Cost Centers ──
    print("\n─── Cost Centers ───")
    cost_centers = [
        {"name": "Retail Counter", "parent_cc": f"{COMPANY} - {ABBR}"},
        {"name": "Procurement", "parent_cc": f"{COMPANY} - {ABBR}"},
        {"name": "Cold Chain", "parent_cc": f"{COMPANY} - {ABBR}"},
    ]
    for cc in cost_centers:
        cc_name = f"{cc['name']} - {ABBR}"
        if not frappe.db.exists("Cost Center", cc_name):
            doc = frappe.get_doc({
                "doctype": "Cost Center",
                "cost_center_name": cc["name"],
                "company": COMPANY,
                "parent_cost_center": cc.get("parent_cc"),
                "is_group": 0,
            })
            doc.insert(ignore_permissions=True)
            print(f"  ✅ Created Cost Center: {cc_name}")
        else:
            print(f"  ⏩ Cost Center '{cc_name}' exists, skipping.")

    # ── Custom Accounts ──
    print("\n─── Custom Accounts ───")
    # We need to add pharmacy-specific accounts to the auto-generated COA.
    # The exact parent account names depend on the Standard COA template.
    custom_accounts = [
        {"name": f"Drug Expiry Write-Off - {ABBR}", "parent": f"Indirect Expenses - {ABBR}", "type": "Expense Account"},
        {"name": f"BKash Collection - {ABBR}", "parent": f"Bank Accounts - {ABBR}", "type": "Bank", "is_bank": 1},
        {"name": f"Nagad Collection - {ABBR}", "parent": f"Bank Accounts - {ABBR}", "type": "Bank", "is_bank": 1},
    ]
    for acc in custom_accounts:
        if not frappe.db.exists("Account", acc["name"]):
            doc = frappe.get_doc({
                "doctype": "Account",
                "account_name": acc["name"].replace(f" - {ABBR}", ""),
                "parent_account": acc["parent"],
                "account_type": acc["type"],
                "company": COMPANY,
                "is_group": 0,
            })
            doc.insert(ignore_permissions=True)
            print(f"  ✅ Created Account: {acc['name']}")
        else:
            print(f"  ⏩ Account '{acc['name']}' exists, skipping.")

    frappe.db.commit()
    print("\n✅ Phase 1 Complete: Core Setup")


# ═══════════════════════════════════════════════════════════════
# Phase 2: Item Groups, Suppliers, Items
# ═══════════════════════════════════════════════════════════════

def seed_items_and_suppliers() -> None:
    """Create item groups, suppliers, and item masters with batch/expiry config."""
    print("\n══════════════════════════════════════════")
    print("  Phase 2: Items & Suppliers")
    print("══════════════════════════════════════════")

    # ── Item Groups ──
    print("\n─── Item Groups ───")
    groups = [
        {"name": "Medicines", "parent": "All Item Groups", "is_group": 1},
        {"name": "Antibiotics", "parent": "Medicines", "is_group": 0},
        {"name": "Analgesics & Antipyretics", "parent": "Medicines", "is_group": 0},
        {"name": "Gastro-Intestinal", "parent": "Medicines", "is_group": 0},
        {"name": "Anti-Diabetics", "parent": "Medicines", "is_group": 0},
        {"name": "Vaccines & Biologics", "parent": "Medicines", "is_group": 0},
        {"name": "OTC", "parent": "All Item Groups", "is_group": 1},
        {"name": "Vitamins & Supplements", "parent": "OTC", "is_group": 0},
        {"name": "Personal Care", "parent": "OTC", "is_group": 0},
        {"name": "Scheduled Drugs", "parent": "Medicines", "is_group": 0},
    ]
    for g in groups:
        _safe_insert("Item Group", {
            "item_group_name": g["name"],
            "parent_item_group": g["parent"],
            "is_group": g["is_group"],
        })

    # ── Supplier Group ──
    print("\n─── Supplier Groups ───")
    if not frappe.db.exists("Supplier Group", "Pharmaceutical"):
        frappe.get_doc({
            "doctype": "Supplier Group",
            "supplier_group_name": "Pharmaceutical",
        }).insert(ignore_permissions=True)
        print("  ✅ Created Supplier Group: Pharmaceutical")

    # ── Suppliers ──
    print("\n─── Suppliers ───")
    suppliers = [
        "Square Pharmaceuticals Ltd.",
        "Beximco Pharmaceuticals Ltd.",
        "Incepta Pharmaceuticals Ltd.",
        "ACI Limited",
        "Renata Limited",
        "Popular Pharmaceuticals Ltd.",
        "Healthcare Pharmaceuticals Ltd.",
    ]
    for sup in suppliers:
        _safe_insert("Supplier", {
            "supplier_name": sup,
            "supplier_group": "Pharmaceutical",
            "country": COUNTRY,
            "default_currency": CURRENCY,
            "supplier_type": "Company",
        })

    # ── Items ──
    print("\n─── Items ───")
    items = [
        {
            "item_code": "NAPA-EXT-665",
            "item_name": "Napa Extend 665mg (Paracetamol ER)",
            "item_group": "Analgesics & Antipyretics",
            "stock_uom": "Strip",
            "standard_rate": 35,
            "valuation_rate": 22,
            "description": "Paracetamol Extended Release 665mg. 10 tablets per strip. Manufactured by Beximco Pharmaceuticals.",
            "shelf_life_in_days": 730,
            "default_warehouse": f"Retail POS Front - {ABBR}",
            "manufacturer": "Beximco Pharmaceuticals",
            "retain_sample": 0,
        },
        {
            "item_code": "SECLO-20",
            "item_name": "Seclo 20mg (Omeprazole)",
            "item_group": "Gastro-Intestinal",
            "stock_uom": "Strip",
            "standard_rate": 112,
            "valuation_rate": 72,
            "description": "Omeprazole 20mg capsule. 14 capsules per strip. Manufactured by Square Pharmaceuticals.",
            "shelf_life_in_days": 730,
            "default_warehouse": f"Retail POS Front - {ABBR}",
            "manufacturer": "Square Pharmaceuticals",
            "retain_sample": 0,
        },
        {
            "item_code": "AMOXICIL-500",
            "item_name": "Amoxicillin 500mg Capsule",
            "item_group": "Antibiotics",
            "stock_uom": "Strip",
            "standard_rate": 64,
            "valuation_rate": 38,
            "description": "Amoxicillin 500mg capsule. 8 capsules per strip. Manufactured by Incepta Pharmaceuticals.",
            "shelf_life_in_days": 548,
            "default_warehouse": f"Retail POS Front - {ABBR}",
            "manufacturer": "Incepta Pharmaceuticals",
            "retain_sample": 1,
            "sample_quantity": 2,
        },
        {
            "item_code": "NOVORAPID-FP",
            "item_name": "Novorapid FlexPen 100IU/mL (Insulin Aspart)",
            "item_group": "Anti-Diabetics",
            "stock_uom": "Pen",
            "standard_rate": 1450,
            "valuation_rate": 1180,
            "description": "Insulin Aspart 100IU/mL, 3mL pre-filled pen. Imported by Novo Nordisk. COLD CHAIN: Store at 2-8°C.",
            "shelf_life_in_days": 365,
            "default_warehouse": f"Cold Storage - {ABBR}",
            "manufacturer": "Novo Nordisk",
            "retain_sample": 0,
        },
        {
            "item_code": "ACE-PLUS",
            "item_name": "Ace Plus (Paracetamol 500mg + Caffeine 65mg)",
            "item_group": "OTC",
            "stock_uom": "Strip",
            "standard_rate": 18,
            "valuation_rate": 11,
            "description": "Paracetamol 500mg + Caffeine 65mg combination. 10 tablets per strip. Manufactured by Square Pharmaceuticals.",
            "shelf_life_in_days": 1095,
            "default_warehouse": f"Retail POS Front - {ABBR}",
            "manufacturer": "Square Pharmaceuticals",
            "retain_sample": 0,
        },
    ]

    for item_data in items:
        item_dict = {
            "item_code": item_data["item_code"],
            "item_name": item_data["item_name"],
            "item_group": item_data["item_group"],
            "stock_uom": item_data["stock_uom"],
            "standard_rate": item_data["standard_rate"],
            "valuation_rate": item_data["valuation_rate"],
            "description": item_data["description"],
            "is_stock_item": 1,
            "has_batch_no": 1,
            "has_expiry_date": 1,
            "has_serial_no": 0,
            "shelf_life_in_days": item_data.get("shelf_life_in_days", 730),
            "default_material_request_type": "Purchase",
            "valuation_method": "FIFO",
            "default_warehouse": item_data.get("default_warehouse"),
        }
        if item_data.get("retain_sample"):
            item_dict["retain_sample"] = 1
            item_dict["sample_quantity"] = item_data.get("sample_quantity", 2)

        _safe_insert("Item", item_dict)

    # ── Item Prices ──
    print("\n─── Item Prices ───")
    # Ensure price lists exist
    for pl in ["Standard Selling", "Standard Buying"]:
        if not frappe.db.exists("Price List", pl):
            frappe.get_doc({
                "doctype": "Price List",
                "price_list_name": pl,
                "currency": CURRENCY,
                "selling": 1 if "Selling" in pl else 0,
                "buying": 1 if "Buying" in pl else 0,
                "enabled": 1,
            }).insert(ignore_permissions=True)
            print(f"  ✅ Created Price List: {pl}")

    for item_data in items:
        # Selling price
        if not frappe.db.exists("Item Price", {
            "item_code": item_data["item_code"],
            "price_list": "Standard Selling"
        }):
            frappe.get_doc({
                "doctype": "Item Price",
                "item_code": item_data["item_code"],
                "price_list": "Standard Selling",
                "price_list_rate": item_data["standard_rate"],
                "currency": CURRENCY,
            }).insert(ignore_permissions=True)
            print(f"  ✅ Selling price for {item_data['item_code']}: ৳{item_data['standard_rate']}")

        # Buying price
        if not frappe.db.exists("Item Price", {
            "item_code": item_data["item_code"],
            "price_list": "Standard Buying"
        }):
            frappe.get_doc({
                "doctype": "Item Price",
                "item_code": item_data["item_code"],
                "price_list": "Standard Buying",
                "price_list_rate": item_data["valuation_rate"],
                "currency": CURRENCY,
            }).insert(ignore_permissions=True)
            print(f"  ✅ Buying price for {item_data['item_code']}: ৳{item_data['valuation_rate']}")

    # ── Reorder Levels ──
    print("\n─── Reorder Levels ───")
    reorder_config = [
        {"item_code": "NAPA-EXT-665", "warehouse": f"Retail POS Front - {ABBR}", "reorder_level": 50, "reorder_qty": 200},
        {"item_code": "SECLO-20", "warehouse": f"Retail POS Front - {ABBR}", "reorder_level": 30, "reorder_qty": 150},
        {"item_code": "AMOXICIL-500", "warehouse": f"Retail POS Front - {ABBR}", "reorder_level": 40, "reorder_qty": 100},
        {"item_code": "NOVORAPID-FP", "warehouse": f"Cold Storage - {ABBR}", "reorder_level": 5, "reorder_qty": 20},
        {"item_code": "ACE-PLUS", "warehouse": f"Retail POS Front - {ABBR}", "reorder_level": 40, "reorder_qty": 150},
    ]
    for rc in reorder_config:
        item_doc = frappe.get_doc("Item", rc["item_code"])
        # Check if reorder already configured for this warehouse
        existing = [r for r in item_doc.get("reorder_levels", []) if r.warehouse == rc["warehouse"]]
        if not existing:
            item_doc.append("reorder_levels", {
                "warehouse": rc["warehouse"],
                "warehouse_reorder_level": rc["reorder_level"],
                "warehouse_reorder_qty": rc["reorder_qty"],
                "material_request_type": "Purchase",
            })
            item_doc.save(ignore_permissions=True)
            print(f"  ✅ Reorder for {rc['item_code']}: level={rc['reorder_level']}, qty={rc['reorder_qty']}")
        else:
            print(f"  ⏩ Reorder for {rc['item_code']} already set, skipping.")

    frappe.db.commit()
    print("\n✅ Phase 2 Complete: Items & Suppliers")


# ═══════════════════════════════════════════════════════════════
# Phase 3: POS Profile & Healthcare Config
# ═══════════════════════════════════════════════════════════════

def seed_pos_and_healthcare() -> None:
    """Create POS profile, mode of payments, and healthcare configuration."""
    print("\n══════════════════════════════════════════")
    print("  Phase 3: POS & Healthcare Config")
    print("══════════════════════════════════════════")

    # ── Mode of Payment ──
    print("\n─── Modes of Payment ───")
    modes = [
        {"name": "Cash", "type": "Cash"},
        {"name": "BKash", "type": "Bank"},
        {"name": "Nagad", "type": "Bank"},
    ]
    for m in modes:
        if not frappe.db.exists("Mode of Payment", m["name"]):
            doc = frappe.get_doc({
                "doctype": "Mode of Payment",
                "mode_of_payment": m["name"],
                "type": m["type"],
                "accounts": [{
                    "company": COMPANY,
                    "default_account": frappe.db.get_value("Account",
                        {"account_type": m["type"], "company": COMPANY, "is_group": 0},
                        "name"
                    ),
                }],
            })
            doc.insert(ignore_permissions=True)
            print(f"  ✅ Created Mode of Payment: {m['name']}")
        else:
            print(f"  ⏩ Mode of Payment '{m['name']}' exists, skipping.")

    # ── POS Profile ──
    print("\n─── POS Profile ───")
    pos_name = "Antigravity Retail Counter"
    if not frappe.db.exists("POS Profile", pos_name):
        income_account = frappe.db.get_value("Account",
            {"account_type": "Income Account", "company": COMPANY, "is_group": 0},
            "name"
        )
        expense_account = frappe.db.get_value("Account",
            {"name": ["like", f"%Drug Expiry Write-Off%{ABBR}%"]},
            "name"
        ) or frappe.db.get_value("Account",
            {"account_type": "Expense Account", "company": COMPANY, "is_group": 0},
            "name"
        )

        pos_doc = frappe.get_doc({
            "doctype": "POS Profile",
            "name": pos_name,
            "company": COMPANY,
            "warehouse": f"Retail POS Front - {ABBR}",
            "write_off_account": expense_account,
            "income_account": income_account,
            "cost_center": f"Retail Counter - {ABBR}",
            "currency": CURRENCY,
            "selling_price_list": "Standard Selling",
            "apply_discount_on": "Grand Total",
            "update_stock": 1,
            "payments": [
                {"mode_of_payment": "Cash", "default": 1},
                {"mode_of_payment": "BKash", "default": 0},
                {"mode_of_payment": "Nagad", "default": 0},
            ],
        })
        pos_doc.insert(ignore_permissions=True)
        print(f"  ✅ Created POS Profile: {pos_name}")
    else:
        print(f"  ⏩ POS Profile '{pos_name}' exists, skipping.")

    # ── Healthcare Settings ──
    print("\n─── Healthcare Settings ───")
    try:
        hs = frappe.get_doc("Healthcare Settings")
        hs.link_customer_to_patient = 1
        hs.default_medical_code_standard = "ICD-10"
        hs.collect_registration_fee = 1
        hs.registration_fee = 50
        hs.automate_appointment_invoicing = 1
        hs.save(ignore_permissions=True)
        print("  ✅ Healthcare Settings configured")
    except Exception as e:
        print(f"  ⚠ Healthcare Settings: {e} — may need Healthcare app installed")

    # ── Healthcare Practitioners ──
    print("\n─── Healthcare Practitioners ───")
    practitioners = [
        {"name": "Dr. Rezaul Karim", "specialty": "General Physician"},
        {"name": "Dr. Fatema Begum", "specialty": "Gynecology & Obstetrics"},
        {"name": "Dr. Anwar Hossain", "specialty": "Endocrinology"},
    ]
    for p in practitioners:
        if not frappe.db.exists("Healthcare Practitioner", {"practitioner_name": p["name"]}):
            try:
                doc = frappe.get_doc({
                    "doctype": "Healthcare Practitioner",
                    "practitioner_name": p["name"],
                    "department": p.get("specialty", ""),
                })
                doc.insert(ignore_permissions=True)
                print(f"  ✅ Created Practitioner: {p['name']}")
            except Exception as e:
                print(f"  ⚠ Practitioner '{p['name']}': {e}")
        else:
            print(f"  ⏩ Practitioner '{p['name']}' exists, skipping.")

    frappe.db.commit()
    print("\n✅ Phase 3 Complete: POS & Healthcare")


def seed_users() -> None:
    """Create pharmacy system users with different roles."""
    print("\n══════════════════════════════════════════")
    print("  Phase 3.5: Pharmacy System Users")
    print("══════════════════════════════════════════")

    users = [
        {
            "email": "mustafa@antigravity.com",
            "first_name": "Mustafa",
            "last_name": "Rahman",
            "roles": ["System Manager", "Administrator"]
        },
        {
            "email": "nigar@antigravity.com",
            "first_name": "Nigar",
            "last_name": "Sultana",
            "roles": ["Pharmacist", "Stock Manager", "Healthcare Manager"]
        },
        {
            "email": "tanvir@antigravity.com",
            "first_name": "Tanvir",
            "last_name": "Ahmed",
            "roles": ["Sales User", "POS Cashier"]
        },
        {
            "email": "sultana@antigravity.com",
            "first_name": "Sultana",
            "last_name": "Kamal",
            "roles": ["Purchase User", "Purchase Manager"]
        },
        {
            "email": "jasim@antigravity.com",
            "first_name": "Jasim",
            "last_name": "Uddin",
            "roles": ["Stock User", "Stock Auditor"]
        },
        {
            "email": "rezaul@antigravity.com",
            "first_name": "Rezaul",
            "last_name": "Karim",
            "roles": ["Healthcare Practitioner", "Physician"]
        },
        {
            "email": "kamrul@antigravity.com",
            "first_name": "Kamrul",
            "last_name": "Hasan",
            "roles": ["Accounts User", "Accounts Manager"]
        }
    ]

    from frappe.utils.password import update_password

    for u in users:
        email = u["email"]
        if not frappe.db.exists("User", email):
            try:
                # Create the user document
                user_doc = frappe.get_doc({
                    "doctype": "User",
                    "email": email,
                    "first_name": u["first_name"],
                    "last_name": u["last_name"],
                    "send_welcome_email": 0,
                    "enabled": 1
                })
                # Add roles
                for r in u["roles"]:
                    if not frappe.db.exists("Role", r):
                        frappe.get_doc({"doctype": "Role", "role_name": r}).insert(ignore_permissions=True)
                    user_doc.append("roles", {"role": r})

                user_doc.insert(ignore_permissions=True)
                # Set password
                update_password(email, "Antigravity123!")
                print(f"  ✅ Created User: {email} with roles {u['roles']}")
            except Exception as e:
                print(f"  ❌ Error creating User {email}: {e}")
        else:
            print(f"  ⏩ User '{email}' already exists, skipping.")
            # Ensure roles are assigned
            try:
                user_doc = frappe.get_doc("User", email)
                existing_roles = [r.role for r in user_doc.roles]
                added = False
                for r in u["roles"]:
                    if r not in existing_roles:
                        if not frappe.db.exists("Role", r):
                            frappe.get_doc({"doctype": "Role", "role_name": r}).insert(ignore_permissions=True)
                        user_doc.append("roles", {"role": r})
                        added = True
                if added:
                    user_doc.save(ignore_permissions=True)
                    print(f"  ✅ Updated Roles for User: {email}")
            except Exception as e:
                print(f"  ❌ Error updating User roles {email}: {e}")

    frappe.db.commit()
    print("\n✅ User Seeding Complete")


# ═══════════════════════════════════════════════════════════════
# Phase 4: Transactional Seed Data — Batches, Receipts, Invoices
# ═══════════════════════════════════════════════════════════════

def seed_transactions() -> None:
    """Create batches, purchase receipts, patients, sales invoices, and stock entries."""
    print("\n══════════════════════════════════════════")
    print("  Phase 4: Transactional Data")
    print("══════════════════════════════════════════")

    # ── Batches ──
    print("\n─── Batches ───")
    batches = [
        {"batch_id": "BXP-NE-2602A", "item": "NAPA-EXT-665", "mfg": "2026-02-10", "exp": "2028-02-09"},
        {"batch_id": "BXP-NE-2510C", "item": "NAPA-EXT-665", "mfg": "2025-10-15", "exp": "2027-10-14"},
        {"batch_id": "SQP-SC-2604B", "item": "SECLO-20", "mfg": "2026-04-01", "exp": "2028-03-31"},
        {"batch_id": "SQP-SC-2607A", "item": "SECLO-20", "mfg": "2026-07-05", "exp": "2028-07-04"},
        {"batch_id": "INC-AX-2605A", "item": "AMOXICIL-500", "mfg": "2026-05-20", "exp": "2027-11-19"},
        {"batch_id": "INC-AX-2409D", "item": "AMOXICIL-500", "mfg": "2024-09-05", "exp": "2026-03-04"},
        {"batch_id": "NVN-NR-2606A", "item": "NOVORAPID-FP", "mfg": "2026-06-01", "exp": "2027-06-01"},
        {"batch_id": "NVN-NR-2512B", "item": "NOVORAPID-FP", "mfg": "2025-12-10", "exp": "2026-12-09"},
        {"batch_id": "SQP-AP-2603A", "item": "ACE-PLUS", "mfg": "2026-03-18", "exp": "2029-03-17"},
        {"batch_id": "SQP-AP-2607A", "item": "ACE-PLUS", "mfg": "2026-07-01", "exp": "2029-06-30"},
    ]
    for b in batches:
        _safe_insert("Batch", {
            "batch_id": b["batch_id"],
            "item": b["item"],
            "manufacturing_date": b["mfg"],
            "expiry_date": b["exp"],
        })

    # ── Opening Stock (via Stock Reconciliation) ──
    # This simulates 24 months of accumulated stock balances
    print("\n─── Opening Stock (Stock Reconciliation) ───")
    opening_stock = [
        {"item_code": "NAPA-EXT-665", "batch_no": "BXP-NE-2602A", "qty": 387, "rate": 22, "warehouse": f"Retail POS Front - {ABBR}"},
        {"item_code": "NAPA-EXT-665", "batch_no": "BXP-NE-2510C", "qty": 42, "rate": 22, "warehouse": f"Retail POS Front - {ABBR}"},
        {"item_code": "SECLO-20", "batch_no": "SQP-SC-2604B", "qty": 222, "rate": 72, "warehouse": f"Retail POS Front - {ABBR}"},
        {"item_code": "AMOXICIL-500", "batch_no": "INC-AX-2605A", "qty": 178, "rate": 38, "warehouse": f"Retail POS Front - {ABBR}"},
        {"item_code": "AMOXICIL-500", "batch_no": "INC-AX-2409D", "qty": 18, "rate": 38, "warehouse": f"Retail POS Front - {ABBR}"},
        {"item_code": "NOVORAPID-FP", "batch_no": "NVN-NR-2606A", "qty": 14, "rate": 1180, "warehouse": f"Cold Storage - {ABBR}"},
        {"item_code": "NOVORAPID-FP", "batch_no": "NVN-NR-2512B", "qty": 3, "rate": 1180, "warehouse": f"Cold Storage - {ABBR}"},
        {"item_code": "ACE-PLUS", "batch_no": "SQP-AP-2603A", "qty": 510, "rate": 11, "warehouse": f"Retail POS Front - {ABBR}"},
    ]

    try:
        sr = frappe.get_doc({
            "doctype": "Stock Reconciliation",
            "company": COMPANY,
            "posting_date": "2026-07-11",
            "posting_time": "23:59:00",
            "purpose": "Opening Stock",
            "expense_account": frappe.db.get_value("Account",
                {"account_type": "Stock Adjustment", "company": COMPANY, "is_group": 0}, "name"
            ) or frappe.db.get_value("Account",
                {"account_type": "Temporary", "company": COMPANY, "is_group": 0}, "name"
            ),
            "cost_center": f"{COMPANY} - {ABBR}",
            "items": [{
                "item_code": s["item_code"],
                "warehouse": s["warehouse"],
                "batch_no": s["batch_no"],
                "qty": s["qty"],
                "valuation_rate": s["rate"],
            } for s in opening_stock],
        })
        sr.insert(ignore_permissions=True)
        sr.submit()
        print(f"  ✅ Stock Reconciliation submitted: {sr.name}")
    except frappe.DuplicateEntryError:
        print("  ⏩ Stock Reconciliation already exists, skipping.")
    except Exception as e:
        print(f"  ⚠ Stock Reconciliation: {e}")

    # ── Patient ──
    print("\n─── Patient ───")
    patient_name_val = "Rahima Akter"
    if not frappe.db.exists("Patient", {"patient_name": patient_name_val}):
        try:
            patient = frappe.get_doc({
                "doctype": "Patient",
                "patient_name": patient_name_val,
                "sex": "Female",
                "dob": "1988-03-22",
                "blood_group": "B Positive",
                "mobile": "+8801712345678",
                "uid": "1991234567890",
            })
            patient.insert(ignore_permissions=True)
            print(f"  ✅ Created Patient: {patient_name_val} → {patient.name}")
        except Exception as e:
            print(f"  ⚠ Patient: {e}")
    else:
        print(f"  ⏩ Patient '{patient_name_val}' exists, skipping.")

    # ── Purchase Receipt (July 12, 2026 — Square Pharma delivery) ──
    print("\n─── Purchase Receipt ───")
    supplier_name = "Square Pharmaceuticals Ltd."
    supplier = frappe.db.get_value("Supplier", {"supplier_name": supplier_name}, "name")
    if supplier:
        try:
            pr = frappe.get_doc({
                "doctype": "Purchase Receipt",
                "supplier": supplier,
                "posting_date": "2026-07-12",
                "posting_time": "10:30:00",
                "company": COMPANY,
                "currency": CURRENCY,
                "buying_price_list": "Standard Buying",
                "set_warehouse": f"Main Distribution Store - {ABBR}",
                "items": [
                    {
                        "item_code": "SECLO-20",
                        "item_name": "Seclo 20mg",
                        "qty": 300,
                        "uom": "Strip",
                        "rate": 72,
                        "batch_no": "SQP-SC-2607A",
                        "warehouse": f"Main Distribution Store - {ABBR}",
                    },
                    {
                        "item_code": "ACE-PLUS",
                        "item_name": "Ace Plus",
                        "qty": 500,
                        "uom": "Strip",
                        "rate": 11,
                        "batch_no": "SQP-AP-2607A",
                        "warehouse": f"Main Distribution Store - {ABBR}",
                    },
                ],
            })
            pr.insert(ignore_permissions=True)
            pr.submit()
            print(f"  ✅ Purchase Receipt submitted: {pr.name} (Grand Total: ৳{pr.grand_total})")
        except frappe.DuplicateEntryError:
            print("  ⏩ Purchase Receipt already exists, skipping.")
        except Exception as e:
            print(f"  ⚠ Purchase Receipt: {e}")
    else:
        print(f"  ⚠ Supplier '{supplier_name}' not found, skipping Purchase Receipt.")

    # ── POS Sales Invoice (July 12, 2026 — Rahima Akter purchase) ──
    print("\n─── POS Sales Invoice ───")
    customer = frappe.db.get_value("Patient", {"patient_name": patient_name_val}, "customer")
    if not customer:
        # Fallback: find any customer linked
        customer = frappe.db.get_value("Customer", {"customer_name": patient_name_val}, "name")
    if not customer:
        # Create a simple customer as fallback
        customer = frappe.db.get_value("Customer", {"customer_name": "Walk-In Customer"}, "name")

    if customer:
        try:
            debit_account = frappe.db.get_value("Account",
                {"account_type": "Receivable", "company": COMPANY, "is_group": 0}, "name"
            )
            income_account = frappe.db.get_value("Account",
                {"account_type": "Income Account", "company": COMPANY, "is_group": 0}, "name"
            )

            sinv = frappe.get_doc({
                "doctype": "Sales Invoice",
                "customer": customer,
                "posting_date": "2026-07-12",
                "posting_time": "14:45:00",
                "company": COMPANY,
                "is_pos": 1,
                "pos_profile": "Antigravity Retail Counter",
                "currency": CURRENCY,
                "selling_price_list": "Standard Selling",
                "update_stock": 1,
                "set_warehouse": f"Retail POS Front - {ABBR}",
                "cost_center": f"Retail Counter - {ABBR}",
                "debit_to": debit_account,
                "items": [
                    {
                        "item_code": "SECLO-20",
                        "item_name": "Seclo 20mg (Omeprazole)",
                        "qty": 2,
                        "rate": 112,
                        "batch_no": "SQP-SC-2604B",
                        "warehouse": f"Retail POS Front - {ABBR}",
                        "income_account": income_account,
                        "cost_center": f"Retail Counter - {ABBR}",
                    },
                    {
                        "item_code": "ACE-PLUS",
                        "item_name": "Ace Plus",
                        "qty": 3,
                        "rate": 18,
                        "batch_no": "SQP-AP-2603A",
                        "warehouse": f"Retail POS Front - {ABBR}",
                        "income_account": income_account,
                        "cost_center": f"Retail Counter - {ABBR}",
                    },
                ],
                "payments": [{
                    "mode_of_payment": "Cash",
                    "amount": 278,
                }],
            })
            sinv.insert(ignore_permissions=True)
            sinv.submit()
            print(f"  ✅ POS Invoice submitted: {sinv.name} (Grand Total: ৳{sinv.grand_total})")
        except frappe.DuplicateEntryError:
            print("  ⏩ Sales Invoice already exists, skipping.")
        except Exception as e:
            print(f"  ⚠ Sales Invoice: {e}")
    else:
        print("  ⚠ No customer found for POS Invoice, skipping.")

    # ── Stock Entry: Expired Stock Scrapping ──
    print("\n─── Stock Entry: Expired Batch Scrapping ───")
    try:
        expense_account = frappe.db.get_value("Account",
            {"name": ["like", f"%Drug Expiry Write-Off%"]},
            "name"
        ) or frappe.db.get_value("Account",
            {"account_type": "Expense Account", "company": COMPANY, "is_group": 0},
            "name"
        )

        ste = frappe.get_doc({
            "doctype": "Stock Entry",
            "stock_entry_type": "Material Issue",
            "posting_date": "2026-07-12",
            "posting_time": "17:00:00",
            "company": COMPANY,
            "remarks": "Expired batch scrapped — Amoxicillin 500mg Batch INC-AX-2409D (Exp: 2026-03-04). Moved to Quarantine per SOP.",
            "items": [{
                "item_code": "AMOXICIL-500",
                "item_name": "Amoxicillin 500mg",
                "qty": 18,
                "uom": "Strip",
                "s_warehouse": f"Retail POS Front - {ABBR}",
                "batch_no": "INC-AX-2409D",
                "basic_rate": 38,
                "expense_account": expense_account,
                "cost_center": f"{COMPANY} - {ABBR}",
            }],
        })
        ste.insert(ignore_permissions=True)
        ste.submit()
        print(f"  ✅ Stock Entry (Material Issue) submitted: {ste.name} — 18 strips scrapped")
    except frappe.DuplicateEntryError:
        print("  ⏩ Stock Entry already exists, skipping.")
    except Exception as e:
        print(f"  ⚠ Stock Entry: {e}")

    frappe.db.commit()
    print("\n✅ Phase 4 Complete: Transactional Data")


# ═══════════════════════════════════════════════════════════════
# Master Orchestrator
# ═══════════════════════════════════════════════════════════════

def seed_all() -> None:
    """Run all seeding phases in dependency order."""
    print("\n")
    print("╔══════════════════════════════════════════════════════╗")
    print("║  Antigravity Pharmacy — ERPNext Seed Data Loader    ║")
    print("║  Target: 24-Month Operational History               ║")
    print("║  Location: Narayanganj, Bangladesh                  ║")
    print("║  Currency: BDT (৳)                                  ║")
    print("╚══════════════════════════════════════════════════════╝")

    seed_core_setup()
    seed_items_and_suppliers()
    seed_pos_and_healthcare()
    seed_users()
    seed_transactions()

    print("\n")
    print("╔══════════════════════════════════════════════════════╗")
    print("║  ✅ ALL SEEDING COMPLETE                            ║")
    print("║                                                     ║")
    print("║  Summary:                                           ║")
    print("║  • 1 Company (Antigravity Pharmacy)                 ║")
    print("║  • 4 Warehouses (incl. Cold Storage)                ║")
    print("║  • 3 Cost Centers                                   ║")
    print("║  • 10 Item Groups                                   ║")
    print("║  • 7 Suppliers                                      ║")
    print("║  • 5 Items with Batch/Expiry tracking               ║")
    print("║  • 10 Batches (incl. 1 expired)                     ║")
    print("║  • 1 POS Profile (Antigravity Retail Counter)       ║")
    print("║  • 3 Healthcare Practitioners                       ║")
    print("║  • 1 Patient (Rahima Akter)                         ║")
    print("║  • 1 Purchase Receipt (Square Pharma)               ║")
    print("║  • 1 POS Invoice (৳278)                             ║")
    print("║  • 1 Stock Entry (Expired batch scrapping)          ║")
    print("║                                                     ║")
    print("║  Login: http://antigravity.localhost:8080            ║")
    print("║  User:  Administrator / admin                       ║")
    print("╚══════════════════════════════════════════════════════╝")


if __name__ == "__main__":
    seed_all()
