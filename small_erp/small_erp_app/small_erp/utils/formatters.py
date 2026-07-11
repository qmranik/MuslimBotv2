"""
Jinja template helpers — registered in hooks.py for use in all templates.
"""
import frappe
from frappe.utils import flt, fmt_money as _fmt_money, getdate, formatdate


def currency(value, symbol=None):
    """Format number as currency. Usage: {{ value | currency }}"""
    curr = symbol or frappe.defaults.get_global_default("currency") or "BDT"
    return _fmt_money(flt(value), currency=curr)


def short_date(value):
    """Format date as 'Jan 5, 2024'. Usage: {{ date | short_date }}"""
    if not value:
        return ""
    return formatdate(getdate(value), "MMM d, yyyy")


def status_badge(status):
    """Return CSS class for status badges. Usage: class="{{ status | status_badge }}" """
    mapping = {
        "Paid": "badge-success",
        "Unpaid": "badge-warning",
        "Overdue": "badge-danger",
        "Draft": "badge-secondary",
        "Submitted": "badge-primary",
        "Cancelled": "badge-muted",
        "Completed": "badge-success",
        "Pending": "badge-warning",
        "Return": "badge-danger",
        "Credit Note Issued": "badge-info",
    }
    return mapping.get(status, "badge-secondary")


def role_has(role_name):
    """Check if current user has a role. Usage: {% if 'SMB Operator' | role_has %} ... """
    try:
        if not frappe.session or not frappe.session.user:
            return False
        roles = frappe.get_roles(frappe.session.user)
        return role_name in roles
    except Exception:
        return False


def user_can_delete_customer() -> bool:
    """Whether current user may delete customers (for template permission flags)."""
    try:
        return bool(frappe.has_permission("Customer", "delete"))
    except Exception:
        return False


def user_can_cancel_invoice() -> bool:
    """Whether current user may cancel sales invoices (for template permission flags)."""
    try:
        return bool(frappe.has_permission("Sales Invoice", "cancel"))
    except Exception:
        return False
