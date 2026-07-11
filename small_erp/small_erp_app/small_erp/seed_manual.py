import frappe

def execute():
    try:
        doc = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": "Acme Corp",
            "customer_type": "Company",
            "customer_group": "Commercial"
        })
        doc.insert(ignore_permissions=True, ignore_if_duplicate=True)
        frappe.db.commit()
        print("Created Acme Corp")
    except Exception as e:
        print("Error creating customer:", str(e))
        frappe.db.rollback()

    try:
        item = frappe.get_doc({
            "doctype": "Item",
            "item_code": "PROD-01",
            "item_name": "Premium Widget",
            "item_group": "Products",
            "stock_uom": "Nos",
            "is_stock_item": 1,
            "standard_rate": 150.0
        })
        item.insert(ignore_permissions=True, ignore_if_duplicate=True)
        frappe.db.commit()
        print("Created PROD-01")
    except Exception as e:
        print("Error creating item:", str(e))
        frappe.db.rollback()
