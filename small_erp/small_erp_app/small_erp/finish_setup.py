import frappe

def finish():
    # When called via bench execute, frappe is already connected to the site.
    # Only call frappe.connect() if not already connected.
    if not getattr(frappe.local, 'site', None):
        frappe.connect("small.localhost")

    # 1. Set Database default
    frappe.db.set_default("setup_complete", "1")
    
    # 2. Set System Settings value
    try:
        ss = frappe.get_doc("System Settings")
        ss.setup_complete = 1
        # Ensure mandatory fields
        if not ss.language: ss.language = "en"
        if not ss.time_zone: ss.time_zone = "UTC"
        ss.flags.ignore_mandatory = True
        ss.save(ignore_permissions=True)
    except Exception as e:
        print(f"System settings update skipped: {e}")
        
    frappe.db.commit()
    print("--- SUCCESS: SETUP WIZARD BYPASSED FOREVER ---")
