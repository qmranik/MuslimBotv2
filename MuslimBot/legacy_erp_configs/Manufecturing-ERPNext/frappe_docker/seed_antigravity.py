import frappe

def seed_data():
    print("Starting Antigravity Data Seeding...")
    frappe.init(site="antigravity.localhost")
    frappe.connect()

    # 0. Setup UOMs if missing
    for uom in ["Nos", "Kg"]:
        if not frappe.db.exists("UOM", uom):
            frappe.get_doc({"doctype": "UOM", "uom_name": uom}).insert(ignore_permissions=True)

    # 0.1 Setup Warehouse Types if missing
    for wtype in ["Stores", "Work In Progress", "Finished Goods", "Transit"]:
        if not frappe.db.exists("Warehouse Type", wtype):
            frappe.get_doc({"doctype": "Warehouse Type", "name": wtype}).insert(ignore_permissions=True)

    # 1. Enable Manufacturing
    if not frappe.db.exists("Company", "Antigravity"):
        comp = frappe.get_doc({
            "doctype": "Company",
            "company_name": "Antigravity",
            "default_currency": "USD",
            "country": "United States"
        })
        comp.insert(ignore_permissions=True)
    frappe.db.set_value("Company", "Antigravity", "default_currency", "USD")
    
    # 2. Item Groups
    if not frappe.db.exists("Item Group", "All Item Groups"):
        frappe.get_doc({
            "doctype": "Item Group",
            "item_group_name": "All Item Groups",
            "is_group": 1
        }).insert(ignore_permissions=True)
        
    groups = ["MagLev Raw Materials", "AG Sub-Assemblies", "AG Finished Drones"]
    for group in groups:
        if not frappe.db.exists("Item Group", group):
            doc = frappe.get_doc({
                "doctype": "Item Group",
                "item_group_name": group,
                "parent_item_group": "All Item Groups",
                "is_group": 0
            })
            doc.insert(ignore_permissions=True)
    
    # 3. Warehouses
    warehouses = [
        {"name": "Raw Materials", "type": "Stores"},
        {"name": "WIP", "type": "Work In Progress"},
        {"name": "Finished Goods", "type": "Finished Goods"},
        {"name": "Scrap & Rework", "type": "Transit"}
    ]
    for w in warehouses:
        w_name = f"{w['name']} - AG"
        if not frappe.db.exists("Warehouse", w_name):
            doc = frappe.get_doc({
                "doctype": "Warehouse",
                "warehouse_name": w_name,
                "company": "Antigravity",
                "warehouse_type": w["type"]
            })
            doc.insert(ignore_permissions=True)

    # 4. Items
    items = [
        {"code": "RM-NEO-01", "name": "Neodymium N52 Magnet Block", "group": "MagLev Raw Materials", "uom": "Nos"},
        {"code": "RM-COIL-02", "name": "High-Temp Copper Wire 24AWG", "group": "MagLev Raw Materials", "uom": "Kg"},
        {"code": "SA-MAG-RING", "name": "MagLev Stabilization Ring", "group": "AG Sub-Assemblies", "uom": "Nos"},
        {"code": "FG-DRONE-M1", "name": "High-Speed Drone Propulsion Motor", "group": "AG Finished Drones", "uom": "Nos"}
    ]
    for item in items:
        if not frappe.db.exists("Item", item["code"]):
            doc = frappe.get_doc({
                "doctype": "Item",
                "item_code": item["code"],
                "item_name": item["name"],
                "item_group": item["group"],
                "stock_uom": item["uom"],
                "is_stock_item": 1,
                "valuation_method": "Moving Average"
            })
            doc.insert(ignore_permissions=True)

    # 5. Workstations
    workstations = [
        {"name": "CNC Machining Station Unit-1", "hr_rate": 45.0, "elec": 12.5, "rent": 8.0, "labour": 24.5},
        {"name": "Magnetic Alignment", "hr_rate": 30.0, "elec": 5.0, "rent": 5.0, "labour": 20.0},
        {"name": "Final Assembly Bay Delta", "hr_rate": 50.0, "elec": 10.0, "rent": 15.0, "labour": 25.0}
    ]
    for ws in workstations:
        if not frappe.db.exists("Workstation", ws["name"]):
            doc = frappe.get_doc({
                "doctype": "Workstation",
                "workstation_name": ws["name"],
                "hour_rate": ws["hr_rate"],
                "electricity_cost": ws["elec"],
                "rent_cost": ws["rent"],
                "labour_cost": ws["labour"]
            })
            doc.insert(ignore_permissions=True)

    frappe.db.commit()
    print("Seeding Complete!")

if __name__ == "__main__":
    seed_data()
