"""
Inventory API — item management, stock levels, and stock adjustments.
Returns HTML partials for HTMX swap targets.
"""
import frappe
from frappe.utils import flt, cint, nowdate

from small_erp.utils.company import attach_item_stock_detail, get_default_company, resolve_warehouse


@frappe.whitelist()
def get_items(search="", item_group="", page=1, page_size=20):
    """Paginated item list with stock quantities."""
    frappe.has_permission("Item", throw=True)

    page = max(1, cint(page))
    page_size = min(cint(page_size) or 20, 100)
    start = (page - 1) * page_size

    filters = {"disabled": 0, "is_stock_item": 1}
    if search:
        filters["item_name"] = ["like", f"%{search}%"]
    if item_group:
        filters["item_group"] = item_group

    items = frappe.get_all("Item",
        filters=filters,
        fields=[
            "name", "item_name", "item_group", "stock_uom",
            "standard_rate", "image", "description",
        ],
        order_by="item_name asc",
        start=start,
        page_length=page_size,
    )

    total = frappe.db.count("Item", filters)

    attach_item_stock_detail(items, name_field="name")

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": -(-total // page_size),  # ceiling division
    }


@frappe.whitelist()
def get_item_detail(item_code):
    """Full item detail with stock per warehouse."""
    frappe.has_permission("Item", "read", throw=True)

    item = frappe.get_doc("Item", item_code)
    warehouses = frappe.db.sql("""
        SELECT warehouse, actual_qty, reserved_qty, ordered_qty,
               projected_qty, valuation_rate
        FROM `tabBin`
        WHERE item_code = %s AND actual_qty != 0
        ORDER BY warehouse
    """, item_code, as_dict=True)

    return {
        "item": {
            "name": item.name,
            "item_name": item.item_name,
            "item_group": item.item_group,
            "stock_uom": item.stock_uom,
            "standard_rate": item.standard_rate,
            "description": item.description,
            "image": item.image,
            "safety_stock": item.safety_stock or 0,
        },
        "warehouses": warehouses,
    }


@frappe.whitelist()
def create_item(item_name, item_group, stock_uom="Nos", standard_rate=0, description=""):
    """Quick-create a new stock item."""
    frappe.has_permission("Item", "create", throw=True)

    # Generate a unique item_code from item_name
    import re
    base_code = re.sub(r'[^A-Za-z0-9]+', '-', item_name).strip('-').upper()[:30]
    if not base_code:
        base_code = "ITEM"
    item_code = base_code
    suffix = 1
    while frappe.db.exists("Item", item_code):
        item_code = f"{base_code}-{suffix}"
        suffix += 1

    doc = frappe.get_doc({
        "doctype": "Item",
        "item_code": item_code,
        "item_name": item_name,
        "item_group": item_group,
        "stock_uom": stock_uom,
        "is_stock_item": 1,
        "standard_rate": flt(standard_rate),
        "description": description or item_name,
    })
    doc.insert(ignore_permissions=False)
    frappe.db.commit()
    return {"name": doc.name, "item_name": doc.item_name}


@frappe.whitelist()
def update_item(item_code, **kwargs):
    """Update item fields. Only allows safe fields."""
    frappe.has_permission("Item", "write", throw=True)
    allowed = {"item_name", "standard_rate", "description", "safety_stock", "item_group", "disabled"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}

    if not updates:
        frappe.throw("No valid fields to update")

    doc = frappe.get_doc("Item", item_code)
    doc.update(updates)
    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"name": doc.name, "status": "updated"}


@frappe.whitelist()
def create_stock_entry(entry_type, items_json, source_warehouse="", target_warehouse=""):
    """
    Create a Stock Entry for receiving, transferring, or adjusting stock.
    entry_type: Material Receipt | Material Transfer | Material Issue
    items_json: JSON string of [{item_code, qty, rate}]
    """
    import json
    frappe.has_permission("Stock Entry", "create", throw=True)

    items = json.loads(items_json) if isinstance(items_json, str) else items_json

    company = get_default_company()
    if not company:
        frappe.throw("No default Company configured in ERPNext. Please create one.")

    if entry_type == "Material Receipt" and not target_warehouse:
        target_warehouse = resolve_warehouse(company=company)
    elif entry_type == "Material Issue" and not source_warehouse:
        source_warehouse = resolve_warehouse(company=company)
    elif entry_type == "Material Transfer":
        if not source_warehouse:
            source_warehouse = resolve_warehouse(company=company)
        if not target_warehouse:
            target_warehouse = resolve_warehouse(company=company)

    for wh_name in (source_warehouse, target_warehouse):
        if not wh_name:
            continue
        wh_company = frappe.db.get_value("Warehouse", wh_name, "company")
        if wh_company and wh_company != company:
            frappe.throw(f"Warehouse {wh_name} does not belong to company {company}")

    se = frappe.get_doc({
        "doctype": "Stock Entry",
        "stock_entry_type": entry_type,
        "company": company,
        "posting_date": nowdate(),
    })

    for row in items:
        entry = {
            "item_code": row["item_code"],
            "qty": flt(row["qty"]),
        }
        if row.get("rate"):
            entry["basic_rate"] = flt(row["rate"])
        if source_warehouse:
            entry["s_warehouse"] = source_warehouse
        if target_warehouse:
            entry["t_warehouse"] = target_warehouse
        se.append("items", entry)

    se.insert(ignore_permissions=False)
    se.submit()
    frappe.db.commit()

    return {"name": se.name, "status": "submitted"}


@frappe.whitelist()
def get_item_groups():
    """Return all item groups for dropdown filters."""
    groups = frappe.get_all("Item Group",
        filters={"is_group": 0},
        fields=["name", "parent_item_group"],
        order_by="name",
    )
    return groups


@frappe.whitelist()
def get_warehouses():
    """Return all active warehouses."""
    return frappe.get_all("Warehouse",
        filters={"disabled": 0, "is_group": 0},
        fields=["name", "warehouse_name", "parent_warehouse"],
        order_by="name",
    )


@frappe.whitelist()
def get_low_stock_items(limit=20):
    """Items where actual_qty <= safety_stock."""
    frappe.has_permission("Item", throw=True)
    return frappe.db.sql("""
        SELECT i.name as item_code, i.item_name, i.item_group,
               i.safety_stock, COALESCE(SUM(b.actual_qty), 0) as actual_qty,
               i.stock_uom
        FROM `tabItem` i
        LEFT JOIN `tabBin` b ON b.item_code = i.name
        WHERE i.disabled = 0 AND i.is_stock_item = 1
        GROUP BY i.name
        HAVING actual_qty <= COALESCE(i.safety_stock, 5)
        ORDER BY actual_qty ASC
        LIMIT %s
    """, (cint(limit),), as_dict=True)


@frappe.whitelist()
def delete_item(item_code):
    """Disable an item (soft-delete)."""
    frappe.has_permission("Item", "delete", throw=True)
    doc = frappe.get_doc("Item", item_code)
    doc.disabled = 1
    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"name": doc.name, "status": "disabled"}
