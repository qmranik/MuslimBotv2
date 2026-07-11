"""
Session-based role routing — redirects SMB roles to /ops and blocks desk access.
Registered via on_session_creation and boot_session hooks in hooks.py.
"""
import frappe

SMB_ROLES = ("SMB Operator", "SMB Manager")
DESK_PREFIXES = ("/app", "/desk", "/api/method/frappe.desk")
ALLOWED_API_PREFIXES = (
    "/api/method/login",
    "/api/method/logout",
    "/api/method/frappe.client.get_value",
    "/api/method/frappe.auth",
    "/api/method/small_erp",
    "/api/method/erpnext",
)


def redirect_users_by_role(login_manager):
    """
    Redirect SMB Operator/Manager users to /ops on login.
    System Managers and Administrators keep full ERPNext /app access.
    """
    user = frappe.session.user
    if user == "Administrator" or user == "Guest":
        return

    roles = frappe.get_roles(user)

    if any(r in roles for r in SMB_ROLES) and "System Manager" not in roles:
        # API login expects JSON — do not override with redirect (breaks fetch on login page)
        request_path = getattr(getattr(frappe.local, "request", None), "path", "") or ""
        if request_path.startswith("/api/method/login"):
            frappe.local.response["home_page"] = "/ops"
            if frappe.local.response.get("message") in (None, "No App"):
                frappe.local.response["message"] = "Logged In"
            return

        frappe.local.response["type"] = "redirect"
        frappe.local.response["location"] = "/ops"


def check_desk_access():
    """
    Boot-session hook that blocks SMB roles from accessing ERPNext Desk.
    Redirects to /ops for any /app, /desk, or restricted API path.
    """
    if not frappe.session or not frappe.session.user:
        return

    user = frappe.session.user
    if user == "Administrator" or user == "Guest":
        return

    roles = frappe.get_roles(user)
    is_smb = any(r in roles for r in SMB_ROLES) and "System Manager" not in roles
    if not is_smb:
        return

    path = frappe.local.request.path

    # Block desk access
    if any(path.startswith(p) for p in DESK_PREFIXES):
        frappe.local.response["type"] = "redirect"
        frappe.local.response["location"] = "/ops"
        return

    # Block non-ops API calls (except auth and our own endpoints)
    if path.startswith("/api/method/"):
        if not any(path.startswith(p) for p in ALLOWED_API_PREFIXES):
            frappe.local.response["type"] = "redirect"
            frappe.local.response["location"] = "/ops"
            return
