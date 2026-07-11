"""
Seed Two Organizations: TechZone Computer Store + MedCare Pharmacy
Populates ALL tabs of Small ERP: Dashboard, POS, Orders, Inventory, Customers, Accounting
"""
import frappe
from frappe.utils import nowdate, add_days, add_months, getdate, flt
import json
import random

def seed_organizations():
    """Main entry point — seeds both orgs with full demo data."""
    print("\n" + "=" * 70)
    print("  SEEDING: TechZone Computer Store + MedCare Pharmacy")
    print("=" * 70 + "\n")

    # Delete existing demo data first
    _cleanup()

    # Create companies
    tech_company = _create_company("TechZone Computer Store", "TCS", "Technology")
    pharma_company = _create_company("MedCare Pharmacy", "MCP", "Pharmaceutical")

    # Set default company
    frappe.db.set_single_value("Global Defaults", "default_company", tech_company)
    frappe.db.set_default("company", tech_company)

    # Create shared fixtures
    _create_fiscal_year()
    _create_payment_modes()

    # Seed TechZone (Computer Store)
    print("\n─── TechZone Computer Store ────────────────────────────────")
    _seed_tech_store(tech_company)

    # Seed MedCare (Pharmacy)
    print("\n─── MedCare Pharmacy ───────────────────────────────────────")
    _seed_pharmacy(pharma_company)

    frappe.db.commit()
    print("\n" + "=" * 70)
    print("  ✅ ALL DATA SEEDED SUCCESSFULLY")
    print("=" * 70)
    print(f"\n  Companies: {tech_company}, {pharma_company}")
    print(f"  Default:   {tech_company}")
    print(f"  Login:     Administrator / admin")
    print(f"  URL:       http://localhost:8000/ops\n")


def _cleanup():
    """Remove previous demo data for clean re-runs."""
    print("Cleaning up previous data...")

    # Cancel and delete submitted documents
    for dt in ["Payment Entry", "Sales Invoice", "Purchase Invoice", "Sales Order", "Stock Entry"]:
        for doc in frappe.get_all(dt, filters={"docstatus": 1}):
            try:
                d = frappe.get_doc(dt, doc.name)
                d.cancel()
            except Exception:
                pass
        frappe.db.sql(f"DELETE FROM `tab{dt}`")

    # Delete child tables safely
    for child in ["Sales Invoice Item", "Purchase Invoice Item", "Stock Entry Detail",
                  "Payment Entry Reference", "Sales Order Item"]:
        try:
            frappe.db.sql(f"DELETE FROM `tab{child}`")
        except Exception:
            pass

    # Delete ledger entries
    for dt in ["Stock Ledger Entry", "GL Entry"]:
        try:
            frappe.db.sql(f"DELETE FROM `tab{dt}`")
        except Exception:
            pass

    # Delete pricing and master data
    frappe.db.sql("DELETE FROM `tabBin`")
    for dt in ["Item Price", "Item Tax", "Pricing Rule"]:
        try:
            frappe.db.sql(f"DELETE FROM `tab{dt}`")
        except Exception:
            pass
    for dt in ["Customer", "Supplier", "Item"]:
        try:
            frappe.db.sql(f"DELETE FROM `tab{dt}`")
        except Exception:
            pass

    frappe.db.sql("DELETE FROM `tabItem Group` WHERE name NOT IN ('All Item Groups', 'Products', 'Raw Material', 'Services', 'Sub Assemblies', 'Consumable')")

    # Delete companies
    for comp in frappe.get_all("Company"):
        try:
            frappe.delete_doc("Company", comp.name, force=True, ignore_permissions=True)
        except Exception:
            pass

    frappe.db.commit()
    print("  Done.")


