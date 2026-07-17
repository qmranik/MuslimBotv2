import frappe
import json
from frappe.utils import flt
from small_erp.api.customers import create_customer
from small_erp.api.inventory import create_item, create_stock_entry, get_item_detail
from small_erp.api.pos import pos_checkout, get_pos_summary
from small_erp.utils.company import get_default_company, resolve_warehouse

def run_test():
    print("==================================================")
    print("STARTING E2E PHARMACY POS checkout INTEGRATION TEST")
    print("==================================================")

    # 1. Setup Customer
    customer_name = "masud anik"
    print(f"\n1. Setting up customer: '{customer_name}'...")
    cust_res = create_customer(customer_name=customer_name, customer_group="Individual")
    customer_id = cust_res["name"]
    print(f"   => Customer ID created: {customer_id}")

    # 2. Setup Pharmaceutical Item
    item_name = "Paracetamol 500mg"
    print(f"\n2. Setting up item: '{item_name}'...")
    # Find active item group
    item_groups = frappe.get_all("Item Group", filters={"is_group": 0}, limit=1)
    item_group = item_groups[0].name if item_groups else "Products"
    
    item_res = create_item(item_name=item_name, item_group=item_group, stock_uom="Nos", standard_rate=15.00, description="Pain reliever and fever reducer")
    item_code = item_res["name"]
    print(f"   => Item created: {item_code} in group '{item_group}'")

    # 3. Check Initial Stock
    print("\n3. Checking initial stock...")
    details = get_item_detail(item_code=item_code)
    initial_qty = flt(sum(w.actual_qty for w in details.get("warehouses", [])))
    print(f"   => Initial Stock Qty: {initial_qty}")

    # 4. Seed Stock (Material Receipt)
    seed_qty = 100
    print(f"\n4. Seeding {seed_qty} units of stock via Material Receipt...")
    company = get_default_company()
    target_warehouse = resolve_warehouse(company=company)
    print(f"   => Target warehouse: {target_warehouse} (company: {company})")
    
    stock_items = [{"item_code": item_code, "qty": seed_qty, "rate": 10.00}]
    create_stock_entry(
        entry_type="Material Receipt",
        items_json=json.dumps(stock_items),
        target_warehouse=target_warehouse
    )
    
    details_after_seed = get_item_detail(item_code=item_code)
    qty_after_seed = flt(sum(w.actual_qty for w in details_after_seed.get("warehouses", [])))
    print(f"   => Stock after seeding: {qty_after_seed} (expected: {initial_qty + seed_qty})")
    assert qty_after_seed == initial_qty + seed_qty, "Seeding failed!"

    # 5. Check POS Summary Before Transaction
    pos_summary_before = get_pos_summary()
    print(f"\n5. POS summary before sale: Transactions: {pos_summary_before['transactions']}, Total Sales: {pos_summary_before['total_sales']}")

    # 6. Execute POS Checkout Flow (Buy 10 units)
    buy_qty = 10
    buy_rate = 15.00
    expected_grand_total = buy_qty * buy_rate
    print(f"\n6. Executing POS Checkout: {buy_qty} units of {item_code} at ${buy_rate} each...")
    
    cart = [{"item_code": item_code, "qty": buy_qty, "rate": buy_rate}]
    checkout_res = pos_checkout(
        customer=customer_id,
        items_json=json.dumps(cart),
        mode_of_payment="Cash"
    )
    print(f"   => Checkout Success! Invoice: {checkout_res['invoice']}, Total: {checkout_res['grand_total']}, Status: {checkout_res['status']}")
    assert flt(checkout_res['grand_total']) == expected_grand_total, "Invoice grand total mismatch!"

    # 7. Verify Stock Decreased
    print("\n7. Verifying stock levels decreased correctly...")
    details_after_checkout = get_item_detail(item_code=item_code)
    qty_after_checkout = flt(sum(w.actual_qty for w in details_after_checkout.get("warehouses", [])))
    print(f"   => Stock after checkout: {qty_after_checkout} (expected: {qty_after_seed - buy_qty})")
    assert qty_after_checkout == qty_after_seed - buy_qty, "Stock quantity did not decrease correctly!"
    print("   => SUCCESS: Stock deducted correctly!")

    # 8. Verify POS Summary Updated
    pos_summary_after = get_pos_summary()
    print(f"\n8. POS summary after sale: Transactions: {pos_summary_after['transactions']}, Total Sales: {pos_summary_after['total_sales']}")
    assert pos_summary_after['transactions'] == pos_summary_before['transactions'] + 1, "Transaction count did not increment!"
    assert flt(pos_summary_after['total_sales']) == flt(pos_summary_before['total_sales']) + expected_grand_total, "POS Total sales did not update correctly!"
    print("   => SUCCESS: POS Summary updated correctly!")

    # 9. Verify G/L Accounts Ledger Entry
    print("\n9. Verifying accounting entries (Sales Invoice marked as Paid)...")
    outstanding = frappe.db.get_value("Sales Invoice", checkout_res['invoice'], "outstanding_amount")
    print(f"   => Invoice Outstanding Amount: {outstanding} (expected: 0.0)")
    assert flt(outstanding) == 0.0, "Invoice is not fully paid!"
    print("   => SUCCESS: Accounts ledger and invoice payments posted correctly!")

    print("\n==================================================")
    print("ALL TESTS PASSED: E2E PHARMACY USER FLOW VERIFIED!")
    print("==================================================")

if __name__ == "__main__":
    run_test()
