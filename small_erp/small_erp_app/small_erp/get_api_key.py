import frappe

def execute():
    user = frappe.get_doc("User", "Administrator")
    if not user.api_key:
        api_secret = frappe.generate_hash(length=15)
        user.api_key = frappe.generate_hash(length=15)
        user.api_secret = api_secret
        user.save(ignore_permissions=True)
        frappe.db.commit()
    print(f"API_KEY={user.api_key}")
    print(f"API_SECRET={user.get_password('api_secret')}")