def _create_company(name, abbr, industry):
    """Create a company with Chart of Accounts."""
    if frappe.db.exists("Company", name):
        return name
    print(f"Creating company: {name} ({abbr})...")
    doc = frappe.get_doc({
        "doctype": "Company",
        "company_name": name,
        "abbr": abbr,
        "default_currency": "USD",
        "country": "United States",
        "chart_of_accounts": "Standard",
        "domain": industry,
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    print(f"  ✓ Company created: {name}")
    return name


def _create_fiscal_year():
    """Ensure a fiscal year covers today's date."""
    today = getdate(nowdate())
    # Check if any fiscal year covers today
    existing = frappe.db.sql("""
        SELECT name FROM `tabFiscal Year`
        WHERE %s BETWEEN year_start_date AND year_end_date
    """, today)
    if existing:
        print(f"  ✓ Fiscal Year: {existing[0][0]} (exists)")
        return
    year = today.year
    fy_name = f"{year}"
    if not frappe.db.exists("Fiscal Year", fy_name):
        frappe.get_doc({
            "doctype": "Fiscal Year",
            "year": fy_name,
            "year_start_date": f"{year}-01-01",
            "year_end_date": f"{year}-12-31",
        }).insert(ignore_permissions=True)
        frappe.db.commit()
        print(f"  ✓ Fiscal Year: {fy_name}")


def _create_payment_modes():
    """Ensure payment modes exist."""
    for mode in ["Cash", "Credit Card", "Bank Transfer", "Mobile Payment"]:
        if not frappe.db.exists("Mode of Payment", mode):
            frappe.get_doc({"doctype": "Mode of Payment", "mode_of_payment": mode, "type": "General"}).insert(ignore_permissions=True)
    frappe.db.commit()


def _create_item_groups(groups, company):
    """Create item groups."""
    for group in groups:
        if not frappe.db.exists("Item Group", group):
            frappe.get_doc({
                "doctype": "Item Group",
                "item_group_name": group,
                "parent_item_group": "All Item Groups",
            }).insert(ignore_permissions=True)
    frappe.db.commit()


def _create_items(items, company):
    """Create items and stock them."""
    warehouse = f"Stores - {frappe.get_cached_value('Company', company, 'abbr')}"
    created = []
    for item in items:
        if frappe.db.exists("Item", item["item_code"]):
            created.append(item["item_code"])
            continue
        doc = frappe.get_doc({
            "doctype": "Item",
            "item_code": item["item_code"],
            "item_name": item["item_name"],
            "item_group": item["item_group"],
            "stock_uom": item.get("uom", "Nos"),
            "is_stock_item": 1,
            "standard_rate": item["rate"],
            "description": item.get("description", item["item_name"]),
            "safety_stock": item.get("safety_stock", 5),
        })
        doc.insert(ignore_permissions=True)
        created.append(doc.name)

    frappe.db.commit()

    # Create stock entries (Material Receipt)
    for item in items:
        qty = item.get("opening_stock", random.randint(20, 200))
        se = frappe.get_doc({
            "doctype": "Stock Entry",
            "stock_entry_type": "Material Receipt",
            "company": company,
            "posting_date": add_days(nowdate(), -30),
            "items": [{
                "item_code": item["item_code"],
                "qty": qty,
                "t_warehouse": warehouse,
                "basic_rate": item["rate"] * 0.6,  # cost price ~60% of selling
            }]
        })
        se.insert(ignore_permissions=True)
        se.submit()

    frappe.db.commit()
    print(f"  ✓ {len(created)} items created + stocked")
    return created


def _create_customers(customers, company):
    """Create customer records."""
    created = []
    for cust in customers:
        if frappe.db.exists("Customer", cust["name"]):
            created.append(cust["name"])
            continue
        doc = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": cust["name"],
            "customer_type": cust.get("type", "Individual"),
            "customer_group": cust.get("group", "Individual"),
            "territory": "United States",
            "mobile_no": cust.get("phone", ""),
            "email_id": cust.get("email", ""),
        })
        doc.insert(ignore_permissions=True)
        created.append(doc.name)
    frappe.db.commit()
    print(f"  ✓ {len(created)} customers created")
    return created


def _create_suppliers(suppliers, company):
    """Create supplier records."""
    for sup in suppliers:
        if frappe.db.exists("Supplier", sup["name"]):
            continue
        frappe.get_doc({
            "doctype": "Supplier",
            "supplier_name": sup["name"],
            "supplier_group": sup.get("group", "Local"),
            "country": "United States",
        }).insert(ignore_permissions=True)
    frappe.db.commit()
    print(f"  ✓ {len(suppliers)} suppliers created")


