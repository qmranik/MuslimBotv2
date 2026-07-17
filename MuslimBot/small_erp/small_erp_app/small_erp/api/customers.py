"""
Customers API — manage customer records and view purchase history.
"""
import frappe
from frappe.utils import flt, cint, fmt_money


def _attach_customer_stats(customers):
    """Batch-fetch invoice stats for customer rows (avoids N+1)."""
    if not customers:
        return customers

    names = [c.name for c in customers]
    placeholders = ", ".join(["%s"] * len(names))
    stats_rows = frappe.db.sql(
        f"""
        SELECT customer,
               COUNT(*) AS orders,
               COALESCE(SUM(grand_total), 0) AS total_spent,
               COALESCE(SUM(outstanding_amount), 0) AS outstanding
        FROM `tabSales Invoice`
        WHERE docstatus = 1
          AND customer IN ({placeholders})
        GROUP BY customer
        """,
        tuple(names),
        as_dict=True,
    )
    stats_map = {row.customer: row for row in stats_rows}
    for c in customers:
        stats = stats_map.get(c.name)
        c["total_orders"] = stats.orders if stats else 0
        c["total_spent"] = flt(stats.total_spent if stats else 0, 2)
        c["outstanding"] = flt(stats.outstanding if stats else 0, 2)
    return customers


@frappe.whitelist()
def get_customers(search="", page=1, page_size=20):
    """Paginated customer list with aggregated stats."""
    frappe.has_permission("Customer", throw=True)

    page = max(1, cint(page))
    start = (page - 1) * cint(page_size)

    filters = {"disabled": 0}
    or_filters = {}
    if search:
        or_filters = {
            "customer_name": ["like", f"%{search}%"],
            "name": ["like", f"%{search}%"],
            "mobile_no": ["like", f"%{search}%"],
        }

    customers = frappe.get_all("Customer",
        filters=filters,
        or_filters=or_filters if search else None,
        fields=[
            "name", "customer_name", "customer_group",
            "territory", "mobile_no", "email_id",
        ],
        order_by="customer_name asc",
        start=start,
        page_length=cint(page_size),
    )

    _attach_customer_stats(customers)

    # Count with same filters (including search or_filters)
    if search:
        total = frappe.db.sql("""
            SELECT COUNT(*) as cnt FROM `tabCustomer`
            WHERE disabled = 0
            AND (customer_name LIKE %(s)s OR name LIKE %(s)s OR mobile_no LIKE %(s)s)
        """, {"s": f"%{search}%"}, as_dict=True)[0].cnt
    else:
        total = frappe.db.count("Customer", filters)

    return {
        "customers": customers,
        "total": total,
        "page": page,
        "total_pages": -(-total // cint(page_size)),
    }


@frappe.whitelist()
def get_customer_detail(customer_name):
    """Full customer profile with recent transactions."""
    frappe.has_permission("Customer", "read", throw=True)

    doc = frappe.get_doc("Customer", customer_name)

    recent_invoices = frappe.get_all("Sales Invoice",
        filters={"customer": customer_name, "docstatus": 1},
        fields=["name", "posting_date", "grand_total", "outstanding_amount", "status"],
        order_by="posting_date desc",
        limit_page_length=10,
    )

    return {
        "customer": {
            "name": doc.name,
            "customer_name": doc.customer_name,
            "customer_group": doc.customer_group,
            "territory": doc.territory,
            "mobile_no": doc.mobile_no,
            "email_id": doc.email_id,
        },
        "recent_invoices": recent_invoices,
    }


@frappe.whitelist()
def get_customer_groups():
    """Return all non-group customer groups."""
    frappe.has_permission("Customer Group", "read", throw=True)
    return frappe.get_all("Customer Group", filters={"is_group": 0}, fields=["name"])


@frappe.whitelist()
def create_customer(customer_name, customer_group="",
                    mobile_no="", email_id="", territory=""):
    """Quick-create a customer."""
    frappe.has_permission("Customer", "create", throw=True)

    # Find a valid non-group customer group if not provided or invalid
    cg = customer_group
    if cg:
        exists = frappe.db.exists("Customer Group", cg)
        if not exists:
            cg = ""
        else:
            is_group = frappe.db.get_value("Customer Group", cg, "is_group") or 0
            if is_group:
                cg = ""
    if not cg:
        cg_list = frappe.get_all("Customer Group", filters={"is_group": 0}, order_by="name", limit=1)
        if cg_list:
            cg = cg_list[0].name
        else:
            frappe.throw("No valid Customer Group found. Please create one first.")

    doc = frappe.get_doc({
        "doctype": "Customer",
        "customer_name": customer_name,
        "customer_group": cg,
        "territory": territory or frappe.defaults.get_global_default("territory") or "All Territories",
        "mobile_no": mobile_no,
        "email_id": email_id,
        "customer_type": "Individual",
    })
    doc.insert(ignore_permissions=False)
    frappe.db.commit()
    return {"name": doc.name, "customer_name": doc.customer_name}


@frappe.whitelist()
def update_customer(customer, **kwargs):
    """Update customer details."""
    frappe.has_permission("Customer", "write", throw=True)
    allowed = {"customer_name", "mobile_no", "email_id", "customer_group", "territory"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}

    doc = frappe.get_doc("Customer", customer)
    doc.update(updates)
    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"name": doc.name, "status": "updated"}


@frappe.whitelist()
def delete_customer(customer):
    """Delete/disable a customer."""
    frappe.has_permission("Customer", "delete", throw=True)
    doc = frappe.get_doc("Customer", customer)
    doc.disabled = 1
    doc.save(ignore_permissions=False)
    frappe.db.commit()
    return {"name": doc.name, "status": "disabled"}


@frappe.whitelist()
def search_customers(query):
    """Typeahead search for customer picker."""
    frappe.has_permission("Customer", throw=True)
    return frappe.get_all("Customer",
        filters={"disabled": 0},
        or_filters={
            "customer_name": ["like", f"%{query}%"],
            "name": ["like", f"%{query}%"],
            "mobile_no": ["like", f"%{query}%"],
        },
        fields=["name", "customer_name", "mobile_no"],
        limit_page_length=10,
    )
