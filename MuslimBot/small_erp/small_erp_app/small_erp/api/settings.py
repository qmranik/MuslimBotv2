"""
Settings API — standalone company/user/system settings management.
Allows SMB users to manage their business without ERPNext desk access.
"""
import frappe
from frappe.utils import nowdate, flt


@frappe.whitelist()
def get_company_info():
    """Get current company details for settings page."""
    company = frappe.defaults.get_global_default("company")
    if not company:
        comps = frappe.get_all("Company", limit=1)
        if comps:
            company = comps[0].name
    if not company:
        return {"company": None}

    doc = frappe.get_doc("Company", company)
    return {
        "company": {
            "name": doc.name,
            "company_name": doc.company_name,
            "abbr": doc.abbr,
            "default_currency": doc.default_currency,
            "country": doc.country,
            "domain": doc.domain,
            "phone_no": doc.phone_no or "",
            "email": doc.email or "",
            "website": doc.website or "",
            "address": doc.company_description or "",
        }
    }


@frappe.whitelist()
def update_company_info(phone_no="", email="", website="", address=""):
    """Update company contact details."""
    company = frappe.defaults.get_global_default("company")
    if not company:
        frappe.throw("No company found")

    doc = frappe.get_doc("Company", company)
    if phone_no is not None:
        doc.phone_no = phone_no
    if email is not None:
        doc.email = email
    if website is not None:
        doc.website = website
    if address is not None:
        doc.company_description = address

    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"status": "updated", "company": doc.name}


@frappe.whitelist()
def get_user_profile():
    """Get current user's profile info."""
    user = frappe.session.user
    doc = frappe.get_doc("User", user)
    roles = frappe.get_roles(user)

    return {
        "user": {
            "name": doc.name,
            "full_name": doc.full_name,
            "first_name": doc.first_name or "",
            "last_name": doc.last_name or "",
            "email": doc.email,
            "mobile_no": doc.mobile_no or "",
            "language": doc.language or "en",
            "time_zone": doc.time_zone or "UTC",
            "roles": roles,
        }
    }


@frappe.whitelist()
def update_user_profile(first_name="", last_name="", mobile_no=""):
    """Update current user's profile."""
    user = frappe.session.user
    doc = frappe.get_doc("User", user)

    if first_name:
        doc.first_name = first_name
    if last_name is not None:
        doc.last_name = last_name
    if mobile_no is not None:
        doc.mobile_no = mobile_no

    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"status": "updated", "full_name": doc.full_name}


@frappe.whitelist()
def change_password(old_password, new_password):
    """Change current user's password."""
    from frappe.utils.password import check_password, update_password

    user = frappe.session.user
    # Verify old password
    try:
        check_password(user, old_password)
    except frappe.AuthenticationError:
        frappe.throw("Current password is incorrect")

    update_password(user, new_password)
    frappe.db.commit()
    return {"status": "password_changed"}


@frappe.whitelist()
def get_system_info():
    """System info for settings page."""
    import frappe as f
    company = frappe.defaults.get_global_default("company")

    return {
        "frappe_version": f.__version__,
        "site": frappe.local.site,
        "company": company,
        "currency": frappe.defaults.get_global_default("currency") or "USD",
        "country": frappe.defaults.get_global_default("country") or "—",
        "user_count": frappe.db.count("User", {"enabled": 1, "user_type": "System User"}),
        "item_count": frappe.db.count("Item", {"disabled": 0}),
        "customer_count": frappe.db.count("Customer", {"disabled": 0}),
    }