def _create_invoices(invoices_data, company):
    """Create sales invoices (some paid, some unpaid, some overdue)."""
    warehouse = f"Stores - {frappe.get_cached_value('Company', company, 'abbr')}"
    created = []

    for inv in invoices_data:
        posting_date = inv.get("date", nowdate())
        due_date = inv.get("due_date", add_days(posting_date, 30))
        # ERPNext requires due_date >= posting_date
        if getdate(due_date) < getdate(posting_date):
            due_date = posting_date

        si = frappe.get_doc({
            "doctype": "Sales Invoice",
            "customer": inv["customer"],
            "company": company,
            "posting_date": posting_date,
            "due_date": due_date,
            "update_stock": 1,
            "set_warehouse": warehouse,
            "payment_terms_template": None,
            "items": [{"item_code": i["item"], "qty": i["qty"]} for i in inv["items"]],
        })
        si.insert(ignore_permissions=True)
        si.submit()
        created.append(si.name)

        # Record payment if specified
        if inv.get("paid"):
            pe = frappe.get_doc({
                "doctype": "Payment Entry",
                "payment_type": "Receive",
                "party_type": "Customer",
                "party": inv["customer"],
                "company": company,
                "paid_from": f"Debtors - {frappe.get_cached_value('Company', company, 'abbr')}",
                "paid_to": f"Cash - {frappe.get_cached_value('Company', company, 'abbr')}",
                "paid_amount": si.grand_total,
                "received_amount": si.grand_total,
                "reference_no": f"PAY-{si.name}",
                "reference_date": inv.get("date", nowdate()),
                "mode_of_payment": inv.get("payment_mode", "Cash"),
                "references": [{
                    "reference_doctype": "Sales Invoice",
                    "reference_name": si.name,
                    "allocated_amount": si.grand_total,
                }],
            })
            pe.insert(ignore_permissions=True)
            pe.submit()

    frappe.db.commit()
    paid_count = sum(1 for i in invoices_data if i.get("paid"))
    print(f"  ✓ {len(created)} invoices ({paid_count} paid, {len(created)-paid_count} unpaid)")
    return created


def _create_purchase_invoices(purchases, company):
    """Create purchase invoices for expenses/payables."""
    warehouse = f"Stores - {frappe.get_cached_value('Company', company, 'abbr')}"
    for pur in purchases:
        posting = pur.get("date", add_days(nowdate(), -15))
        pi = frappe.get_doc({
            "doctype": "Purchase Invoice",
            "supplier": pur["supplier"],
            "company": company,
            "posting_date": posting,
            "bill_date": posting,
            "due_date": add_days(posting, 30),
            "update_stock": 1,
            "set_warehouse": warehouse,
            "items": [{"item_code": i["item"], "qty": i["qty"], "rate": i["rate"]} for i in pur["items"]],
        })
        pi.insert(ignore_permissions=True)
        pi.submit()
    frappe.db.commit()
    print(f"  ✓ {len(purchases)} purchase invoices (expenses/payables)")


# ═══════════════════════════════════════════════════════════════════════
# TECH STORE DATA
# ═══════════════════════════════════════════════════════════════════════

