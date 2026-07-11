"""
Orders API — create, list, and manage Sales Orders & Invoices via HTMX.
"""
import frappe
from frappe.utils import nowdate, flt, cint, fmt_money
import json


@frappe.whitelist()
def get_orders(status="", customer="", search="", page=1, page_size=20):
    """Paginated order list (Sales Invoices)."""
    frappe.has_permission("Sales Invoice", throw=True)

    page = max(1, cint(page))
    page_size = min(cint(page_size) or 20, 100)
    start = (page - 1) * page_size

    filters = {"docstatus": ["in", [0, 1]]}
    if status == "paid":
        filters["outstanding_amount"] = 0
        filters["docstatus"] = 1
    elif status == "unpaid":
        filters["outstanding_amount"] = [">", 0]
        filters["docstatus"] = 1
    elif status == "draft":
        filters["docstatus"] = 0
    if customer:
        filters["customer"] = customer
    if search:
        filters["name"] = ["like", f"%{search}%"]

    orders = frappe.get_all("Sales Invoice",
        filters=filters,
        fields=[
            "name", "customer", "customer_name", "posting_date",
            "grand_total", "outstanding_amount", "status", "docstatus",
            "currency",
        ],
        order_by="posting_date desc, creation desc",
        start=start,
        page_length=page_size,
    )

    total = frappe.db.count("Sales Invoice", filters)

    return {
        "orders": orders,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": -(-total // page_size),
    }


@frappe.whitelist()
def get_order_detail(invoice_name):
    """Full invoice detail with line items."""
    frappe.has_permission("Sales Invoice", "read", throw=True)
    doc = frappe.get_doc("Sales Invoice", invoice_name)

    items = []
    for row in doc.items:
        items.append({
            "item_code": row.item_code,
            "item_name": row.item_name,
            "qty": row.qty,
            "rate": row.rate,
            "amount": row.amount,
            "uom": row.uom,
        })

    return {
        "invoice": {
            "name": doc.name,
            "customer": doc.customer,
            "customer_name": doc.customer_name,
            "posting_date": doc.posting_date,
            "due_date": doc.due_date,
            "grand_total": doc.grand_total,
            "outstanding_amount": doc.outstanding_amount,
            "status": doc.status,
            "docstatus": doc.docstatus,
            "currency": doc.currency,
            "paid_amount": doc.grand_total - doc.outstanding_amount,
        },
        "items": items,
    }


@frappe.whitelist()
def create_sales_invoice(customer, items_json, posting_date=None, due_date=None):
    """Quick-create a Sales Invoice from the HTMX frontend."""
    frappe.has_permission("Sales Invoice", "create", throw=True)

    items = json.loads(items_json) if isinstance(items_json, str) else items_json
    posting_date = posting_date or nowdate()

    company = frappe.defaults.get_user_default("company") or frappe.db.get_single_value("Global Defaults", "default_company")
    if not company:
        comps = frappe.get_all("Company", limit=1)
        if comps:
            company = comps[0].name

    sinv = frappe.get_doc({
        "doctype": "Sales Invoice",
        "company": company,
        "customer": customer,
        "posting_date": posting_date,
        "due_date": due_date or posting_date,
        "update_stock": 1,
    })

    default_warehouse = frappe.db.get_value("Stock Settings", None, "default_warehouse")
    if not default_warehouse and company:
        whs = frappe.get_all("Warehouse", filters={"is_group": 0, "company": company}, order_by="name asc")
        for w in whs:
            if any(x in w.name.lower() for x in ["store", "finish"]) and "transit" not in w.name.lower():
                default_warehouse = w.name
                break
        if not default_warehouse and whs:
            default_warehouse = whs[0].name

    for row in items:
        item_code = row["item_code"]
        stock_wh = frappe.db.get_value("Bin", {"item_code": item_code, "actual_qty": (">", 0)}, "warehouse")
        sinv.append("items", {
            "item_code": item_code,
            "qty": flt(row.get("qty", 1)),
            "rate": flt(row.get("rate", 0)),
            "warehouse": stock_wh or default_warehouse,
        })

    sinv.insert(ignore_permissions=False)
    sinv.submit()
    frappe.db.commit()

    return {"name": sinv.name, "grand_total": sinv.grand_total, "status": "submitted"}


