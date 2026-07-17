import frappe
from small_erp.api.dashboard import get_dashboard_kpis, get_recent_activity, get_revenue_chart_data
from small_erp.api.pos import search_pos_items, get_pos_summary, get_payment_modes
from small_erp.api.orders import get_orders
from small_erp.api.inventory import get_items, get_item_groups, get_warehouses, get_low_stock_items
from small_erp.api.customers import get_customers
from small_erp.api.accounting import get_profit_and_loss, get_receivables, get_payables, get_expense_breakdown, get_cash_flow_summary
from small_erp.api.settings import get_company_info, get_system_info
from small_erp.api.admin import get_tenant_info

def run_all():
    frappe.session.user = "Administrator"
    
    print("--- 3.1 Dashboard API tests ---")
    print(get_dashboard_kpis())
    print(get_recent_activity(limit=2))
    print(get_revenue_chart_data("monthly"))
    print(get_revenue_chart_data("weekly"))
    
    print("--- 3.2 POS API tests ---")
    print(search_pos_items(limit=2))
    print(get_pos_summary())
    print(get_payment_modes())
    
    print("--- 3.3 Orders API tests ---")
    print(get_orders())
    
    print("--- 3.4 Inventory API tests ---")
    print(get_items())
    print(get_item_groups())
    print(get_warehouses())
    print(get_low_stock_items())
    
    print("--- 3.5 Customers API tests ---")
    print(get_customers())
    
    print("--- 3.6 Accounting API tests ---")
    print(get_profit_and_loss("this_month"))
    print(get_receivables())
    print(get_payables())
    print(get_expense_breakdown())
    print(get_cash_flow_summary())
    
    print("--- 3.7 Settings API tests ---")
    print(get_company_info())
    print(get_system_info())
    
    print("--- 3.8 Admin API tests ---")
    print(get_tenant_info())
    
    print("ALL TESTS COMPLETED SUCCESSFULLY")
