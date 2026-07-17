"""
Pharma Demo Data Seeder — creates realistic pharmaceutical business data.
Run: bench --site small.localhost execute small_erp.seed_pharma.seed_pharma_data
"""
import frappe
from frappe.utils import nowdate, add_days, flt
from datetime import date
import random


def seed_pharma_data():
    if not getattr(frappe.local, 'site', None):
        frappe.connect("small.localhost")

    print("Ensuring Core Fixtures...")
    from erpnext.setup.setup_wizard.operations.install_fixtures import install
    try:
        install("United States")
        frappe.db.commit()
        print("Fixtures applied.")
    except Exception as e:
        print(f"Notice: Fixture installation partially skipped: {e}")
        frappe.db.rollback()

    print("Checking Company...")
    companies = frappe.get_all("Company", limit=1)
    if companies:
        company_name = companies[0].name
        print(f"Found company: {company_name}")
    else:
        print("Creating basic Lazz Pharma company...")
        comp = frappe.get_doc({
            "doctype": "Company",
            "company_name": "Lazz Pharma",
            "abbr": "LDI",
            "default_currency": "USD",
            "country": "United States"
        })
        comp.insert(ignore_permissions=True)
        company_name = comp.name
        frappe.defaults.set_global_default("company", company_name)
        frappe.defaults.set_global_default("currency", "USD")
        frappe.db.commit()
        print(f"Created Company: {company_name}")

    abbr = frappe.db.get_value("Company", company_name, "abbr") or "LDI"
    wh_name = f"Stores - {abbr}"
    cost_center = f"Main - {abbr}"

    # Ensure Fiscal Year exists (required for entries)
    from datetime import date
    current_year = date.today().year
    fy_name = f"{current_year}-{current_year + 1}"
    if not frappe.db.exists("Fiscal Year", fy_name):
        print("Creating Fiscal Year...")
        fy = frappe.get_doc({
            "doctype": "Fiscal Year",
            "year": fy_name,
            "year_start_date": f"{current_year}-01-01",
            "year_end_date": f"{current_year}-12-31"
        })
        fy.insert(ignore_permissions=True)
        frappe.db.commit()

    # Ensure Default Warehouse
    if not frappe.db.exists("Warehouse", wh_name):
        print(f"Creating default warehouse '{wh_name}'...")
        wh = frappe.get_doc({
            "doctype": "Warehouse",
            "warehouse_name": "Stores",
            "company": company_name,
            "warehouse_type": "Transit"
        })
        wh.insert(ignore_permissions=True)
        frappe.db.commit()

    print("=== PHARMA DEMO DATA SEEDER ===")

    # ─── 1. Item Groups ──────────────────────────────────────────────
    pharma_groups = [
        "Tablets & Capsules", "Syrups & Suspensions", "Injectables",
        "Topical & Creams", "Vitamins & Supplements", "First Aid & OTC",
        "Baby & Mother Care", "Personal Hygiene",
    ]
    for g in pharma_groups:
        if not frappe.db.exists("Item Group", g):
            frappe.get_doc({
                "doctype": "Item Group",
                "item_group_name": g,
                "is_group": 0,
                "parent_item_group": "All Item Groups",
            }).insert(ignore_permissions=True)
    print(f"  Created {len(pharma_groups)} item groups")
    frappe.db.commit()

    # ─── 2. Customer Groups ──────────────────────────────────────────
    cust_groups = ["Walk-in", "Hospital", "Clinic", "Wholesale"]
    for cg in cust_groups:
        if not frappe.db.exists("Customer Group", cg):
            frappe.get_doc({
                "doctype": "Customer Group",
                "customer_group_name": cg,
                "is_group": 0,
                "parent_customer_group": "All Customer Groups",
            }).insert(ignore_permissions=True)
    frappe.db.commit()

    # ─── 3. Pharma Items (medicines, OTC, personal care) ─────────────
    pharma_items = [
        # Tablets & Capsules
        ("NAPA-500", "Napa 500mg (Paracetamol)", "Tablets & Capsules", 2.50, "Strip", 500, 50),
        ("NAPA-EX", "Napa Extra (Para+Caffeine)", "Tablets & Capsules", 4.00, "Strip", 300, 30),
        ("SECLO-20", "Seclo 20mg (Omeprazole)", "Tablets & Capsules", 6.00, "Strip", 400, 40),
        ("AZIFAST-500", "Azifast 500mg (Azithromycin)", "Tablets & Capsules", 35.00, "Strip", 200, 20),
        ("MOXACIL-500", "Moxacil 500mg (Amoxicillin)", "Tablets & Capsules", 8.00, "Strip", 350, 30),
        ("LOSECTIL-20", "Losectil 20mg (Esomeprazole)", "Tablets & Capsules", 8.00, "Strip", 250, 25),
        ("CLOPID-75", "Clopid 75mg (Clopidogrel)", "Tablets & Capsules", 12.00, "Strip", 150, 20),
        ("MONTIGET-10", "Montiget 10mg (Montelukast)", "Tablets & Capsules", 10.00, "Strip", 200, 20),
        ("MAXPRO-40", "Maxpro 40mg (Esomeprazole)", "Tablets & Capsules", 12.00, "Strip", 180, 15),
        ("CIPRO-500", "Ciprocin 500mg (Ciprofloxacin)", "Tablets & Capsules", 10.00, "Strip", 200, 20),
        ("FILMET-20", "Filmet 20mg (Famotidine)", "Tablets & Capsules", 5.00, "Strip", 300, 25),
        ("SERGEL-20", "Sergel 20mg (Omeprazole)", "Tablets & Capsules", 5.50, "Strip", 280, 30),
        ("AMBROX-30", "Ambrox 30mg (Ambroxol)", "Tablets & Capsules", 3.50, "Strip", 250, 20),
        ("LOSARTAN-50", "Losar 50mg (Losartan)", "Tablets & Capsules", 7.00, "Strip", 180, 20),
        ("AMLOD-5", "Amlod 5mg (Amlodipine)", "Tablets & Capsules", 4.00, "Strip", 220, 25),
        ("METFORM-500", "Comet 500mg (Metformin)", "Tablets & Capsules", 4.50, "Strip", 350, 40),
        ("GLIMEP-2", "Amaryl 2mg (Glimepiride)", "Tablets & Capsules", 8.00, "Strip", 150, 15),
        ("ATORVA-10", "Atova 10mg (Atorvastatin)", "Tablets & Capsules", 6.00, "Strip", 200, 20),

        # Syrups & Suspensions
        ("NAPA-SYR", "Napa Syrup 60ml", "Syrups & Suspensions", 30.00, "Bottle", 120, 15),
        ("BRODIL-SYR", "Brodil Syrup 100ml", "Syrups & Suspensions", 55.00, "Bottle", 80, 10),
        ("FILMET-SUS", "Filmet Suspension 100ml", "Syrups & Suspensions", 45.00, "Bottle", 90, 12),
        ("HISTACIN-SYR", "Histacin Syrup 100ml", "Syrups & Suspensions", 40.00, "Bottle", 100, 12),
        ("AMBROX-SYR", "Ambroxol Syrup 100ml", "Syrups & Suspensions", 35.00, "Bottle", 110, 15),
        ("COUGH-SYR", "Adovas Cough Syrup 100ml", "Syrups & Suspensions", 50.00, "Bottle", 80, 10),
        ("ANTACID-SUS", "Antacid Suspension 200ml", "Syrups & Suspensions", 60.00, "Bottle", 70, 8),

        # Injectables
        ("INJ-CEFTRI", "Ceftriaxone Injection 1g", "Injectables", 80.00, "Vial", 60, 10),
        ("INJ-RANITID", "Ranitidine Injection 50mg", "Injectables", 15.00, "Ampoule", 100, 15),
        ("INJ-DEXAMETH", "Dexamethasone Injection 4mg", "Injectables", 25.00, "Ampoule", 80, 12),
        ("INJ-INSULIN", "Insulin (Regular) 100IU/ml", "Injectables", 350.00, "Vial", 30, 5),
        ("SALINE-500", "Normal Saline 500ml", "Injectables", 65.00, "Bag", 100, 20),

        # Topical & Creams
        ("SAVLON-100", "Savlon Antiseptic 100ml", "Topical & Creams", 65.00, "Bottle", 150, 20),
        ("SAVLON-250", "Savlon Antiseptic 250ml", "Topical & Creams", 120.00, "Bottle", 80, 10),
        ("NEOSPOR-CR", "Neosporin Cream 15g", "Topical & Creams", 45.00, "Tube", 100, 12),
        ("CLOTRI-CR", "Clotrimazole Cream 20g", "Topical & Creams", 35.00, "Tube", 90, 10),
        ("BURNOL-CR", "Burnol Cream 20g", "Topical & Creams", 40.00, "Tube", 60, 8),
        ("VOLTAR-GEL", "Voltaren Gel 50g", "Topical & Creams", 85.00, "Tube", 70, 10),
        ("BETNO-OIN", "Betnovate Ointment 20g", "Topical & Creams", 55.00, "Tube", 80, 10),

        # Vitamins & Supplements
        ("VIT-C-500", "Vitamin C 500mg", "Vitamins & Supplements", 5.00, "Strip", 400, 50),
        ("VIT-D-2000", "Vitamin D 2000IU", "Vitamins & Supplements", 8.00, "Strip", 250, 30),
        ("CALCIUM-D", "Calcium + Vitamin D", "Vitamins & Supplements", 7.00, "Strip", 300, 35),
        ("IRON-SUP", "Iron Supplement (Ferosul)", "Vitamins & Supplements", 4.50, "Strip", 200, 25),
        ("MULTI-VIT", "Multivitamin Daily", "Vitamins & Supplements", 10.00, "Strip", 350, 40),
        ("ZINC-20", "Zinc 20mg Tablets", "Vitamins & Supplements", 3.00, "Strip", 300, 30),
        ("FOLIC-5", "Folic Acid 5mg", "Vitamins & Supplements", 2.00, "Strip", 400, 40),
        ("OMEGA3", "Omega-3 Fish Oil 1000mg", "Vitamins & Supplements", 15.00, "Capsule", 150, 20),
        ("NANO-BANANA", "Nano Banana Energy Supplement", "Vitamins & Supplements", 450.00, "Bottle", 100, 10),

        # First Aid & OTC
        ("BANDAGE-CR", "Crepe Bandage 10cm", "First Aid & OTC", 25.00, "Roll", 200, 30),
        ("COTTON-50", "Surgical Cotton 50g", "First Aid & OTC", 35.00, "Pack", 150, 20),
        ("MASK-SURG", "Surgical Mask (50pcs)", "First Aid & OTC", 120.00, "Box", 100, 15),
        ("GLOVES-M", "Latex Gloves Medium (100pcs)", "First Aid & OTC", 250.00, "Box", 60, 10),
        ("THERMOM", "Digital Thermometer", "First Aid & OTC", 150.00, "Nos", 40, 5),
        ("BP-MONITOR", "Blood Pressure Monitor", "First Aid & OTC", 1500.00, "Nos", 15, 3),
        ("PULSE-OX", "Pulse Oximeter", "First Aid & OTC", 800.00, "Nos", 20, 3),

        # Baby & Mother Care
        ("BABY-NAPA", "Baby Napa Drops 15ml", "Baby & Mother Care", 25.00, "Bottle", 80, 10),
        ("BABY-ZINC", "Baby Zinc Syrup 60ml", "Baby & Mother Care", 30.00, "Bottle", 60, 8),
        ("BABY-GRIP", "Baby Grip Water 150ml", "Baby & Mother Care", 45.00, "Bottle", 70, 10),
        ("DIAPER-S", "Baby Diapers Small (30pcs)", "Baby & Mother Care", 350.00, "Pack", 40, 5),
        ("PRENATAL", "Prenatal Multivitamin", "Baby & Mother Care", 12.00, "Strip", 150, 20),

        # Personal Hygiene
        ("HANDWASH", "Dettol Handwash 200ml", "Personal Hygiene", 85.00, "Bottle", 100, 15),
        ("SANIT-50", "Hand Sanitizer 50ml", "Personal Hygiene", 40.00, "Bottle", 150, 20),
        ("SANIT-500", "Hand Sanitizer 500ml", "Personal Hygiene", 180.00, "Bottle", 60, 8),
        ("TOOTHPASTE", "Sensodyne Toothpaste 100g", "Personal Hygiene", 220.00, "Tube", 80, 10),
        ("MOUTHWASH", "Listerine Mouthwash 250ml", "Personal Hygiene", 250.00, "Bottle", 50, 8),
    ]

    pl_name = "Standard Selling"
    if not frappe.db.exists("Price List", pl_name):
        frappe.get_doc({
            "doctype": "Price List",
            "price_list_name": pl_name,
            "enabled": 1, "selling": 1, "buying": 0,
        }).insert(ignore_permissions=True)

    items_created = 0
    for item_code, item_name, group, rate, uom, stock_qty, safety in pharma_items:
        if frappe.db.exists("Item", item_code):
            continue
        # Ensure UOM exists
        if not frappe.db.exists("UOM", uom):
            frappe.get_doc({"doctype": "UOM", "uom_name": uom}).insert(ignore_permissions=True)

        doc = frappe.get_doc({
            "doctype": "Item",
            "item_code": item_code,
            "item_name": item_name,
            "item_group": group,
            "stock_uom": uom,
            "is_stock_item": 1,
            "valuation_method": "FIFO",
            "standard_rate": rate,
            "safety_stock": safety,
            "description": item_name,
        })
        doc.insert(ignore_permissions=True)

        # Item Price
        if not frappe.db.exists("Item Price", {"item_code": item_code, "price_list": pl_name}):
            frappe.get_doc({
                "doctype": "Item Price",
                "item_code": item_code,
                "price_list": pl_name,
                "price_list_rate": rate,
            }).insert(ignore_permissions=True)

        items_created += 1

    frappe.db.commit()
    print(f"  Created {items_created} pharma items")

    # ─── 4. Stock Entries (receive initial stock) ─────────────────────
    stock_added = 0
    for item_code, _, _, rate, _, stock_qty, _ in pharma_items:
        if not frappe.db.exists("Item", item_code):
            continue
        try:
            se = frappe.get_doc({
                "doctype": "Stock Entry",
                "stock_entry_type": "Material Receipt",
                "company": company_name,
                "posting_date": add_days(nowdate(), -35),
                "set_posting_time": 1,
                "items": [{
                    "item_code": item_code,
                    "qty": stock_qty,
                    "t_warehouse": wh_name,
                    "cost_center": cost_center,
                    "basic_rate": rate * 0.7,
                }]
            })
            se.insert(ignore_permissions=True)
            se.submit()
            stock_added += 1
        except Exception as e:
            print(f"  Warning: Stock entry for {item_code} failed: {e}")
    frappe.db.commit()
    print(f"  Created {stock_added} stock entries")

    # ─── 5. Customers ────────────────────────────────────────────────
    customers = [
        ("Walk-in Customer", "Walk-in", "01700000000"),
        ("Lazz Pharma Dhanmondi", "Wholesale", "01700000001"),
        ("Lazz Pharma Mirpur", "Wholesale", "01700000002"),
        ("Lazz Pharma Gulshan", "Wholesale", "01700000003"),
        ("Lazz Pharma Uttara", "Wholesale", "01700000004"),
        ("Dhaka Medical College Hospital", "Hospital", "01711111111"),
        ("Popular Diagnostic Center", "Clinic", "01722222222"),
        ("Ibn Sina Hospital", "Hospital", "01733333333"),
        ("Lab Aid Hospital", "Hospital", "01744444444"),
        ("MedPharma Wholesale", "Wholesale", "01755555555"),
        ("Green Life Hospital", "Hospital", "01766666666"),
        ("Shaheed Suhrawardy Hospital", "Hospital", "01777777777"),
        ("United Hospital", "Hospital", "01788888888"),
        ("Dr. Karim Clinic", "Clinic", "01799999999"),
        ("Pharmacy Plus Wholesale", "Wholesale", "01800000001"),
        ("City Clinic Mirpur", "Clinic", "01800000002"),
        ("Star Hospital Chittagong", "Hospital", "01800000003"),
        ("Rahman Medical Store", "Wholesale", "01800000004"),
        ("Mother & Child Care Center", "Clinic", "01800000005"),
    ]

    custs_created = 0
    for cname, cgroup, phone in customers:
        if not frappe.db.exists("Customer", cname):
            frappe.get_doc({
                "doctype": "Customer",
                "customer_name": cname,
                "customer_group": cgroup if frappe.db.exists("Customer Group", cgroup) else "All Customer Groups",
                "territory": "All Territories",
                "mobile_no": phone,
                "customer_type": "Company" if cgroup in ("Hospital", "Wholesale") else "Individual",
            }).insert(ignore_permissions=True)
            custs_created += 1
    frappe.db.commit()
    print(f"  Created {custs_created} customers")

    # ─── 6. Suppliers ────────────────────────────────────────────────
    suppliers = [
        ("Square Pharmaceuticals", "Pharmaceutical"),
        ("Beximco Pharmaceuticals", "Pharmaceutical"),
        ("Incepta Pharmaceuticals", "Pharmaceutical"),
        ("Renata Limited", "Pharmaceutical"),
        ("ACI Limited", "Pharmaceutical"),
        ("Opsonin Pharma", "Pharmaceutical"),
        ("Healthcare Pharmaceuticals", "Pharmaceutical"),
        ("Globe Pharmaceuticals", "Pharmaceutical"),
    ]

    # Ensure Supplier Group exists
    sg_name = "Pharmaceutical"
    if not frappe.db.exists("Supplier Group", sg_name):
        frappe.get_doc({
            "doctype": "Supplier Group",
            "supplier_group_name": sg_name,
        }).insert(ignore_permissions=True)
        frappe.db.commit()

    supps_created = 0
    for sname, sgroup in suppliers:
        if not frappe.db.exists("Supplier", sname):
            frappe.get_doc({
                "doctype": "Supplier",
                "supplier_name": sname,
                "supplier_group": sgroup if frappe.db.exists("Supplier Group", sgroup) else "All Supplier Groups",
                "supplier_type": "Company",
                "country": "Bangladesh",
            }).insert(ignore_permissions=True)
            supps_created += 1
    frappe.db.commit()
    print(f"  Created {supps_created} suppliers")

    # ─── 7. Sales Invoices (past 30 days of sales) ───────────────────
    today = nowdate()
    customer_names = [c[0] for c in customers if frappe.db.exists("Customer", c[0])]
    available_items = [(i[0], i[3]) for i in pharma_items if frappe.db.exists("Item", i[0])]

    invoices_created = 0
    for day_offset in range(30, 0, -1):
        posting_date = add_days(today, -day_offset)
        num_invoices = random.randint(3, 8)

        for _ in range(num_invoices):
            customer = random.choice(customer_names)
            num_items = random.randint(1, 5)
            selected_items = random.sample(available_items, min(num_items, len(available_items)))

            try:
                # Randomize payment terms:
                # 10% Draft, 50% Paid immediately, 20% Overdue, 20% Pending
                invoice_type = random.choice(["Draft", "Paid", "Paid", "Paid", "Paid", "Paid", "Overdue", "Overdue", "Pending", "Pending"])
                
                due_date = posting_date
                if invoice_type == "Pending":
                    # Due date 60 days in future from posting date
                    due_date = add_days(posting_date, 60)

                sinv = frappe.get_doc({
                    "doctype": "Sales Invoice",
                    "company": company_name,
                    "customer": customer,
                    "posting_date": posting_date,
                    "due_date": due_date,
                    "set_posting_time": 1,
                    "update_stock": 1,
                    "items": [{
                        "item_code": ic,
                        "qty": random.randint(1, 10),
                        "rate": rate,
                        "warehouse": wh_name,
                    } for ic, rate in selected_items],
                })
                sinv.insert(ignore_permissions=True)

                if invoice_type != "Draft":
                    sinv.submit()
                    invoices_created += 1

                    # Settle the Paid invoices immediately
                    if invoice_type == "Paid":
                        try:
                            paid_to = frappe.db.get_value("Account", {
                                "company": company_name,
                                "account_type": ["in", ["Cash", "Bank"]],
                                "is_group": 0,
                            }, "name")
                            if paid_to:
                                pe = frappe.get_doc({
                                    "doctype": "Payment Entry",
                                    "payment_type": "Receive",
                                    "party_type": "Customer",
                                    "party": customer,
                                    "company": company_name,
                                    "paid_amount": sinv.grand_total,
                                    "received_amount": sinv.grand_total,
                                    "target_exchange_rate": 1,
                                    "paid_from": sinv.debit_to,
                                    "paid_to": paid_to,
                                    "paid_from_account_currency": sinv.currency,
                                    "paid_to_account_currency": sinv.currency,
                                    "mode_of_payment": random.choice(["Cash", "Bank Transfer", "bKash", "Nagad"]),
                                    "reference_date": posting_date,
                                    "posting_date": posting_date,
                                    "references": [{
                                        "reference_doctype": "Sales Invoice",
                                        "reference_name": sinv.name,
                                        "allocated_amount": sinv.grand_total,
                                    }],
                                })
                                pe.insert(ignore_permissions=True)
                                pe.submit()
                        except Exception:
                            pass
                else:
                    # Created draft invoice count
                    invoices_created += 1

            except Exception as e:
                if "Insufficient Stock" not in str(e):
                    print(f"  Warning: Invoice failed: {e}")
                continue

        frappe.db.commit()

    print(f"  Created {invoices_created} sales invoices (30 days history)")

    # ─── 8. Mode of Payment setup ────────────────────────────────────
    for mop in ["Cash", "Bank Transfer", "Mobile Payment", "bKash", "Nagad"]:
        if not frappe.db.exists("Mode of Payment", mop):
            frappe.get_doc({
                "doctype": "Mode of Payment",
                "mode_of_payment": mop,
                "enabled": 1,
                "type": "Cash" if mop in ["Cash", "bKash", "Nagad"] else "Bank",
            }).insert(ignore_permissions=True)
    frappe.db.commit()

    print("\n=== PHARMA DEMO DATA SEEDED SUCCESSFULLY ===")
    print(f"  Items: {len(pharma_items)}")
    print(f"  Customers: {len(customers)}")
    print(f"  Suppliers: {len(suppliers)}")
    print(f"  Invoices: {invoices_created}")


def generate_api_keys():
    if not getattr(frappe.local, 'site', None):
        frappe.connect("small.localhost")
    user = frappe.get_doc('User', 'Administrator')
    if not user.api_key:
        user.api_key = frappe.generate_hash(length=15)
    api_secret = frappe.generate_hash(length=15)
    user.api_secret = api_secret
    user.save(ignore_permissions=True)
    frappe.db.commit()
    print("KEY:" + user.api_key + " SECRET:" + api_secret)


if __name__ == "__main__":
    seed_pharma_data()
