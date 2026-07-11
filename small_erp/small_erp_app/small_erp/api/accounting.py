"""
Accounting API — simplified financial views for SMB operators.
Wraps ERPNext's accounting engine into digestible HTMX endpoints.
"""
import frappe
from frappe.utils import nowdate, getdate, add_months, flt, fmt_money, cint


@frappe.whitelist()
def get_profit_and_loss(period="this_month"):
    """Simplified P&L: total income, total expenses, net profit."""
    frappe.has_permission("GL Entry", throw=True)

    today = getdate(nowdate())
    if period == "this_month":
        start = today.replace(day=1).isoformat()
        end = nowdate()
    elif period == "last_month":
        last = add_months(today, -1)
        start = last.replace(day=1).isoformat()
        import calendar
        _, last_day = calendar.monthrange(last.year, last.month)
        end = last.replace(day=last_day).isoformat()
    elif period == "this_year":
        fiscal = frappe.defaults.get_global_default("fiscal_year")
        if fiscal:
            fy = frappe.get_doc("Fiscal Year", fiscal)
            start = fy.year_start_date
            end = nowdate()
        else:
            start = today.replace(month=1, day=1).isoformat()
            end = nowdate()
    else:
        start = today.replace(day=1).isoformat()
        end = nowdate()

    company = frappe.defaults.get_global_default("company")
    currency = frappe.defaults.get_global_default("currency") or "BDT"

    income = frappe.db.sql("""
        SELECT COALESCE(SUM(credit - debit), 0) as total
        FROM `tabGL Entry`
        WHERE posting_date BETWEEN %s AND %s
        AND company = %s AND is_cancelled = 0
        AND account IN (
            SELECT name FROM `tabAccount`
            WHERE root_type = 'Income' AND company = %s
        )
    """, (start, end, company, company), as_dict=True)[0].total

    expenses = frappe.db.sql("""
        SELECT COALESCE(SUM(debit - credit), 0) as total
        FROM `tabGL Entry`
        WHERE posting_date BETWEEN %s AND %s
        AND company = %s AND is_cancelled = 0
        AND account IN (
            SELECT name FROM `tabAccount`
            WHERE root_type = 'Expense' AND company = %s
            AND account_name NOT IN (
                'Stock Adjustment', 'Expenses Included In Valuation',
                'Expenses Included In Asset Valuation'
            )
        )
    """, (start, end, company, company), as_dict=True)[0].total

    net = flt(income) - flt(expenses)

    return {
        "period": period,
        "start_date": start,
        "end_date": end,
        "income": {"value": flt(income, 2), "formatted": fmt_money(income, currency=currency)},
        "expenses": {"value": flt(expenses, 2), "formatted": fmt_money(expenses, currency=currency)},
        "net_profit": {"value": flt(net, 2), "formatted": fmt_money(net, currency=currency)},
        "currency": currency,
    }


@frappe.whitelist()
def get_receivables(page=1, page_size=20):
    """Unpaid Sales Invoices grouped by customer."""
    frappe.has_permission("Sales Invoice", throw=True)

    page = max(1, cint(page))
    start = (page - 1) * cint(page_size)

    data = frappe.db.sql("""
        SELECT customer, customer_name,
               COUNT(*) as invoice_count,
               SUM(outstanding_amount) as total_outstanding,
               MIN(due_date) as oldest_due
        FROM `tabSales Invoice`
        WHERE docstatus = 1 AND outstanding_amount > 0
        GROUP BY customer
        ORDER BY total_outstanding DESC
        LIMIT %s OFFSET %s
    """, (cint(page_size), start), as_dict=True)

    total = frappe.db.sql("""
        SELECT COUNT(DISTINCT customer) as cnt
        FROM `tabSales Invoice`
        WHERE docstatus = 1 AND outstanding_amount > 0
    """, as_dict=True)[0].cnt

    grand_total = frappe.db.sql("""
        SELECT COALESCE(SUM(outstanding_amount), 0) as total
        FROM `tabSales Invoice`
        WHERE docstatus = 1 AND outstanding_amount > 0
    """, as_dict=True)[0].total

    return {
        "receivables": data,
        "grand_total": flt(grand_total, 2),
        "total_customers": total,
        "page": page,
    }


