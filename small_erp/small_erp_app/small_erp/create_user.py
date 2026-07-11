import frappe

def run():
    if not frappe.db.exists("User", "smb@example.com"):
        user = frappe.get_doc({
            "doctype": "User",
            "email": "smb@example.com",
            "first_name": "SMB",
            "send_welcome_email": 0,
            "roles": [{"role": "SMB Operator"}]
        })
        user.insert(ignore_permissions=True)
        # set password
        from frappe.utils.password import update_password
        update_password("smb@example.com", "password")
        frappe.db.commit()
        print("Created smb@example.com")
    else:
        print("User smb@example.com exists")
