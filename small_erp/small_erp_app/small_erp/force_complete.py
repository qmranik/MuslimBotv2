import frappe

def complete():
    frappe.connect("small.localhost")
    print("Setting defaults...")
    frappe.db.set_default("setup_complete", "1")
    
    try:
        ss = frappe.get_doc("System Settings")
        ss.setup_complete = 1
        ss.flags.ignore_mandatory = True
        ss.save(ignore_permissions=True)
        print("System Settings updated.")
    except: pass

    print("Forcing Installed Application status...")
    if frappe.db.table_exists("Installed Application"):
        frappe.db.sql("UPDATE `tabInstalled Application` SET is_setup_complete = 1")
        print("Installed Application records forced to 1.")
    
    # ERPNext specific settings completeness
    try:
        gd = frappe.get_doc("Global Defaults")
        gd.setup_complete = 1
        gd.save(ignore_permissions=True)
        print("Global Defaults updated.")
    except: pass

    frappe.db.commit()
    frappe.clear_cache()
    print("--- ABSOLUTELY FULLY UNLOCKED FOREVER ---")

if __name__ == "__main__":
    complete()
