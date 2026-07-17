"""
Scheduled Tasks — automated reports and checks.
"""
import frappe
from frappe.utils import nowdate, add_days, flt, fmt_money


def daily_summary_report():
    """Generate and email daily business summary to SMB Manager role users."""
    today = nowdate()
    company = frappe.defaults.get_global_default("company")
    currency = frappe.defaults.get_global_default("currency") or "BDT"

    # Today's sales
    sales = frappe.db.sql("""
        SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total
        FROM `tabSales Invoice`
        WHERE posting_date = %s AND docstatus = 1
    """, today, as_dict=True)[0]

    # Today's payments received
    payments = frappe.db.sql("""
        SELECT COALESCE(SUM(paid_amount), 0) as total
        FROM `tabPayment Entry`
        WHERE posting_date = %s AND docstatus = 1 AND payment_type = 'Receive'
    """, today, as_dict=True)[0].total

    # New customers
    new_customers = frappe.db.count("Customer", {"creation": [">=", today]})

    subject = f"Daily Summary — {today}"
    message = f"""
    <h3>Daily Business Summary — {today}</h3>
    <table style="border-collapse:collapse; width:100%;">
        <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Sales Today</strong></td>
            <td style="padding:8px; border:1px solid #ddd;">{sales.count} invoices — {fmt_money(sales.total, currency=currency)}</td></tr>
        <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Payments Received</strong></td>
            <td style="padding:8px; border:1px solid #ddd;">{fmt_money(payments, currency=currency)}</td></tr>
        <tr><td style="padding:8px; border:1px solid #ddd;"><strong>New Customers</strong></td>
            <td style="padding:8px; border:1px solid #ddd;">{new_customers}</td></tr>
    </table>
    """

    # Send to all users with SMB Manager role
    managers = frappe.get_all("Has Role",
        filters={"role": "SMB Manager", "parenttype": "User"},
        fields=["parent"],
    )

    for m in managers:
        try:
            frappe.sendmail(
                recipients=m.parent,
                subject=subject,
                message=message,
            )
        except Exception:
            pass


def weekly_inventory_check():
    """Flag items below safety stock and notify."""
    low_items = frappe.db.sql("""
        SELECT i.name as item_code, i.item_name,
               i.safety_stock, COALESCE(SUM(b.actual_qty), 0) as actual_qty
        FROM `tabItem` i
        LEFT JOIN `tabBin` b ON b.item_code = i.name
        WHERE i.disabled = 0 AND i.is_stock_item = 1
        GROUP BY i.name
        HAVING actual_qty <= COALESCE(i.safety_stock, 5)
    """, as_dict=True)

    if not low_items:
        return

    rows = ""
    for item in low_items:
        rows += f"""
        <tr>
            <td style="padding:6px; border:1px solid #ddd;">{item.item_code}</td>
            <td style="padding:6px; border:1px solid #ddd;">{item.item_name}</td>
            <td style="padding:6px; border:1px solid #ddd;">{flt(item.actual_qty, 2)}</td>
            <td style="padding:6px; border:1px solid #ddd;">{item.safety_stock}</td>
        </tr>
        """

    message = f"""
    <h3>Weekly Inventory Alert — {len(low_items)} Items Below Safety Stock</h3>
    <table style="border-collapse:collapse; width:100%;">
        <tr style="background:#f5f5f5;">
            <th style="padding:8px; border:1px solid #ddd;">Item Code</th>
            <th style="padding:8px; border:1px solid #ddd;">Name</th>
            <th style="padding:8px; border:1px solid #ddd;">Current Qty</th>
            <th style="padding:8px; border:1px solid #ddd;">Safety Stock</th>
        </tr>
        {rows}
    </table>
    """

    managers = frappe.get_all("Has Role",
        filters={"role": "SMB Manager", "parenttype": "User"},
        fields=["parent"],
    )

    for m in managers:
        try:
            frappe.sendmail(
                recipients=m.parent,
                subject=f"Low Stock Alert — {len(low_items)} items need attention",
                message=message,
            )
        except Exception:
            pass