@frappe.whitelist()
def get_payables(page=1, page_size=20):
    """Unpaid Purchase Invoices grouped by supplier."""
    frappe.has_permission("Purchase Invoice", throw=True)

    page = max(1, cint(page))
    start = (page - 1) * cint(page_size)

    data = frappe.db.sql("""
        SELECT supplier, supplier_name,
               COUNT(*) as invoice_count,
               SUM(outstanding_amount) as total_outstanding,
               MIN(due_date) as oldest_due
        FROM `tabPurchase Invoice`
        WHERE docstatus = 1 AND outstanding_amount > 0
        GROUP BY supplier
        ORDER BY total_outstanding DESC
        LIMIT %s OFFSET %s
    """, (cint(page_size), start), as_dict=True)

    grand_total = frappe.db.sql("""
        SELECT COALESCE(SUM(outstanding_amount), 0) as total
        FROM `tabPurchase Invoice`
        WHERE docstatus = 1 AND outstanding_amount > 0
    """, as_dict=True)[0].total

    return {
        "payables": data,
        "grand_total": flt(grand_total, 2),
        "page": page,
    }


@frappe.whitelist()
def get_expense_breakdown(period="this_month"):
    """Top expense categories for the given period."""
    frappe.has_permission("GL Entry", throw=True)

    today = getdate(nowdate())
    if period == "this_month":
        start = today.replace(day=1).isoformat()
    elif period == "last_month":
        # Go to first day of previous month
        first_of_this = today.replace(day=1)
        last_month_end = first_of_this - __import__('datetime').timedelta(days=1)
        start = last_month_end.replace(day=1).isoformat()
    elif period == "this_year":
        start = today.replace(month=1, day=1).isoformat()
    else:
        start = today.replace(day=1).isoformat()

    company = frappe.defaults.get_global_default("company")

    data = frappe.db.sql("""
        SELECT gl.account,
               a.account_name,
               SUM(gl.debit - gl.credit) as total
        FROM `tabGL Entry` gl
        JOIN `tabAccount` a ON a.name = gl.account
        WHERE gl.posting_date >= %s AND gl.posting_date <= %s
        AND gl.company = %s AND gl.is_cancelled = 0
        AND a.root_type = 'Expense'
        GROUP BY gl.account
        HAVING total > 0
        ORDER BY total DESC
        LIMIT 15
    """, (start, nowdate(), company), as_dict=True)

    return {"expenses": data, "period": period}


@frappe.whitelist()
def get_cash_flow_summary():
    """Simple cash in / cash out for current month."""
    frappe.has_permission("GL Entry", throw=True)

    today = getdate(nowdate())
    start = today.replace(day=1).isoformat()
    company = frappe.defaults.get_global_default("company")

    cash_in = frappe.db.sql("""
        SELECT COALESCE(SUM(pe.paid_amount), 0) as total
        FROM `tabPayment Entry` pe
        WHERE pe.posting_date >= %s AND pe.docstatus = 1
        AND pe.payment_type = 'Receive' AND pe.company = %s
    """, (start, company), as_dict=True)[0].total

    cash_out = frappe.db.sql("""
        SELECT COALESCE(SUM(pe.paid_amount), 0) as total
        FROM `tabPayment Entry` pe
        WHERE pe.posting_date >= %s AND pe.docstatus = 1
        AND pe.payment_type = 'Pay' AND pe.company = %s
    """, (start, company), as_dict=True)[0].total

    return {
        "cash_in": flt(cash_in, 2),
        "cash_out": flt(cash_out, 2),
        "net": flt(cash_in - cash_out, 2),
    }