@frappe.whitelist()
def record_payment(invoice_name, amount, mode_of_payment="Cash"):
    """Record a payment against an outstanding Sales Invoice."""
    frappe.has_permission("Payment Entry", "create", throw=True)

    sinv = frappe.get_doc("Sales Invoice", invoice_name)
    if sinv.docstatus != 1:
        frappe.throw("Invoice must be submitted before recording payment")
    if sinv.outstanding_amount <= 0:
        frappe.throw("Invoice is already fully paid")

    amount = min(flt(amount), sinv.outstanding_amount)

    company = sinv.company
    currency = sinv.currency or frappe.defaults.get_global_default("currency") or "USD"

    # Resolve paid_to (receivable account from invoice) and paid_from (cash/bank account)
    paid_to = sinv.debit_to  # Customer's receivable account
    paid_from = None

    # Find the default account for this mode of payment
    mop_doc = frappe.db.get_value("Mode of Payment Account",
        {"parent": mode_of_payment, "company": company}, "default_account")
    if mop_doc:
        paid_from = mop_doc
    else:
        # Fallback: find any Cash or Bank account
        paid_from = frappe.db.get_value("Account", {
            "company": company,
            "account_type": ["in", ["Cash", "Bank"]],
            "is_group": 0,
        }, "name")

    if not paid_from:
        frappe.throw(f"No Cash or Bank account found for company {company}. Please set up a Mode of Payment account.")

    pe = frappe.get_doc({
        "doctype": "Payment Entry",
        "payment_type": "Receive",
        "party_type": "Customer",
        "party": sinv.customer,
        "company": company,
        "paid_amount": amount,
        "received_amount": amount,
        "target_exchange_rate": 1,
        "paid_from": paid_to,     # Customer receivable (source of money owed)
        "paid_to": paid_from,     # Cash/Bank account (destination of payment)
        "paid_from_account_currency": currency,
        "paid_to_account_currency": currency,
        "mode_of_payment": mode_of_payment,
        "reference_date": nowdate(),
        "posting_date": nowdate(),
    })
    pe.append("references", {
        "reference_doctype": "Sales Invoice",
        "reference_name": invoice_name,
        "allocated_amount": amount,
    })
    pe.insert(ignore_permissions=False)
    pe.submit()
    frappe.db.commit()

    return {"payment": pe.name, "amount": amount, "status": "submitted"}


@frappe.whitelist()
def create_sales_order(customer, items_json, delivery_date=None):
    """Create a Sales Order (for pre-orders / quotes)."""
    frappe.has_permission("Sales Order", "create", throw=True)

    items = json.loads(items_json) if isinstance(items_json, str) else items_json

    so = frappe.get_doc({
        "doctype": "Sales Order",
        "customer": customer,
        "transaction_date": nowdate(),
        "delivery_date": delivery_date or nowdate(),
    })

    for row in items:
        so.append("items", {
            "item_code": row["item_code"],
            "qty": flt(row.get("qty", 1)),
            "rate": flt(row.get("rate", 0)),
            "delivery_date": delivery_date or nowdate(),
        })

    so.insert(ignore_permissions=False)
    so.submit()
    frappe.db.commit()

    return {"name": so.name, "grand_total": so.grand_total}


@frappe.whitelist()
def cancel_invoice(invoice_name):
    """Cancel a submitted Sales Invoice."""
    frappe.has_permission("Sales Invoice", "cancel", throw=True)
    doc = frappe.get_doc("Sales Invoice", invoice_name)
    if doc.docstatus != 1:
        frappe.throw("Only submitted invoices can be cancelled")
    doc.cancel()
    frappe.db.commit()
    return {"name": doc.name, "status": "cancelled"}
