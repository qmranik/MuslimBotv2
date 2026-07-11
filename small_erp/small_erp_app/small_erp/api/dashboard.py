"""
Dashboard API — serves KPI cards and summary data to the HTMX frontend.
All functions are @frappe.whitelist() so HTMX can call them via POST.
"""
from datetime import datetime

import frappe
from frappe.utils import add_months, nowdate, add_days, getdate, flt


@frappe.whitelist()
def get_dashboard_kpis():
    """Return the 6 core KPI metrics for the dashboard header cards."""
    frappe.has_permission("Sales Invoice", throw=True)
    today = nowdate()
    month_start = getdate(today).replace(day=1).isoformat()

    # Revenue this month
    revenue = frappe.db.sql("""
        SELECT COALESCE(SUM(grand_total), 0) as total
        FROM `tabSales Invoice`
        WHERE posting_date >= %s AND posting_date <= %s
        AND docstatus = 1
    """, (month_start, today), as_dict=True)[0].total

    # Orders this month
    order_count = frappe.db.count(
        "Sales Invoice",
        filters=[
            ["posting_date", ">=", month_start],
            ["posting_date", "<=", today],
            ["docstatus", "=", 1],
        ],
    )

    # Pending orders (Draft Sales Orders)
    pending_orders = frappe.db.count("Sales Order", {
        "docstatus": 0,
        "status": ["not in", ["Cancelled", "Closed"]],
    })

    # Low stock items (qty < reorder_level)
    low_stock = frappe.db.sql("""
        SELECT COUNT(DISTINCT b.item_code) as cnt
        FROM `tabBin` b
        JOIN `tabItem` i ON i.name = b.item_code
        WHERE b.actual_qty <= COALESCE(i.safety_stock, 5)
        AND i.disabled = 0
        AND i.is_stock_item = 1
    """, as_dict=True)[0].cnt

    # Accounts receivable (unpaid Sales Invoices)
    receivable = frappe.db.sql("""
        SELECT COALESCE(SUM(outstanding_amount), 0) as total
        FROM `tabSales Invoice`
        WHERE docstatus = 1 AND outstanding_amount > 0
    """, as_dict=True)[0].total

    # Active customers (ordered in last 90 days)
    active_customers = frappe.db.sql("""
        SELECT COUNT(DISTINCT customer) as cnt
        FROM `tabSales Invoice`
        WHERE posting_date >= %s AND docstatus = 1
    """, (add_days(today, -90),), as_dict=True)[0].cnt

    currency = frappe.defaults.get_global_default("currency") or "BDT"

    return {
        "revenue": flt(revenue, 2),
        "orders": order_count,
        "pending": pending_orders,
        "low_stock": low_stock,
        "receivable": flt(receivable, 2),
        "customers": active_customers,
        "currency": currency,
    }


@frappe.whitelist()
def get_recent_activity(limit=10):
    """Return recent business activity feed for the dashboard."""
    frappe.has_permission("Sales Invoice", throw=True)
    limit = min(int(limit), 50)

    activities = []

    # Recent invoices
    invoices = frappe.get_all("Sales Invoice",
        filters={"docstatus": 1},
        fields=["name", "customer_name", "grand_total", "posting_date", "creation"],
        order_by="creation desc",
        limit_page_length=limit,
    )
    for inv in invoices:
        activities.append({
            "type": "invoice",
            "id": inv.name,
            "customer_name": inv.customer_name,
            "amount": flt(inv.grand_total, 2),
            "time": inv.creation,
        })

    # Recent stock entries
    stock_entries = frappe.get_all("Stock Entry",
        filters={"docstatus": 1},
        fields=["name", "stock_entry_type", "creation"],
        order_by="creation desc",
        limit_page_length=limit,
    )
    for se in stock_entries:
        activities.append({
            "type": "stock",
            "id": se.name,
            "stock_entry_type": se.stock_entry_type,
            "time": se.creation,
        })

    # Sort by time descending, take top N
    activities.sort(key=lambda x: x["time"], reverse=True)
    return activities[:limit]


@frappe.whitelist()
def get_revenue_chart_data(period="monthly"):
    """Revenue trend data for the dashboard sparkline/chart."""
    frappe.has_permission("Sales Invoice", throw=True)
    today = nowdate()

    if period == "weekly":
        intervals = 12
        sql = """
            SELECT YEARWEEK(posting_date, 1) as period_key,
                   MIN(posting_date) as period_start,
                   SUM(grand_total) as total
            FROM `tabSales Invoice`
            WHERE posting_date >= %s AND docstatus = 1
            GROUP BY YEARWEEK(posting_date, 1)
            ORDER BY period_key
        """
        start = add_days(today, -(intervals * 7))
    else:
        sql = """
            SELECT DATE_FORMAT(posting_date, '%%Y-%%m') as period_key,
                   MIN(posting_date) as period_start,
                   SUM(grand_total) as total
            FROM `tabSales Invoice`
            WHERE posting_date >= %s AND docstatus = 1
            GROUP BY DATE_FORMAT(posting_date, '%%Y-%%m')
            ORDER BY period_key
        """
        start = add_days(today, -365)

    rows = frappe.db.sql(sql, (start,), as_dict=True)
    return {
        "labels": [r.period_key for r in rows],
        "values": [flt(r.total, 2) for r in rows],
    }


@frappe.whitelist()
def get_monthly_performance(months=12):
    """Monthly revenue vs expenses for trend charts (12 months, zero-filled)."""
    frappe.has_permission("Sales Invoice", throw=True)
    months = min(max(int(months), 1), 24)
    today = getdate(nowdate())
    company = frappe.defaults.get_global_default("company")

    month_keys = []
    for i in range(months - 1, -1, -1):
        dt = add_months(today.replace(day=1), -i)
        month_keys.append(dt.strftime("%Y-%m"))

    start = f"{month_keys[0]}-01"

    revenue_rows = frappe.db.sql(
        """
        SELECT DATE_FORMAT(posting_date, '%%Y-%%m') AS month_key,
               COALESCE(SUM(grand_total), 0) AS revenue
        FROM `tabSales Invoice`
        WHERE posting_date >= %s AND docstatus = 1
        GROUP BY DATE_FORMAT(posting_date, '%%Y-%%m')
        """,
        (start,),
        as_dict=True,
    )
    revenue_map = {r.month_key: flt(r.revenue, 2) for r in revenue_rows}

    expense_map = {}
    if company:
        expense_rows = frappe.db.sql(
            """
            SELECT DATE_FORMAT(posting_date, '%%Y-%%m') AS month_key,
                   COALESCE(SUM(debit - credit), 0) AS expenses
            FROM `tabGL Entry`
            WHERE posting_date >= %s AND company = %s AND is_cancelled = 0
            AND account IN (
                SELECT name FROM `tabAccount`
                WHERE root_type = 'Expense' AND company = %s
                AND account_name NOT IN (
                    'Stock Adjustment', 'Expenses Included In Valuation',
                    'Expenses Included In Asset Valuation'
                )
            )
            GROUP BY DATE_FORMAT(posting_date, '%%Y-%%m')
            """,
            (start, company, company),
            as_dict=True,
        )
        expense_map = {r.month_key: flt(r.expenses, 2) for r in expense_rows}

    result = []
    for key in month_keys:
        y, m = map(int, key.split("-"))
        label = datetime(y, m, 1).strftime("%b %Y")
        revenue = revenue_map.get(key, 0)
        expenses = expense_map.get(key, 0)
        result.append({
            "month": label,
            "month_key": key,
            "revenue": revenue,
            "expenses": expenses,
            "profit": flt(revenue - expenses, 2),
        })

    return result
