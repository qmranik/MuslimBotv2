"""
Small ERP — Frappe App Hooks
Headless API backend layer for ERPNext, serving erp-flutter.
Unified from lite_erp + smb_ops into a single production-ready app.
"""

app_name = "small_erp"
app_title = "Small ERP"
app_publisher = "DOS"
app_description = "Headless API backend layer for ERPNext, serving erp-flutter"
app_email = "qmranik@gmail.com"
app_license = "MIT"
required_apps = ["frappe", "erpnext"]




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


# ─── Fixtures for default configuration ─────────────────────────────────
fixtures = [
    {
        "dt": "Role",
        "filters": [["name", "in", ["SMB Manager", "SMB Operator"]]],
    },
]

