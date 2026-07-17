import frappe
from frappe.utils import nowdate, add_days, flt
import random


def create_demo_data():
    if not getattr(frappe.local, 'site', None):
        frappe.connect("small.localhost")
    print("Ensuring Core Fixtures...")
    from erpnext.setup.setup_wizard.operations.install_fixtures import install
    try:
        install("United States")
        frappe.db.commit()
        print("Fixtures applied.")
    except Exception as e:
        print(f"Notice: Fixture installation partially skipped (already done?): {e}")
        frappe.db.rollback()

    print("Checking Company...")

    companies = frappe.get_all("Company", limit=1)
    if companies:
        company_name = companies[0].name
        print(f"Found company: {company_name}")
    else:
        print("Creating basic demo company...")
        comp = frappe.get_doc({
            "doctype": "Company",
            "company_name": "Lite Demo Inc",
            "abbr": "LDI",
            "default_currency": "USD",
            "country": "United States"
        })
        comp.insert(ignore_permissions=True)
        company_name = comp.name
        frappe.defaults.set_global_default("company", company_name)
        frappe.defaults.set_global_default("currency", "USD")
        print(f"Created Company: {company_name}")

    frappe.db.commit()

    # ─── Warehouses ────────────────────────────────────────────────
    warehouses = {
        "Stores - LDI": "Stores",
        "Dispensary - LDI": "Dispensary",
        "Main Warehouse - LDI": "Main Warehouse",
    }
    for wh_name, wh_label in warehouses.items():
        if not frappe.db.exists("Warehouse", wh_name):
            wh = frappe.get_doc({
                "doctype": "Warehouse",
                "warehouse_name": wh_label,
                "company": company_name,
            })
            wh.insert(ignore_permissions=True)
            print(f"  Created warehouse: {wh_name}")

    # Ensure at least one Warehouse
    all_whs = frappe.get_all("Warehouse", filters={"is_group": 0}, limit=1)
    if not all_whs:
        wh = frappe.get_doc({
            "doctype": "Warehouse",
            "warehouse_name": "Stores",
            "company": company_name,
            "warehouse_type": "Transit"
        })
        wh.insert(ignore_permissions=True)
        all_whs = [wh]
        print("  Created fallback warehouse: Stores - LDI")
    default_wh = all_whs[0].name

    # ─── Customer Groups ────────────────────────────────────────────
    for cg in ["General", "Pharmacy", "Retail"]:
        if not frappe.db.exists("Customer Group", cg):
            doc = frappe.get_doc({
                "doctype": "Customer Group",
                "customer_group_name": cg,
                "is_group": 0,
                "parent_customer_group": "All Customer Groups"
            })
            doc.insert(ignore_permissions=True)
            print(f"  Created customer group: {cg}")

    # ─── Customers ──────────────────────────────────────────────────
    customers_data = [
        {"name": "Demo Client", "group": "General", "phone": "+1-555-0100", "email": "demo@example.com"},
        {"name": "Green Pharmacy", "group": "Pharmacy", "phone": "+1-555-0101", "email": "info@greenpharma.com"},
        {"name": "City Medical Store", "group": "Pharmacy", "phone": "+1-555-0102", "email": "sales@citymed.com"},
        {"name": "Prime Retail Shop", "group": "Retail", "phone": "+1-555-0103", "email": "contact@primeretail.com"},
        {"name": "Metro Drug House", "group": "Pharmacy", "phone": "+1-555-0104", "email": "orders@metrodrug.com"},
    ]
    customer_names = []
    for cd in customers_data:
        if not frappe.db.exists("Customer", cd["name"]):
            c = frappe.get_doc({
                "doctype": "Customer",
                "customer_name": cd["name"],
                "customer_group": cd["group"],
                "mobile_no": cd["phone"],
                "email_id": cd["email"],
                "territory": "All Territories",
                "customer_type": "Individual",
            })
            c.insert(ignore_permissions=True)
            print(f"  Created customer: {cd['name']}")
        customer_names.append(cd["name"])

    # ─── Item Groups ───────────────────────────────────────────────
    item_groups = ["Products", "Medicines", "Supplements", "Medical Equipment"]
    for ig in item_groups:
        if not frappe.db.exists("Item Group", ig):
            doc = frappe.get_doc({
                "doctype": "Item Group",
                "item_group_name": ig,
                "is_group": 0,
                "parent_item_group": "All Item Groups"
            })
            doc.insert(ignore_permissions=True)
            print(f"  Created item group: {ig}")

    # ─── Items ──────────────────────────────────────────────────────
    items_data = [
        {"code": "ITM001", "name": "Super Widget A", "group": "Products", "rate": 450.00, "uom": "Nos"},
        {"code": "ITM002", "name": "Comfort Tablet", "group": "Medicines", "rate": 25.00, "uom": "Nos"},
        {"code": "ITM003", "name": "Health Plus Syrup", "group": "Medicines", "rate": 180.00, "uom": "Bottle"},
        {"code": "ITM004", "name": "Vitamin C 500mg", "group": "Supplements", "rate": 350.00, "uom": "Box"},
        {"code": "ITM005", "name": "Digital Thermometer", "group": "Medical Equipment", "rate": 650.00, "uom": "Nos"},
        {"code": "ITM006", "name": "First Aid Kit", "group": "Products", "rate": 520.00, "uom": "Nos"},
        {"code": "ITM007", "name": "Antiseptic Liquid", "group": "Medicines", "rate": 120.00, "uom": "Bottle"},
        {"code": "ITM008", "name": "Protein Powder Pack", "group": "Supplements", "rate": 1200.00, "uom": "Box"},
        {"code": "ITM009", "name": "Blood Pressure Monitor", "group": "Medical Equipment", "rate": 2200.00, "uom": "Nos"},
        {"code": "ITM010", "name": "Hand Sanitizer 500ml", "group": "Products", "rate": 85.00, "uom": "Bottle"},
    ]

    # Create Price List if missing
    pl_name = "Standard Selling"
    if not frappe.db.exists("Price List", pl_name):
        pl = frappe.get_doc({
            "doctype": "Price List",
            "price_list_name": pl_name,
            "enabled": 1,
            "selling": 1,
            "buying": 0
        })
        pl.insert(ignore_permissions=True)
        print(f"  Created price list: {pl_name}")

    item_codes = []
    for idata in items_data:
        if not frappe.db.exists("Item", idata["code"]):
            item = frappe.get_doc({
                "doctype": "Item",
                "item_code": idata["code"],
                "item_name": idata["name"],
                "item_group": idata["group"],
                "stock_uom": idata["uom"],
                "is_stock_item": 1,
                "valuation_method": "FIFO",
                "standard_rate": idata["rate"],
            })
            item.insert(ignore_permissions=True)
            print(f"  Created item: {idata['code']} - {idata['name']}")

            # Add price
            if not frappe.db.exists("Item Price", {"item_code": idata["code"], "price_list": pl_name}):
                ip = frappe.get_doc({
                    "doctype": "Item Price",
                    "item_code": idata["code"],
                    "price_list": pl_name,
                    "price_list_rate": idata["rate"],
                })
                ip.insert(ignore_permissions=True)
        item_codes.append(idata["code"])

    # ─── Stock Quantities ──────────────────────────────────────────
    print("Adding stock inventory...")
    stock_items = [
        ("ITM001", 100), ("ITM002", 500), ("ITM003", 200),
        ("ITM004", 150), ("ITM005", 50), ("ITM006", 80),
        ("ITM007", 300), ("ITM008", 60), ("ITM009", 30), ("ITM010", 400),
    ]
    for code, qty in stock_items:
        bin_exists = frappe.db.get_value("Bin", {"item_code": code, "warehouse": default_wh}, "actual_qty")
        if not bin_exists or flt(bin_exists) <= 0:
            try:
                se = frappe.get_doc({
                    "doctype": "Stock Entry",
                    "stock_entry_type": "Material Receipt",
                    "company": company_name,
                    "posting_date": nowdate(),
                    "items": [{
                        "item_code": code,
                        "qty": qty,
                        "t_warehouse": default_wh,
                        "uom": "Nos"
                    }]
                })
                se.insert(ignore_permissions=True)
                se.submit()
                print(f"  Stock added: {code} x {qty}")
            except Exception as e:
                print(f"  Warning: Stock entry failed for {code}: {e}")

    # ─── Fiscal Year ────────────────────────────────────────────────
    fy_name = "2026-2027"
    if not frappe.db.exists("Fiscal Year", fy_name):
        fy = frappe.get_doc({
            "doctype": "Fiscal Year",
            "year": fy_name,
            "year_start_date": "2026-01-01",
            "year_end_date": "2026-12-31"
        })
        fy.insert(ignore_permissions=True)
        print(f"  Created fiscal year: {fy_name}")

    # ─── Sales Invoices ─────────────────────────────────────────────
    print("Generating Sales Invoices...")
    invoice_specs = [
        {"customer": "Demo Client", "items": [("ITM001", 3, 450), ("ITM010", 5, 85)], "days_ago": 0, "paid": True},
        {"customer": "Green Pharmacy", "items": [("ITM002", 100, 25), ("ITM003", 20, 180)], "days_ago": 1, "paid": False},
        {"customer": "City Medical Store", "items": [("ITM004", 10, 350), ("ITM005", 5, 650)], "days_ago": 3, "paid": True},
        {"customer": "Prime Retail Shop", "items": [("ITM006", 15, 520), ("ITM007", 50, 120)], "days_ago": 5, "paid": True},
        {"customer": "Metro Drug House", "items": [("ITM008", 8, 1200), ("ITM009", 3, 2200)], "days_ago": 7, "paid": False},
        {"customer": "Green Pharmacy", "items": [("ITM002", 50, 25), ("ITM007", 30, 120)], "days_ago": 2, "paid": True},
        {"customer": "Demo Client", "items": [("ITM001", 5, 450)], "days_ago": 10, "paid": False},
        {"customer": "City Medical Store", "items": [("ITM005", 2, 650), ("ITM009", 1, 2200)], "days_ago": 14, "paid": True},
    ]

    for spec in invoice_specs:
        cust_name = spec["customer"]
        customer_id = frappe.db.get_value("Customer", cust_name, "name")
        if not customer_id:
            continue

        posting_date = add_days(nowdate(), -spec["days_ago"])
        due_date = add_days(posting_date, 7)

        try:
            si = frappe.get_doc({
                "doctype": "Sales Invoice",
                "company": company_name,
                "customer": customer_id,
                "posting_date": posting_date,
                "due_date": due_date,
                "update_stock": 1,
                "items": [{"item_code": code, "qty": qty, "rate": rate} for code, qty, rate in spec["items"]],
            })
            si.insert(ignore_permissions=True)
            si.submit()
            print(f"  Invoice created: {si.name} - {cust_name} - {si.grand_total}")

            # Record payment if paid
            if spec["paid"]:
                pe = frappe.get_doc({
                    "doctype": "Payment Entry",
                    "payment_type": "Receive",
                    "party_type": "Customer",
                    "party": customer_id,
                    "paid_amount": si.grand_total,
                    "received_amount": si.grand_total,
                    "mode_of_payment": random.choice(["Cash", "Bank Transfer"]),
                    "reference_date": posting_date,
                    "references": [{
                        "reference_doctype": "Sales Invoice",
                        "reference_name": si.name,
                        "allocated_amount": si.grand_total,
                    }]
                })
                pe.insert(ignore_permissions=True)
                pe.submit()
                print(f"  Payment recorded: {pe.name}")
        except Exception as e:
            print(f"  Warning: Invoice creation failed for {cust_name}: {e}")

    # ─── Run permissions setup ──────────────────────────────────────
    try:
        from small_erp.setup_permissions import run as setup_perms
        setup_perms()
        print("Permissions configured for SMB roles.")
    except Exception as e:
        print(f"Warning: Permission setup skipped: {e}")

    frappe.db.commit()
    print("--- ALL DEMO DATA SEEDED SUCCESSFULLY ---")


if __name__ == "__main__":
    create_demo_data()
