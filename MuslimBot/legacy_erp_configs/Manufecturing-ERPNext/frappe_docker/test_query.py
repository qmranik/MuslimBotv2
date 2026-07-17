import frappe

def test():
    frappe.init(site="antigravity.localhost")
    frappe.connect()

    # Create Customer Group & Territory
    if not frappe.db.exists("Customer Group", "Commercial"):
        frappe.get_doc({
            "doctype": "Customer Group",
            "customer_group_name": "Commercial",
            "parent_customer_group": "All Customer Groups",
            "is_group": 0
        }).insert(ignore_permissions=True)
    if not frappe.db.exists("Territory", "United States"):
        frappe.get_doc({
            "doctype": "Territory",
            "territory_name": "United States",
            "parent_territory": "All Territories",
            "is_group": 0
        }).insert(ignore_permissions=True)
    if not frappe.db.exists("Customer", "AeroDyne Defense Corp"):
        frappe.get_doc({
            "doctype": "Customer",
            "customer_name": "AeroDyne Defense Corp",
            "customer_group": "Commercial",
            "territory": "United States"
        }).insert(ignore_permissions=True)

    # Create & submit SO
    finished_goods_warehouse = frappe.db.get_value("Warehouse", {"warehouse_name": "Finished Goods - AG", "company": "Antigravity"}) or "Finished Goods - AG - A"
    so = frappe.get_doc({
        "doctype": "Sales Order",
        "company": "Antigravity",
        "customer": "AeroDyne Defense Corp",
        "delivery_date": "2026-07-22",
        "selling_price_list": "Standard Selling",
        "price_list_currency": "USD",
        "plc_conversion_rate": 1.0,
        "conversion_rate": 1.0,
        "currency": "USD",
        "skip_delivery_note": 0
    })
    so.append("items", {
        "item_code": "FG-DRONE-M1",
        "qty": 20,
        "rate": 350.0,
        "uom": "Nos",
        "warehouse": finished_goods_warehouse
    })
    so.insert(ignore_permissions=True)
    so.submit()
    frappe.db.commit()
    print("SO created:", so.name)

    # Let's run the exact query used in Work Order validation
    SalesOrder = frappe.qb.DocType("Sales Order")
    SalesOrderItem = frappe.qb.DocType("Sales Order Item")
    ProductBundleItem = frappe.qb.DocType("Product Bundle Item")

    query = (
        frappe.qb.from_(SalesOrder)
        .inner_join(SalesOrderItem)
        .on(SalesOrderItem.parent == SalesOrder.name)
        .left_join(ProductBundleItem)
        .on(ProductBundleItem.parent == SalesOrderItem.item_code)
        .select(SalesOrder.name, SalesOrder.project, SalesOrderItem.delivery_date)
        .where(
            (SalesOrder.skip_delivery_note == 0)
            & (SalesOrder.docstatus == 1)
            & (SalesOrder.name == so.name)
            & (
                (SalesOrderItem.item_code == "FG-DRONE-M1")
                | (ProductBundleItem.item_code == "FG-DRONE-M1")
            )
        )
    )
    res = query.run(as_dict=1)
    print("Query result:", res)

    # If it is empty, let's print individual parts
    print("skip_delivery_note from DB:", frappe.db.get_value("Sales Order", so.name, "skip_delivery_note"))
    print("docstatus from DB:", frappe.db.get_value("Sales Order", so.name, "docstatus"))
    print("Sales Order Items:")
    for item in frappe.db.get_all("Sales Order Item", {"parent": so.name}, ["item_code"]):
        print("  -", item.item_code)

if __name__ == "__main__":
    test()
