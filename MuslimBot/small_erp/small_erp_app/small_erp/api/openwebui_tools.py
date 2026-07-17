"""Open WebUI integration helpers — ERP health checks for external assistants."""

from __future__ import annotations

import frappe


@frappe.whitelist()
def get_item_categories() -> dict:
    """Lightweight ERP health check used by the mobile connection status."""
    frappe.has_permission("Item", "read", throw=True)
    groups = frappe.get_all(
        "Item Group",
        filters={"is_group": 0},
        fields=["name"],
        order_by="name asc",
        limit_page_length=50,
    )
    return {
        "status": "ok",
        "categories": [row.name for row in groups],
        "count": len(groups),
    }
