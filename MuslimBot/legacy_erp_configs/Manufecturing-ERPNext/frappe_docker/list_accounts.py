import frappe

def list_accounts():
    frappe.init(site="antigravity.localhost")
    frappe.connect()
    
    accounts = frappe.db.get_values("Account", {"company": "Antigravity"}, ["name", "account_type", "root_type"])
    for acc in accounts:
        print(f"Name: {acc[0]} | Type: {acc[1]} | Root: {acc[2]}")

if __name__ == "__main__":
    list_accounts()
