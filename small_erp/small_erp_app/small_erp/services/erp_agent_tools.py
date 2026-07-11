"""ERP tool dispatch for n8n and external agents — no knowledge-base logic."""

from __future__ import annotations

from typing import Any

import frappe


def execute_erp_tool(tool_name: str, args: dict[str, Any]) -> Any:
    """Dispatch whitelisted ERP helpers for n8n tool loop."""
    args = args or {}
    if tool_name == "search_items":
        frappe.has_permission("Item", throw=True)
        return frappe.call(
            "small_erp.api.pos.search_pos_items",
            query=args.get("query", ""),
            limit=args.get("limit", 5),
        )
    if tool_name == "check_stock":
        frappe.has_permission("Item", throw=True)
        return frappe.call(
            "small_erp.api.inventory.get_item_detail",
            item_code=args.get("item_code"),
        )
    if tool_name == "get_recent_orders":
        frappe.has_permission("Sales Invoice", throw=True)
        return frappe.call(
            "small_erp.api.orders.get_invoices",
            page=1,
            page_size=args.get("limit", 5),
        )
    frappe.throw(f"Unsupported ERP tool: {tool_name}")
