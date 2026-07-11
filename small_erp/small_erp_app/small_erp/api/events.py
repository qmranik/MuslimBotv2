"""
Doc Event Handlers — hooked into ERPNext document lifecycle events.
Sends notifications to n8n for automation triggers.
"""
import frappe
import requests


def _get_n8n_url() -> str:
    return frappe.conf.get("n8n_url") or "http://n8n:5678"


def _notify_n8n(event_type, data):
    """Fire-and-forget notification to n8n."""
    try:
        n8n_url = _get_n8n_url()
        requests.post(
            f"{n8n_url}/webhook/erp-event",
            json={"event": event_type, "data": data},
            headers={"Content-Type": "application/json"},
            timeout=2,
        )
    except Exception:
        frappe.log_error(title="n8n notify failed", message=frappe.get_traceback())


def on_sales_invoice_submit(doc, method):
    """Triggered when a Sales Invoice is submitted."""
    _notify_n8n("sales_invoice_submitted", {
        "invoice": doc.name,
        "customer": doc.customer,
        "customer_name": doc.customer_name,
        "grand_total": doc.grand_total,
        "items_count": len(doc.items),
        "posting_date": str(doc.posting_date),
    })


def on_purchase_receipt_submit(doc, method):
    """Triggered when stock is received."""
    items = [{
        "item_code": r.item_code,
        "item_name": r.item_name,
        "qty": r.qty,
        "warehouse": r.warehouse,
    } for r in doc.items]

    _notify_n8n("stock_received", {
        "receipt": doc.name,
        "supplier": doc.supplier,
        "items": items,
    })


def on_stock_entry_submit(doc, method):
    """Triggered on stock movements — check for low stock alerts."""
    _notify_n8n("stock_entry", {
        "entry": doc.name,
        "type": doc.stock_entry_type,
        "items_count": len(doc.items),
    })

    # Check for low stock after movement
    for row in doc.items:
        bin_data = frappe.db.sql("""
            SELECT actual_qty FROM `tabBin`
            WHERE item_code = %s AND warehouse = %s
        """, (row.item_code, row.s_warehouse or row.t_warehouse), as_dict=True)

        if bin_data:
            item = frappe.get_doc("Item", row.item_code)
            safety = item.safety_stock or 5
            if bin_data[0].actual_qty <= safety:
                _notify_n8n("low_stock_alert", {
                    "item_code": row.item_code,
                    "item_name": row.item_name,
                    "current_qty": bin_data[0].actual_qty,
                    "safety_stock": safety,
                    "warehouse": row.s_warehouse or row.t_warehouse,
                })
