import frappe
from frappe.utils.password import update_password
from frappe.utils import nowdate, add_days

def seed_everything():
    print("Initializing site antigravity.localhost...")
    frappe.init(site="antigravity.localhost")
    frappe.connect()

    # 0.2 Setup Stock Entry Types if missing
    for setype in ["Material Receipt", "Material Transfer for Manufacture", "Manufacture"]:
        if not frappe.db.exists("Stock Entry Type", setype):
            frappe.get_doc({
                "doctype": "Stock Entry Type",
                "name": setype,
                "purpose": setype
            }).insert(ignore_permissions=True)

    # 0.3 Setup Fiscal Years if missing
    for year in ["2024", "2025", "2026", "2027"]:
        if not frappe.db.exists("Fiscal Year", year):
            frappe.get_doc({
                "doctype": "Fiscal Year",
                "year": year,
                "year_start_date": f"{year}-01-01",
                "year_end_date": f"{year}-12-31"
            }).insert(ignore_permissions=True)

    # 0.4 Setup Price Lists if missing
    for pl_name, is_selling in [("Standard Selling", 1), ("Standard Buying", 0)]:
        if not frappe.db.exists("Price List", pl_name):
            frappe.get_doc({
                "doctype": "Price List",
                "price_list_name": pl_name,
                "enabled": 1,
                "buying": 0 if is_selling else 1,
                "selling": 1 if is_selling else 0,
                "currency": "USD"
            }).insert(ignore_permissions=True)

    # Cleanup previous failed/partial seeds to start fresh
    print("Cleaning up previous seed data...")
    frappe.db.sql("DELETE FROM `tabSales Order` WHERE company='Antigravity'")
    frappe.db.sql("DELETE FROM `tabSales Order Item` WHERE parent like 'SAL-ORD-%'")
    frappe.db.sql("DELETE FROM `tabWork Order` WHERE company='Antigravity'")
    frappe.db.sql("DELETE FROM `tabStock Entry` WHERE company='Antigravity'")
    frappe.db.sql("DELETE FROM `tabStock Entry Detail` WHERE parent like 'STE-%'")
    frappe.db.sql("DELETE FROM `tabStock Ledger Entry` WHERE company='Antigravity'")
    frappe.db.sql("DELETE FROM `tabGL Entry` WHERE company='Antigravity'")
    frappe.db.sql("DELETE FROM `tabDelivery Note` WHERE company='Antigravity'")
    frappe.db.sql("DELETE FROM `tabSales Invoice` WHERE company='Antigravity'")
    frappe.db.sql("DELETE FROM `tabPayment Entry` WHERE company='Antigravity'")
    frappe.db.commit()

    try:
        # 1. Create the User 'connect.qmr@gmail.com'
        user_email = "connect.qmr@gmail.com"
        if not frappe.db.exists("User", user_email):
            user = frappe.get_doc({
                "doctype": "User",
                "email": user_email,
                "first_name": "QMR",
                "send_welcome_email": 0
            })
            user.insert(ignore_permissions=True)
            # Assign Roles
            roles = ["System Manager", "Manufacturing Manager", "Purchase Manager", "Stock Manager", "Sales Manager", "Accounts Manager"]
            for role in roles:
                if frappe.db.exists("Role", role):
                    user.add_roles(role)
            update_password(user_email, "123456789")
            print(f"User {user_email} created with System Manager and manufacturing roles.")
        else:
            # Update password just in case
            update_password(user_email, "123456789")
            print(f"User {user_email} password updated.")

        # Update company defaults
        comp = frappe.get_doc("Company", "Antigravity")
        comp.default_inventory_account = "Stock In Hand - A"
        comp.default_receivable_account = "Debtors - A"
        comp.default_payable_account = "Creditors - A"
        comp.default_expense_account = "Cost of Goods Sold - A"
        comp.default_income_account = "Sales - A"
        comp.default_stock_adjustment_account = "Stock Adjustment - A"
        comp.save(ignore_permissions=True)
        print("Company defaults updated.")

        # Map warehouses to Stock In Hand - A to avoid GL Entry errors
        for wh_name in ["Raw Materials - AG - A", "WIP - AG - A", "Finished Goods - AG - A", "Scrap & Rework - AG - A"]:
            if frappe.db.exists("Warehouse", wh_name):
                wh = frappe.get_doc("Warehouse", wh_name)
                wh.account = "Stock In Hand - A"
                wh.save(ignore_permissions=True)
        frappe.flags.warehouse_account_map = {}
        print("Warehouse accounts mapped and cache cleared.")

        # 2. Add operations and routings if missing
        operations = ["Coil Winding", "Magnetic Core Alignment", "Motor Shell Assembly", "Final Calibrations"]
        for op in operations:
            if not frappe.db.exists("Operation", op):
                frappe.get_doc({
                    "doctype": "Operation",
                    "operation_name": op,
                    "name": op
                }).insert(ignore_permissions=True)
        print("Operations configured.")

        # Set valuation rates on items to ensure cost calculations are non-zero
        item_valuations = {
            "RM-NEO-01": 10.0,
            "RM-COIL-02": 25.0,
            "SA-MAG-RING": 50.0,
            "FG-DRONE-M1": 250.0
        }
        for item_code, val_rate in item_valuations.items():
            frappe.db.set_value("Item", item_code, "standard_rate", val_rate)
            frappe.db.set_value("Item", item_code, "valuation_rate", val_rate)
            frappe.db.set_value("Item", item_code, "valuation_method", "Moving Average")
        print("Item valuation rates updated.")

        # 3. Create BOMs for SA-MAG-RING and FG-DRONE-M1
        sa_bom_name = ""
        if not frappe.db.exists("BOM", {"item": "SA-MAG-RING", "is_active": 1}):
            sa_bom = frappe.get_doc({
                "doctype": "BOM",
                "item": "SA-MAG-RING",
                "quantity": 1.0,
                "company": "Antigravity",
                "is_active": 1,
                "is_default": 1,
                "with_operations": 1
            })
            sa_bom.append("items", {
                "item_code": "RM-NEO-01",
                "qty": 4.0,
                "uom": "Nos",
                "stock_uom": "Nos",
                "rate": 10.0
            })
            sa_bom.append("operations", {
                "operation": "Magnetic Core Alignment",
                "workstation": "Magnetic Alignment",
                "time_in_mins": 30.0,
                "operating_cost": 30.0
            })
            sa_bom.insert(ignore_permissions=True)
            sa_bom.submit()
            sa_bom_name = sa_bom.name
            print(f"BOM {sa_bom.name} created and submitted.")
        else:
            sa_bom_name = frappe.db.get_value("BOM", {"item": "SA-MAG-RING", "is_active": 1})

        fg_bom_name = ""
        if not frappe.db.exists("BOM", {"item": "FG-DRONE-M1", "is_active": 1}):
            fg_bom = frappe.get_doc({
                "doctype": "BOM",
                "item": "FG-DRONE-M1",
                "quantity": 1.0,
                "company": "Antigravity",
                "is_active": 1,
                "is_default": 1,
                "with_operations": 1
            })
            fg_bom.append("items", {
                "item_code": "SA-MAG-RING",
                "qty": 1.0,
                "uom": "Nos",
                "stock_uom": "Nos",
                "bom_no": sa_bom_name,
                "rate": 50.0
            })
            fg_bom.append("items", {
                "item_code": "RM-COIL-02",
                "qty": 0.5,
                "uom": "Kg",
                "stock_uom": "Kg",
                "rate": 25.0
            })
            fg_bom.append("operations", {
                "operation": "Coil Winding",
                "workstation": "CNC Machining Station Unit-1",
                "time_in_mins": 15.0,
                "operating_cost": 45.0
            })
            fg_bom.append("operations", {
                "operation": "Motor Shell Assembly",
                "workstation": "Final Assembly Bay Delta",
                "time_in_mins": 20.0,
                "operating_cost": 50.0
            })
            fg_bom.insert(ignore_permissions=True)
            fg_bom.submit()
            fg_bom_name = fg_bom.name
            print(f"BOM {fg_bom.name} created and submitted.")
        else:
            fg_bom_name = frappe.db.get_value("BOM", {"item": "FG-DRONE-M1", "is_active": 1})

        # 4. Create Supplier and Customer
        if not frappe.db.exists("Supplier Group", "All Supplier Groups"):
            frappe.get_doc({
                "doctype": "Supplier Group",
                "supplier_group_name": "All Supplier Groups",
                "is_group": 1
            }).insert(ignore_permissions=True)

        if not frappe.db.exists("Supplier Group", "Raw Material Suppliers"):
            frappe.get_doc({
                "doctype": "Supplier Group",
                "supplier_group_name": "Raw Material Suppliers",
                "parent_supplier_group": "All Supplier Groups",
                "is_group": 0
            }).insert(ignore_permissions=True)

        if not frappe.db.exists("Supplier", "NeoDymium Metals Inc."):
            sup = frappe.get_doc({
                "doctype": "Supplier",
                "supplier_name": "NeoDymium Metals Inc.",
                "supplier_group": "Raw Material Suppliers"
            })
            sup.insert(ignore_permissions=True)
            print("Supplier NeoDymium Metals Inc. created.")

        if not frappe.db.exists("Customer Group", "All Customer Groups"):
            frappe.get_doc({
                "doctype": "Customer Group",
                "customer_group_name": "All Customer Groups",
                "is_group": 1
            }).insert(ignore_permissions=True)

        if not frappe.db.exists("Customer Group", "Commercial"):
            frappe.get_doc({
                "doctype": "Customer Group",
                "customer_group_name": "Commercial",
                "parent_customer_group": "All Customer Groups",
                "is_group": 0
            }).insert(ignore_permissions=True)

        if not frappe.db.exists("Territory", "All Territories"):
            frappe.get_doc({
                "doctype": "Territory",
                "territory_name": "All Territories",
                "is_group": 1
            }).insert(ignore_permissions=True)

        if not frappe.db.exists("Territory", "United States"):
            frappe.get_doc({
                "doctype": "Territory",
                "territory_name": "United States",
                "parent_territory": "All Territories",
                "is_group": 0
            }).insert(ignore_permissions=True)

        if not frappe.db.exists("Customer", "AeroDyne Defense Corp"):
            cust = frappe.get_doc({
                "doctype": "Customer",
                "customer_name": "AeroDyne Defense Corp",
                "customer_group": "Commercial",
                "territory": "United States"
            })
            cust.insert(ignore_permissions=True)
            print("Customer AeroDyne Defense Corp created.")

        # 5. Seed stock (Material Receipt)
        raw_materials_warehouse = frappe.db.get_value("Warehouse", {"warehouse_name": "Raw Materials - AG", "company": "Antigravity"}) or "Raw Materials - AG - A"
        wip_warehouse = frappe.db.get_value("Warehouse", {"warehouse_name": "WIP - AG", "company": "Antigravity"}) or "WIP - AG - A"
        finished_goods_warehouse = frappe.db.get_value("Warehouse", {"warehouse_name": "Finished Goods - AG", "company": "Antigravity"}) or "Finished Goods - AG - A"

        has_stock = frappe.db.get_value("Stock Ledger Entry", {"company": "Antigravity"})
        if not has_stock:
            se = frappe.get_doc({
                "doctype": "Stock Entry",
                "purpose": "Material Receipt",
                "stock_entry_type": "Material Receipt",
                "company": "Antigravity",
                "posting_date": "2024-07-12",
                "posting_time": "08:00:00"
            })
            se.append("items", {
                "item_code": "RM-NEO-01",
                "qty": 50000,
                "t_warehouse": raw_materials_warehouse,
                "uom": "Nos",
                "stock_uom": "Nos",
                "basic_rate": 10.0,
                "expense_account": "Stock Adjustment - A"
            })
            se.append("items", {
                "item_code": "RM-COIL-02",
                "qty": 20000,
                "t_warehouse": raw_materials_warehouse,
                "uom": "Kg",
                "stock_uom": "Kg",
                "basic_rate": 25.0,
                "expense_account": "Stock Adjustment - A"
            })
            se.insert(ignore_permissions=True)
            se.submit()
            print("Initial stock receipt created and submitted.")
        else:
            print("Stock already exists, skipping initial receipt.")

        # 6. Run simulated manufacturing cycle over 2 years: July 2024 to July 2026
        from datetime import datetime, timedelta
        start_date = datetime(2024, 7, 12)
        end_date = datetime(2026, 7, 12)
        current_date = start_date
        idx = 1

        print("Simulating 2 years of transactions...")
        while current_date < end_date:
            is_open_tx = (end_date - current_date).days <= 15
            
            # Alternate items
            if idx % 2 == 1:
                item_code = "FG-DRONE-M1"
                qty = 20
                rate = 350.0
                bom_no = fg_bom_name
            else:
                item_code = "SA-MAG-RING"
                qty = 40
                rate = 120.0
                bom_no = sa_bom_name

            so_date = current_date.strftime("%Y-%m-%d")
            delivery_date = (current_date + timedelta(days=10)).strftime("%Y-%m-%d")
            wo_date = (current_date + timedelta(days=1)).strftime("%Y-%m-%d")
            transfer_date = (current_date + timedelta(days=2)).strftime("%Y-%m-%d")
            mfg_date = (current_date + timedelta(days=5)).strftime("%Y-%m-%d")
            dn_date = (current_date + timedelta(days=7)).strftime("%Y-%m-%d")
            si_date = (current_date + timedelta(days=7)).strftime("%Y-%m-%d")
            pe_date = (current_date + timedelta(days=8)).strftime("%Y-%m-%d")

            # Create Sales Order
            so = frappe.get_doc({
                "doctype": "Sales Order",
                "company": "Antigravity",
                "customer": "AeroDyne Defense Corp",
                "transaction_date": so_date,
                "delivery_date": delivery_date,
                "selling_price_list": "Standard Selling",
                "price_list_currency": "USD",
                "plc_conversion_rate": 1.0,
                "conversion_rate": 1.0,
                "currency": "USD",
                "skip_delivery_note": 0
            })
            so.append("items", {
                "item_code": item_code,
                "qty": qty,
                "rate": rate,
                "uom": "Nos",
                "warehouse": finished_goods_warehouse
            })
            so.insert(ignore_permissions=True)
            so.submit()

            # Leave some recent ones open
            if is_open_tx and idx % 3 == 0:
                print(f"[{so_date}] Sales Order {so.name} created and left open.")
                current_date += timedelta(days=15)
                idx += 1
                continue

            # Create Work Order
            wo = frappe.get_doc({
                "doctype": "Work Order",
                "company": "Antigravity",
                "item_code": item_code,
                "production_item": item_code,
                "qty": qty,
                "bom_no": bom_no,
                "source_warehouse": raw_materials_warehouse,
                "wip_warehouse": wip_warehouse,
                "fg_warehouse": finished_goods_warehouse,
                "sales_order": so.name,
                "planned_start_date": wo_date
            })
            wo.insert(ignore_permissions=True)
            wo.submit()

            # Leave some recent ones in-progress
            if is_open_tx and idx % 3 == 1:
                print(f"[{wo_date}] Work Order {wo.name} created and left in progress.")
                current_date += timedelta(days=15)
                idx += 1
                continue

            # Transfer materials
            from erpnext.manufacturing.doctype.work_order.work_order import make_stock_entry
            se_transfer = frappe.get_doc(make_stock_entry(wo.name, "Material Transfer for Manufacture", qty))
            se_transfer.stock_entry_type = "Material Transfer for Manufacture"
            se_transfer.posting_date = transfer_date
            for d in se_transfer.items:
                d.expense_account = "Stock Adjustment - A"
            se_transfer.insert(ignore_permissions=True)
            se_transfer.submit()

            # Complete Manufacture
            se_mfg = frappe.get_doc(make_stock_entry(wo.name, "Manufacture", qty))
            se_mfg.stock_entry_type = "Manufacture"
            se_mfg.posting_date = mfg_date
            for d in se_mfg.items:
                d.expense_account = "Stock Adjustment - A"
            for cost in se_mfg.get("additional_costs", []):
                cost.expense_account = "Stock Adjustment - A"
            se_mfg.insert(ignore_permissions=True)
            se_mfg.submit()

            # Complete Work Order
            wo.reload()
            wo.status = "Completed"
            wo.save(ignore_permissions=True)

            # Create Delivery Note using standard helper
            from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note
            dn = frappe.get_doc(make_delivery_note(so.name))
            dn.posting_date = dn_date
            for d in dn.items:
                d.warehouse = finished_goods_warehouse
            dn.insert(ignore_permissions=True)
            dn.submit()

            # Create Sales Invoice using standard helper
            from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice
            si = frappe.get_doc(make_sales_invoice(so.name))
            si.posting_date = si_date
            for d in si.items:
                d.warehouse = finished_goods_warehouse
            si.insert(ignore_permissions=True)
            si.submit()

            # Leave some recent ones unpaid
            if is_open_tx and idx % 3 == 2:
                print(f"[{si_date}] Sales Invoice {si.name} created and left unpaid.")
                current_date += timedelta(days=15)
                idx += 1
                continue

            # Create Payment Entry using standard helper
            from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
            pe = frappe.get_doc(get_payment_entry("Sales Invoice", si.name))
            pe.reference_no = f"PAY-2024-2026-{idx:04d}"
            pe.reference_date = pe_date
            pe.posting_date = pe_date
            pe.insert(ignore_permissions=True)
            pe.submit()

            current_date += timedelta(days=15)
            idx += 1

        frappe.db.commit()
        print("Full System Seeding with 2 years of realistic transactional history completed successfully!")
    except Exception as e:
        frappe.db.rollback()
        print(f"Error during seeding: {str(e)}")
        raise e

if __name__ == "__main__":
    seed_everything()
