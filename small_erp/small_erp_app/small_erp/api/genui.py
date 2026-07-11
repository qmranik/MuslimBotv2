"""
GenUI API — aggregated ERP snapshot for the generative-ui agent.
Business logic stays in domain modules; this module composes their outputs.
"""
import frappe
from frappe.utils import cint, flt

from small_erp.api import accounting, customers, dashboard, inventory, orders
from small_erp.utils.company import get_default_company, resolve_warehouse


def _map_invoice(inv):
    outstanding = flt(inv.get("outstanding_amount") or 0, 2)
    docstatus = inv.get("docstatus", 0)
    status = inv.get("status") or ""
    if docstatus == 0:
        mapped_status = "Draft"
    elif outstanding > 0:
        mapped_status = "Overdue" if status == "Overdue" else "Pending"
    else:
        mapped_status = "Paid"

    return {
        "id": inv.get("name"),
        "invoiceNumber": inv.get("name"),
        "customerName": inv.get("customer_name") or inv.get("customer"),
        "amount": flt(inv.get("grand_total") or 0, 2),
        "status": mapped_status,
        "date": inv.get("posting_date"),
        "outstanding": outstanding,
        "currency": inv.get("currency") or "BDT",
    }


def _map_customer(c):
    return {
        "id": c.get("name"),
        "name": c.get("customer_name") or c.get("name"),
        "email": c.get("email_id") or "",
        "company": c.get("customer_name") or c.get("name"),
        "totalRevenue": flt(c.get("total_spent") or 0, 2),
        "outstanding": flt(c.get("outstanding") or 0, 2),
        "totalOrders": c.get("total_orders") or 0,
        "country": c.get("territory") or "",
        "group": c.get("customer_group") or "",
        "phone": c.get("mobile_no") or "",
        "status": "Active",
    }


def _map_product(item):
    return {
        "id": item.get("name"),
        "name": item.get("item_name"),
        "category": item.get("item_group") or "",
        "price": flt(item.get("standard_rate") or 0, 2),
        "stock": flt(item.get("stock_qty") or 0, 2),
        "available": flt(item.get("available_qty") or 0, 2),
        "reserved": flt(item.get("reserved_qty") or 0, 2),
        "uom": item.get("stock_uom") or "Nos",
    }


@frappe.whitelist()
def get_default_warehouse():
    """Return the company-scoped default warehouse for stock actions."""
    frappe.has_permission("Stock Entry", throw=True)
    company = get_default_company()
    warehouse = resolve_warehouse(company=company)
    return {"warehouse": warehouse, "company": company}


@frappe.whitelist()
def get_erp_snapshot(page_size=100):
    """
    Single aggregated snapshot for the generative-ui NLP router.
    Shape matches generative-ui/src/services/erpClient.js fetchERPContext().
    """
    frappe.has_permission("Sales Invoice", throw=True)
    page_size = min(cint(page_size) or 100, 200)

    kpis = dashboard.get_dashboard_kpis()
    orders_result = orders.get_orders(page_size=page_size)
    customers_result = customers.get_customers(page_size=page_size)
    items_result = inventory.get_items(page_size=page_size)
    pnl = accounting.get_profit_and_loss("this_year")
    receivables_result = accounting.get_receivables()
    revenue_chart = dashboard.get_revenue_chart_data("monthly")
    monthly_performance = dashboard.get_monthly_performance(12)
    warehouse_info = get_default_warehouse()

    order_rows = orders_result.get("orders") or []
    customer_rows = customers_result.get("customers") or []
    item_rows = items_result.get("items") or []

    return {
        "invoices": [_map_invoice(inv) for inv in order_rows],
        "customers": [_map_customer(c) for c in customer_rows],
        "products": [_map_product(item) for item in item_rows],
        "monthlyPerformance": monthly_performance,
        "revenueChart": revenue_chart,
        "defaultWarehouse": warehouse_info.get("warehouse"),
        "company": warehouse_info.get("company"),
        "kpis": kpis or {},
        "profitAndLoss": pnl or {},
        "receivables": receivables_result.get("receivables") or [],
        "_meta": {
            "source": "live-erp",
            "fetchedAt": frappe.utils.now(),
            "invoiceCount": orders_result.get("total") or len(order_rows),
            "customerCount": customers_result.get("total") or len(customer_rows),
            "itemCount": items_result.get("total") or len(item_rows),
        },
    }


@frappe.whitelist()
def get_portal_url(app):
    frappe.only_for(("System Manager", "Administrator"))
    app_key = (app or "").strip().lower()
    site_url = frappe.utils.get_url()

    portal_map = {
        "erp-ops": f"{site_url}/ops",
        "n8n": frappe.conf.get("n8n_url") or frappe.local.conf.get("n8n_url") or "http://localhost:5678",
        "chatwoot": frappe.conf.get("chatwoot_frontend_url")
        or frappe.local.conf.get("chatwoot_frontend_url")
        or "http://localhost:3000",
        "postiz": frappe.conf.get("postiz_public_url")
        or frappe.local.conf.get("postiz_public_url")
        or "http://localhost:4007",
    }

    url = portal_map.get(app_key, "")
    if not url:
        frappe.throw(f"Unknown portal app: {app}")

    return {"url": url, "app": app_key}