def _seed_tech_store(company):
    """Seed TechZone Computer Store with full data."""

    # Item Groups
    groups = ["Laptops", "Desktops", "Accessories", "Peripherals", "Components", "Software"]
    _create_item_groups(groups, company)

    # Items (covering various categories for POS & Inventory tabs)
    items = [
        {"item_code": "TECH-LP-001", "item_name": "ProBook Laptop 15\"", "item_group": "Laptops", "rate": 899.99, "opening_stock": 25, "safety_stock": 5},
        {"item_code": "TECH-LP-002", "item_name": "UltraSlim Laptop 14\"", "item_group": "Laptops", "rate": 1249.99, "opening_stock": 15, "safety_stock": 3},
        {"item_code": "TECH-LP-003", "item_name": "Gaming Laptop RTX 4060", "item_group": "Laptops", "rate": 1599.99, "opening_stock": 10, "safety_stock": 2},
        {"item_code": "TECH-DT-001", "item_name": "Office Desktop i5", "item_group": "Desktops", "rate": 649.99, "opening_stock": 20, "safety_stock": 5},
        {"item_code": "TECH-DT-002", "item_name": "Workstation Desktop i9", "item_group": "Desktops", "rate": 2199.99, "opening_stock": 8, "safety_stock": 2},
        {"item_code": "TECH-AC-001", "item_name": "Wireless Mouse", "item_group": "Accessories", "rate": 29.99, "opening_stock": 150, "safety_stock": 30},
        {"item_code": "TECH-AC-002", "item_name": "Mechanical Keyboard RGB", "item_group": "Accessories", "rate": 89.99, "opening_stock": 80, "safety_stock": 15},
        {"item_code": "TECH-AC-003", "item_name": "USB-C Hub 7-in-1", "item_group": "Accessories", "rate": 49.99, "opening_stock": 100, "safety_stock": 20},
        {"item_code": "TECH-AC-004", "item_name": "Laptop Stand Aluminum", "item_group": "Accessories", "rate": 39.99, "opening_stock": 60, "safety_stock": 10},
        {"item_code": "TECH-PR-001", "item_name": "27\" 4K Monitor", "item_group": "Peripherals", "rate": 449.99, "opening_stock": 30, "safety_stock": 5},
        {"item_code": "TECH-PR-002", "item_name": "Webcam HD 1080p", "item_group": "Peripherals", "rate": 69.99, "opening_stock": 50, "safety_stock": 10},
        {"item_code": "TECH-PR-003", "item_name": "All-in-One Printer", "item_group": "Peripherals", "rate": 199.99, "opening_stock": 20, "safety_stock": 5},
        {"item_code": "TECH-CP-001", "item_name": "16GB DDR5 RAM", "item_group": "Components", "rate": 79.99, "opening_stock": 40, "safety_stock": 10},
        {"item_code": "TECH-CP-002", "item_name": "1TB NVMe SSD", "item_group": "Components", "rate": 99.99, "opening_stock": 50, "safety_stock": 10},
        {"item_code": "TECH-CP-003", "item_name": "RTX 4070 Graphics Card", "item_group": "Components", "rate": 599.99, "opening_stock": 12, "safety_stock": 3},
        {"item_code": "TECH-SW-001", "item_name": "Windows 11 Pro License", "item_group": "Software", "rate": 199.99, "uom": "Nos", "opening_stock": 100, "safety_stock": 20},
        {"item_code": "TECH-SW-002", "item_name": "Office 365 Annual", "item_group": "Software", "rate": 99.99, "uom": "Nos", "opening_stock": 80, "safety_stock": 15},
        {"item_code": "TECH-AC-005", "item_name": "Laptop Bag 15.6\"", "item_group": "Accessories", "rate": 44.99, "opening_stock": 70, "safety_stock": 15},
        {"item_code": "TECH-AC-006", "item_name": "Screen Protector 15\"", "item_group": "Accessories", "rate": 14.99, "opening_stock": 200, "safety_stock": 40},
        {"item_code": "TECH-PR-004", "item_name": "Bluetooth Speaker", "item_group": "Peripherals", "rate": 59.99, "opening_stock": 45, "safety_stock": 10},
    ]
    _create_items(items, company)

    # Customers
    customers = [
        {"name": "Alex Johnson", "type": "Individual", "group": "Individual", "phone": "555-0101", "email": "alex.j@email.com"},
        {"name": "Sarah Williams", "type": "Individual", "group": "Individual", "phone": "555-0102", "email": "sarah.w@email.com"},
        {"name": "Mike Chen", "type": "Individual", "group": "Individual", "phone": "555-0103", "email": "mike.c@email.com"},
        {"name": "TechStart Inc", "type": "Company", "group": "Commercial", "phone": "555-0201", "email": "orders@techstart.com"},
        {"name": "Digital Solutions LLC", "type": "Company", "group": "Commercial", "phone": "555-0202", "email": "procurement@digitalsol.com"},
        {"name": "City School District", "type": "Company", "group": "Government", "phone": "555-0301", "email": "it@cityschools.edu"},
        {"name": "Rivera Creative Agency", "type": "Company", "group": "Commercial", "phone": "555-0203", "email": "admin@riveracreative.com"},
        {"name": "James Park", "type": "Individual", "group": "Individual", "phone": "555-0104", "email": "james.p@email.com"},
        {"name": "Emily Rodriguez", "type": "Individual", "group": "Individual", "phone": "555-0105", "email": "emily.r@email.com"},
        {"name": "Walk-in Customer", "type": "Individual", "group": "Individual", "phone": "", "email": ""},
    ]
    _create_customers(customers, company)

    # Suppliers
    suppliers = [
        {"name": "TechDistro Global", "group": "Local"},
        {"name": "ComponentHub Inc", "group": "Local"},
        {"name": "SoftwareDirect", "group": "Local"},
    ]
    _create_suppliers(suppliers, company)

    # Sales Invoices (mix of paid/unpaid/overdue for Orders & Accounting tabs)
    today = nowdate()
    invoices = [
        # Recent paid orders
        {"customer": "Alex Johnson", "date": add_days(today, -1), "items": [{"item": "TECH-LP-001", "qty": 1}, {"item": "TECH-AC-005", "qty": 1}], "paid": True, "payment_mode": "Credit Card"},
        {"customer": "TechStart Inc", "date": add_days(today, -2), "items": [{"item": "TECH-DT-001", "qty": 5}, {"item": "TECH-PR-001", "qty": 5}, {"item": "TECH-AC-002", "qty": 5}], "paid": True, "payment_mode": "Bank Transfer"},
        {"customer": "Sarah Williams", "date": add_days(today, -3), "items": [{"item": "TECH-AC-001", "qty": 2}, {"item": "TECH-AC-003", "qty": 1}], "paid": True, "payment_mode": "Cash"},
        {"customer": "Mike Chen", "date": add_days(today, -5), "items": [{"item": "TECH-LP-003", "qty": 1}, {"item": "TECH-CP-001", "qty": 2}], "paid": True, "payment_mode": "Credit Card"},
        {"customer": "Walk-in Customer", "date": add_days(today, -1), "items": [{"item": "TECH-AC-006", "qty": 3}, {"item": "TECH-AC-004", "qty": 1}], "paid": True, "payment_mode": "Cash"},
        {"customer": "Emily Rodriguez", "date": today, "items": [{"item": "TECH-LP-002", "qty": 1}, {"item": "TECH-SW-001", "qty": 1}], "paid": True, "payment_mode": "Credit Card"},
        # Unpaid (receivables)
        {"customer": "Digital Solutions LLC", "date": add_days(today, -7), "due_date": add_days(today, 23), "items": [{"item": "TECH-DT-002", "qty": 3}, {"item": "TECH-PR-001", "qty": 3}], "paid": False},
        {"customer": "City School District", "date": add_days(today, -10), "due_date": add_days(today, 20), "items": [{"item": "TECH-LP-001", "qty": 10}, {"item": "TECH-SW-002", "qty": 10}], "paid": False},
        {"customer": "Rivera Creative Agency", "date": add_days(today, -5), "due_date": add_days(today, 25), "items": [{"item": "TECH-LP-002", "qty": 2}, {"item": "TECH-PR-001", "qty": 2}], "paid": False},
        # Overdue (due_date in past but >= posting_date)
        {"customer": "James Park", "date": add_days(today, -40), "due_date": add_days(today, -30), "items": [{"item": "TECH-CP-003", "qty": 1}, {"item": "TECH-CP-002", "qty": 2}], "paid": False},
    ]
    _create_invoices(invoices, company)

    # Purchase Invoices (expenses for Accounting tab)
    purchases = [
        {"supplier": "TechDistro Global", "date": add_days(today, -20), "items": [
            {"item": "TECH-LP-001", "qty": 20, "rate": 540},
            {"item": "TECH-LP-002", "qty": 10, "rate": 750},
        ]},
        {"supplier": "ComponentHub Inc", "date": add_days(today, -15), "items": [
            {"item": "TECH-CP-001", "qty": 30, "rate": 48},
            {"item": "TECH-CP-002", "qty": 40, "rate": 60},
            {"item": "TECH-CP-003", "qty": 10, "rate": 360},
        ]},
        {"supplier": "SoftwareDirect", "date": add_days(today, -10), "items": [
            {"item": "TECH-SW-001", "qty": 50, "rate": 120},
            {"item": "TECH-SW-002", "qty": 40, "rate": 60},
        ]},
    ]
    _create_purchase_invoices(purchases, company)

    print(f"  ✓ TechZone Computer Store — COMPLETE")


