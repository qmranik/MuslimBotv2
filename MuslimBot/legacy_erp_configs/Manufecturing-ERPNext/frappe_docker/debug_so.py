import frappe

def debug():
    frappe.init(site="antigravity.localhost")
    frappe.connect()
    
    so = frappe.get_doc("Sales Order", "SAL-ORD-2026-00001")
    print(f"Sales Order name: {so.name}")
    print(f"docstatus: {so.docstatus}")
    print(f"skip_delivery_note: {so.skip_delivery_note}")
    print("Items:")
    for item in so.items:
        print(f"  - Item Code: {item.item_code}, Qty: {item.qty}, Delivery Date: {item.delivery_date}")

if __name__ == "__main__":
    debug()
