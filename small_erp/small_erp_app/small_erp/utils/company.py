"""Company and warehouse helpers for single-tenant SMB operations."""
import frappe


def get_default_company():
    """Return the active company for the current site."""
    company = (
        frappe.defaults.get_user_default("company")
        or frappe.db.get_single_value("Global Defaults", "default_company")
    )
    if not company:
        companies = frappe.get_all("Company", limit=1, order_by="creation asc")
        if companies:
            company = companies[0].name
    return company


def resolve_warehouse(company=None, prefer_stock_for_item=None):
    """
    Pick a warehouse belonging to `company`, excluding in-transit warehouses.
    If prefer_stock_for_item is set, prefer a warehouse that holds stock for that item.
    """
    company = company or get_default_company()
    if not company:
        frappe.throw("No default Company configured in ERPNext. Please create one.")

    if prefer_stock_for_item:
        stock_wh = frappe.db.sql(
            """
            SELECT b.warehouse
            FROM `tabBin` b
            INNER JOIN `tabWarehouse` w ON w.name = b.warehouse
            WHERE b.item_code = %s
              AND b.actual_qty > 0
              AND w.company = %s
              AND w.disabled = 0
              AND w.is_group = 0
              AND LOWER(w.name) NOT LIKE %s
            ORDER BY b.actual_qty DESC
            LIMIT 1
            """,
            (prefer_stock_for_item, company, "%transit%"),
            as_dict=True,
        )
        if stock_wh:
            return stock_wh[0].warehouse

    default_wh = frappe.db.get_value("Stock Settings", None, "default_warehouse")
    if default_wh:
        wh_company = frappe.db.get_value("Warehouse", default_wh, "company")
        if wh_company == company and "transit" not in default_wh.lower():
            return default_wh

    warehouses = frappe.get_all(
        "Warehouse",
        filters={"is_group": 0, "disabled": 0, "company": company},
        fields=["name"],
        order_by="name asc",
    )
    for wh in warehouses:
        name = wh.name.lower()
        if "transit" in name:
            continue
        if any(token in name for token in ("store", "finish", "good")):
            return wh.name

    for wh in warehouses:
        if "transit" not in wh.name.lower():
            return wh.name

    frappe.throw(f"No usable warehouse found for company {company}")


def attach_item_stock_qty(items, item_code_field="item_code", qty_field="available_qty"):
    """Batch-fetch available stock for a list of item dicts (avoids N+1)."""
    if not items:
        return items

    codes = [row[item_code_field] for row in items if row.get(item_code_field)]
    if not codes:
        for row in items:
            row[qty_field] = 0
        return items

    placeholders = ", ".join(["%s"] * len(codes))
    stock_rows = frappe.db.sql(
        f"""
        SELECT item_code,
               COALESCE(SUM(actual_qty - reserved_qty), 0) AS available
        FROM `tabBin`
        WHERE item_code IN ({placeholders})
        GROUP BY item_code
        """,
        tuple(codes),
        as_dict=True,
    )
    stock_map = {row.item_code: row.available for row in stock_rows}
    for row in items:
        code = row.get(item_code_field)
        row[qty_field] = frappe.utils.flt(stock_map.get(code, 0), 2)
    return items


def attach_item_stock_detail(items, name_field="name"):
    """Attach stock_qty, reserved_qty, available_qty for inventory list rows."""
    if not items:
        return items

    codes = [row[name_field] for row in items if row.get(name_field)]
    if not codes:
        return items

    placeholders = ", ".join(["%s"] * len(codes))
    stock_rows = frappe.db.sql(
        f"""
        SELECT item_code,
               COALESCE(SUM(actual_qty), 0) AS qty,
               COALESCE(SUM(reserved_qty), 0) AS reserved
        FROM `tabBin`
        WHERE item_code IN ({placeholders})
        GROUP BY item_code
        """,
        tuple(codes),
        as_dict=True,
    )
    stock_map = {row.item_code: row for row in stock_rows}
    for row in items:
        code = row.get(name_field)
        stock = stock_map.get(code)
        qty = frappe.utils.flt(stock.qty if stock else 0, 2)
        reserved = frappe.utils.flt(stock.reserved if stock else 0, 2)
        row["stock_qty"] = qty
        row["reserved_qty"] = reserved
        row["available_qty"] = frappe.utils.flt(qty - reserved, 2)
    return items
