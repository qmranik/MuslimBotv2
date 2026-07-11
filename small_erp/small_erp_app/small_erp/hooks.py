"""
Small ERP — Frappe App Hooks
Simplified HTMX frontend for ERPNext, optimized for small organizations.
Unified from lite_erp + smb_ops into a single production-ready app.
"""

app_name = "small_erp"
app_title = "Small ERP"
app_publisher = "DOS"
app_description = "AI-driven simplified ERP frontend for small businesses on ERPNext"
app_email = "qmranik@gmail.com"
app_license = "MIT"
required_apps = ["frappe", "erpnext"]

# ─── Session Routing (SaaS tier enforcement) ────────────────────────────
on_session_creation = "small_erp.utils.routing.redirect_users_by_role"
# Blocks SMB roles from accessing /app, /desk, or unauthorized API paths
boot_session = "small_erp.utils.routing.check_desk_access"

# ─── Static Assets ──────────────────────────────────────────────────────
app_include_css = ["/assets/small_erp/css/small-erp.css"]
app_include_js = [
    "/assets/small_erp/js/htmx.min.js",
    "/assets/small_erp/js/small-erp.js",
]

# ─── Doc Events (hooks into ERPNext doctypes) ───────────────────────────
doc_events = {
    "Sales Invoice": {
        "on_submit": "small_erp.api.events.on_sales_invoice_submit",
    },
    "Purchase Receipt": {
        "on_submit": "small_erp.api.events.on_purchase_receipt_submit",
    },
    "Stock Entry": {
        "on_submit": "small_erp.api.events.on_stock_entry_submit",
    },
}

# ─── Scheduled Tasks ────────────────────────────────────────────────────
scheduler_events = {
    "daily": [
        "small_erp.api.scheduled.daily_summary_report",
    ],
    "weekly": [
        "small_erp.api.scheduled.weekly_inventory_check",
    ],
}

# ─── Jinja Environment ──────────────────────────────────────────────────
jinja = {
    "methods": [
        "small_erp.utils.formatters.currency",
        "small_erp.utils.formatters.short_date",
        "small_erp.utils.formatters.status_badge",
        "small_erp.utils.formatters.role_has",
        "small_erp.utils.formatters.user_can_delete_customer",
        "small_erp.utils.formatters.user_can_cancel_invoice",
    ],
}

# ─── Fixtures for default configuration ─────────────────────────────────
fixtures = [
    {
        "dt": "Role",
        "filters": [["name", "in", ["SMB Manager", "SMB Operator"]]],
    },
]

# ─── Role-based home page redirect ──────────────────────────────────────
role_home_page = {
    "SMB Manager": "/ops",
    "SMB Operator": "/ops",
}

# ─── Home page for the website ──────────────────────────────────────────
home_page = "ops"