# ═══════════════════════════════════════════════════════════════════════
# PHARMACY DATA
# ═══════════════════════════════════════════════════════════════════════

def _seed_pharmacy(company):
    """Seed MedCare Pharmacy with full data."""

    # Item Groups
    groups = ["Tablets", "Capsules", "Syrups", "Injections", "OTC", "Personal Care", "Medical Devices"]
    _create_item_groups(groups, company)

    # Items
    items = [
        {"item_code": "MED-TAB-001", "item_name": "Paracetamol 500mg (Strip/10)", "item_group": "Tablets", "rate": 2.50, "uom": "Strip", "opening_stock": 500, "safety_stock": 100},
        {"item_code": "MED-TAB-002", "item_name": "Amoxicillin 500mg (Strip/10)", "item_group": "Tablets", "rate": 8.50, "uom": "Strip", "opening_stock": 300, "safety_stock": 60},
        {"item_code": "MED-TAB-003", "item_name": "Omeprazole 20mg (Strip/14)", "item_group": "Tablets", "rate": 6.99, "uom": "Strip", "opening_stock": 250, "safety_stock": 50},
        {"item_code": "MED-TAB-004", "item_name": "Metformin 500mg (Strip/10)", "item_group": "Tablets", "rate": 4.50, "uom": "Strip", "opening_stock": 400, "safety_stock": 80},
        {"item_code": "MED-TAB-005", "item_name": "Amlodipine 5mg (Strip/10)", "item_group": "Tablets", "rate": 5.99, "uom": "Strip", "opening_stock": 350, "safety_stock": 70},
        {"item_code": "MED-TAB-006", "item_name": "Ibuprofen 400mg (Strip/10)", "item_group": "Tablets", "rate": 3.50, "uom": "Strip", "opening_stock": 400, "safety_stock": 80},
        {"item_code": "MED-CAP-001", "item_name": "Vitamin D3 1000IU (Bottle/60)", "item_group": "Capsules", "rate": 12.99, "uom": "Bottle", "opening_stock": 150, "safety_stock": 30},
        {"item_code": "MED-CAP-002", "item_name": "Fish Oil Omega-3 (Bottle/90)", "item_group": "Capsules", "rate": 18.99, "uom": "Bottle", "opening_stock": 100, "safety_stock": 20},
        {"item_code": "MED-CAP-003", "item_name": "Multivitamin Daily (Bottle/30)", "item_group": "Capsules", "rate": 9.99, "uom": "Bottle", "opening_stock": 200, "safety_stock": 40},
        {"item_code": "MED-SYR-001", "item_name": "Cough Syrup 100ml", "item_group": "Syrups", "rate": 5.99, "uom": "Bottle", "opening_stock": 120, "safety_stock": 25},
        {"item_code": "MED-SYR-002", "item_name": "Antacid Suspension 200ml", "item_group": "Syrups", "rate": 7.50, "uom": "Bottle", "opening_stock": 100, "safety_stock": 20},
        {"item_code": "MED-SYR-003", "item_name": "Children's Fever Reducer 60ml", "item_group": "Syrups", "rate": 4.99, "uom": "Bottle", "opening_stock": 80, "safety_stock": 15},
        {"item_code": "MED-INJ-001", "item_name": "Insulin Pen (Prefilled)", "item_group": "Injections", "rate": 45.00, "uom": "Nos", "opening_stock": 50, "safety_stock": 10},
        {"item_code": "MED-OTC-001", "item_name": "Band-Aid Assorted (Box/100)", "item_group": "OTC", "rate": 6.99, "uom": "Box", "opening_stock": 80, "safety_stock": 15},
        {"item_code": "MED-OTC-002", "item_name": "Hand Sanitizer 500ml", "item_group": "OTC", "rate": 4.99, "uom": "Bottle", "opening_stock": 150, "safety_stock": 30},
        {"item_code": "MED-OTC-003", "item_name": "Face Mask N95 (Pack/10)", "item_group": "OTC", "rate": 12.99, "uom": "Pack", "opening_stock": 200, "safety_stock": 50},
        {"item_code": "MED-PC-001", "item_name": "Sunscreen SPF50 100ml", "item_group": "Personal Care", "rate": 14.99, "uom": "Tube", "opening_stock": 70, "safety_stock": 15},
        {"item_code": "MED-PC-002", "item_name": "Moisturizer Cream 200ml", "item_group": "Personal Care", "rate": 11.99, "uom": "Jar", "opening_stock": 60, "safety_stock": 12},
        {"item_code": "MED-MD-001", "item_name": "Digital Thermometer", "item_group": "Medical Devices", "rate": 9.99, "uom": "Nos", "opening_stock": 40, "safety_stock": 8},
        {"item_code": "MED-MD-002", "item_name": "Blood Pressure Monitor", "item_group": "Medical Devices", "rate": 49.99, "uom": "Nos", "opening_stock": 20, "safety_stock": 5},
    ]
    _create_items(items, company)

    # Customers
    customers = [
        {"name": "Fatima Hassan", "type": "Individual", "group": "Individual", "phone": "555-1001", "email": "fatima.h@email.com"},
        {"name": "Ahmed Khan", "type": "Individual", "group": "Individual", "phone": "555-1002", "email": "ahmed.k@email.com"},
        {"name": "Lisa Thompson", "type": "Individual", "group": "Individual", "phone": "555-1003", "email": "lisa.t@email.com"},
        {"name": "Robert Davis", "type": "Individual", "group": "Individual", "phone": "555-1004", "email": "robert.d@email.com"},
        {"name": "Maria Santos", "type": "Individual", "group": "Individual", "phone": "555-1005", "email": "maria.s@email.com"},
        {"name": "Sunrise Clinic", "type": "Company", "group": "Commercial", "phone": "555-2001", "email": "pharmacy@sunriseclinic.com"},
        {"name": "Elder Care Home", "type": "Company", "group": "Commercial", "phone": "555-2002", "email": "orders@eldercare.com"},
        {"name": "City General Hospital", "type": "Company", "group": "Government", "phone": "555-3001", "email": "pharmacy@cityhospital.org"},
        {"name": "David Wilson", "type": "Individual", "group": "Individual", "phone": "555-1006", "email": "david.w@email.com"},
        {"name": "Walk-in Patient", "type": "Individual", "group": "Individual", "phone": "", "email": ""},
    ]
    _create_customers(customers, company)

    # Suppliers
    suppliers = [
        {"name": "PharmaWholesale Ltd", "group": "Local"},
        {"name": "MedSupply Direct", "group": "Local"},
        {"name": "BioHealth Distributors", "group": "Local"},
    ]
    _create_suppliers(suppliers, company)

    # Sales Invoices
    today = nowdate()
    invoices = [
        # Paid (recent)
        {"customer": "Fatima Hassan", "date": today, "items": [{"item": "MED-TAB-004", "qty": 3}, {"item": "MED-TAB-005", "qty": 2}, {"item": "MED-CAP-001", "qty": 1}], "paid": True, "payment_mode": "Cash"},
        {"customer": "Ahmed Khan", "date": today, "items": [{"item": "MED-TAB-001", "qty": 5}, {"item": "MED-SYR-001", "qty": 2}], "paid": True, "payment_mode": "Cash"},
        {"customer": "Walk-in Patient", "date": today, "items": [{"item": "MED-OTC-002", "qty": 2}, {"item": "MED-OTC-003", "qty": 1}], "paid": True, "payment_mode": "Cash"},
        {"customer": "Lisa Thompson", "date": add_days(today, -1), "items": [{"item": "MED-TAB-003", "qty": 2}, {"item": "MED-SYR-002", "qty": 1}], "paid": True, "payment_mode": "Credit Card"},
        {"customer": "Robert Davis", "date": add_days(today, -2), "items": [{"item": "MED-INJ-001", "qty": 2}, {"item": "MED-MD-002", "qty": 1}], "paid": True, "payment_mode": "Credit Card"},
        {"customer": "Maria Santos", "date": add_days(today, -3), "items": [{"item": "MED-TAB-002", "qty": 3}, {"item": "MED-TAB-006", "qty": 2}, {"item": "MED-SYR-003", "qty": 1}], "paid": True, "payment_mode": "Cash"},
        {"customer": "David Wilson", "date": add_days(today, -4), "items": [{"item": "MED-PC-001", "qty": 1}, {"item": "MED-PC-002", "qty": 1}, {"item": "MED-MD-001", "qty": 1}], "paid": True, "payment_mode": "Mobile Payment"},
        # Unpaid (receivables from clinics/hospitals)
        {"customer": "Sunrise Clinic", "date": add_days(today, -5), "due_date": add_days(today, 25), "items": [
            {"item": "MED-TAB-001", "qty": 50}, {"item": "MED-TAB-002", "qty": 30}, {"item": "MED-TAB-003", "qty": 20},
            {"item": "MED-SYR-001", "qty": 20}, {"item": "MED-OTC-001", "qty": 10}
        ], "paid": False},
        {"customer": "Elder Care Home", "date": add_days(today, -8), "due_date": add_days(today, 22), "items": [
            {"item": "MED-TAB-004", "qty": 40}, {"item": "MED-TAB-005", "qty": 30},
            {"item": "MED-INJ-001", "qty": 10}, {"item": "MED-CAP-003", "qty": 20}
        ], "paid": False},
        {"customer": "City General Hospital", "date": add_days(today, -12), "due_date": add_days(today, 18), "items": [
            {"item": "MED-TAB-001", "qty": 100}, {"item": "MED-TAB-002", "qty": 50},
            {"item": "MED-INJ-001", "qty": 20}, {"item": "MED-OTC-003", "qty": 50}
        ], "paid": False},
        # Overdue (due_date in past but >= posting_date)
        {"customer": "Sunrise Clinic", "date": add_days(today, -45), "due_date": add_days(today, -30), "items": [
            {"item": "MED-TAB-001", "qty": 30}, {"item": "MED-SYR-002", "qty": 15}
        ], "paid": False},
    ]
    _create_invoices(invoices, company)

    # Purchase Invoices
    purchases = [
        {"supplier": "PharmaWholesale Ltd", "date": add_days(today, -20), "items": [
            {"item": "MED-TAB-001", "qty": 300, "rate": 1.50},
            {"item": "MED-TAB-002", "qty": 200, "rate": 5.10},
            {"item": "MED-TAB-003", "qty": 150, "rate": 4.20},
        ]},
        {"supplier": "MedSupply Direct", "date": add_days(today, -12), "items": [
            {"item": "MED-INJ-001", "qty": 30, "rate": 27.00},
            {"item": "MED-CAP-001", "qty": 100, "rate": 7.80},
            {"item": "MED-CAP-002", "qty": 60, "rate": 11.40},
        ]},
        {"supplier": "BioHealth Distributors", "date": add_days(today, -8), "items": [
            {"item": "MED-OTC-002", "qty": 100, "rate": 3.00},
            {"item": "MED-OTC-003", "qty": 150, "rate": 7.80},
            {"item": "MED-MD-002", "qty": 15, "rate": 30.00},
        ]},
    ]
    _create_purchase_invoices(purchases, company)

    print(f"  ✓ MedCare Pharmacy — COMPLETE")
