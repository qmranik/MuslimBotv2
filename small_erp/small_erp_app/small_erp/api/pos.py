"""
POS API — quick sale workflow: search item → add to cart → checkout.
Designed for zero-friction retail operations.
"""
import frappe
from frappe.utils import nowdate, flt, cint
import json

from small_erp.utils.company import (
    attach_item_stock_qty,
    get_default_company,
    resolve_warehouse,
)


def _ensure_pos_profile(company):
    """Create a default POS Profile if none exists for the company."""
    existing = frappe.get_all("POS Profile", filters={"company": company, "disabled": 0}, limit=1)
    if existing:
        return existing[0].name

    warehouse = resolve_warehouse(company=company)

    income_account = frappe.db.get_value("Company", company, "default_income_account")
    expense_account = frappe.db.get_value("Company", company, "default_expense_account")
    write_off_account = frappe.db.get_value("Company", company, "write_off_account")
    if not write_off_account:
        write_off_account = expense_account

    cost_center = frappe.db.get_value("Company", company, "cost_center")

    profile = frappe.get_doc({
        "doctype": "POS Profile",
        "name": f"POS - {company}",
        "company": company,
        "warehouse": warehouse,
        "write_off_account": write_off_account,
        "write_off_cost_center": cost_center,
        "payments": [{"mode_of_payment": "Cash", "default": 1}],
    })
    profile.insert(ignore_permissions=True)
    frappe.db.commit()
    return profile.name


@frappe.whitelist()
def search_pos_items(query="", item_group="", limit=20):
    """Fast item search for POS — searches name, barcode, item_code."""
    try:
        frappe.has_permission("Item", throw=True)

        filters = {"disabled": 0, "is_stock_item": 1, "has_variants": 0}
        if item_group:
            filters["item_group"] = item_group

        or_filters = {}
        if query:
            or_filters = {
                "item_name": ["like", f"%{query}%"],
                "name": ["like", f"%{query}%"],
                "description": ["like", f"%{query}%"],
            }

        items = frappe.get_all("Item",
            filters=filters,
            or_filters=or_filters if query else None,
            fields=[
                "name as item_code", "item_name", "item_group",
                "standard_rate", "stock_uom", "image",
            ],
            order_by="item_name asc",
            limit_page_length=cint(limit),
        )

        attach_item_stock_qty(items, item_code_field="item_code", qty_field="available_qty")
        return items
    except Exception as e:
        frappe.log_error(f"POS SEARCH API FAILED: {e}")
        raise e


@frappe.whitelist()
def pos_checkout(customer, items_json, mode_of_payment="Cash",
                 discount_percentage=0, remarks=""):
    """
    Complete POS transaction: creates Sales Invoice + Payment Entry in one call.
    items_json: [{item_code, qty, rate}]
    """
    frappe.has_permission("Sales Invoice", "create", throw=True)

    # Ensure customer exists, fallback to first customer if not found or not provided
    actual_customer = frappe.db.get_value("Customer", customer, "name")
    if not actual_customer:
        fallback = frappe.get_all("Customer", limit=1, order_by="creation desc")
        if fallback:
            actual_customer = fallback[0].name
        else:
            frappe.throw("No Customer records found in system. Cannot perform checkout.")
    
    customer = actual_customer

    items = json.loads(items_json) if isinstance(items_json, str) else items_json

    if not items:
        frappe.throw("Cart is empty")

    company = get_default_company()
    if not company:
        frappe.throw("No default Company configured in ERPNext. Please create one.")

    pos_profile = _ensure_pos_profile(company)

    sinv = frappe.get_doc({
        "doctype": "Sales Invoice",
        "company": company,
        "customer": customer,
        "posting_date": nowdate(),
        "due_date": nowdate(),
        "update_stock": 1,
        "is_pos": 1,
        "pos_profile": pos_profile,
        "remarks": remarks,
    })

    if flt(discount_percentage) > 0:
        sinv.additional_discount_percentage = flt(discount_percentage)
        sinv.discount_amount = 0

    for row in items:
        item_code = row["item_code"]
        final_wh = resolve_warehouse(company=company, prefer_stock_for_item=item_code)
        
        sinv.append("items", {
            "item_code": item_code,
            "qty": flt(row.get("qty", 1)),
            "rate": flt(row.get("rate", 0)),
            "warehouse": final_wh,
        })

    sinv.insert(ignore_permissions=False)

    # Calculate grand total before adding payment (insert triggers validation/calc)
    grand_total = sinv.grand_total or sinv.rounded_total or 0

    # Resolve the payment account for this mode of payment
    payment_account = frappe.db.get_value(
        "Mode of Payment Account",
        {"parent": mode_of_payment, "company": company},
        "default_account"
    )
    if not payment_account:
        # Fallback: find any Cash or Bank account for the company
        payment_account = frappe.db.get_value(
            "Account",
            {"company": company, "account_type": ["in", ["Cash", "Bank"]], "is_group": 0},
            "name"
        )
    if not payment_account:
        frappe.throw(f"No Cash or Bank account found for company {company}")

    # Add payment with the actual amount (required for POS to mark as paid)
    sinv.append("payments", {
        "mode_of_payment": mode_of_payment,
        "amount": flt(grand_total),
        "account": payment_account,
    })

    sinv.submit()
    frappe.db.commit()

    return {
        "invoice": sinv.name,
        "grand_total": sinv.grand_total,
        "status": "paid",
        "customer": sinv.customer_name,
    }


@frappe.whitelist()
def get_pos_summary(date=None):
    """Today's POS summary — total sales, transaction count, top items."""
    frappe.has_permission("Sales Invoice", throw=True)
    date = date or nowdate()

    summary = frappe.db.sql("""
        SELECT COUNT(*) as transactions,
               COALESCE(SUM(grand_total), 0) as total_sales,
               COALESCE(AVG(grand_total), 0) as avg_order
        FROM `tabSales Invoice`
        WHERE posting_date = %s AND docstatus = 1 AND is_pos = 1
    """, date, as_dict=True)[0]

    top_items = frappe.db.sql("""
        SELECT sii.item_code, sii.item_name,
               SUM(sii.qty) as total_qty,
               SUM(sii.amount) as total_amount
        FROM `tabSales Invoice Item` sii
        JOIN `tabSales Invoice` si ON si.name = sii.parent
        WHERE si.posting_date = %s AND si.docstatus = 1 AND si.is_pos = 1
        GROUP BY sii.item_code
        ORDER BY total_qty DESC
        LIMIT 10
    """, date, as_dict=True)

    return {
        "date": date,
        "transactions": summary.transactions,
        "total_sales": flt(summary.total_sales, 2),
        "avg_order": flt(summary.avg_order, 2),
        "top_items": top_items,
    }


@frappe.whitelist()
def get_payment_modes():
    """Available payment modes for POS."""
    return frappe.get_all("Mode of Payment",
        filters={"enabled": 1},
        fields=["name", "type"],
        order_by="name",
    )
