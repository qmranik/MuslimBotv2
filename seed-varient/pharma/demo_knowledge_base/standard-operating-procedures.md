# Quazi-Pharma Standard Operating Procedures

## SOP-01: Processing a Walk-in Sale

1. Greet the customer. Ask what they need.
2. Search for the item using the AI assistant or manually.
3. Confirm: item name, quantity, unit (strip/bottle/piece), price.
4. For prescription medicines: verify prescription on first purchase.
5. Create a POS Sale Invoice (as_invoice=True) for immediate payment.
6. Accept payment and hand over the medicine with usage instructions.
7. For antibiotics: remind the customer to complete the full course.

## SOP-02: Handling a Voice/Banglish Order

1. Listen to the customer's request (e.g., "10 pata napa ar 5 ta sergel").
2. Parse using the Banglish dictionary: "10 strips Napa + 5 strips Sergel".
3. Search each item in inventory.
4. Confirm availability and price with the customer.
5. If an item is out of stock, suggest a generic equivalent.
6. After confirmation, create the sale.
7. Read back the total clearly for voice customers.

## SOP-03: Bulk/Clinic Orders

1. Verify the clinic/business account exists. If not, create under "Commercial" group.
2. Create a Sales Order (not direct invoice) with all items.
3. Get written confirmation (prescription list or purchase order).
4. Prepare the order for pickup/delivery.
5. After handover, convert Sales Order to Sales Invoice.
6. Clinic orders are typically on Net 15 credit terms.

## SOP-04: Receiving Stock from Distributor

1. Verify delivery against the purchase order.
2. Check expiry dates — reject any items with less than 6 months to expiry.
3. Physically count all items.
4. Create a Stock Entry (Material Receipt) in ERPNext.
5. Enter each item with item code, quantity, purchase rate.
6. Submit the stock entry.
7. Arrange items on correct rack/shelf per store layout.

## SOP-05: Daily Operations

1. **Morning**: Check stock alerts — reorder items below safety stock.
2. **Morning**: Verify cold-chain items (insulin, some eye drops) are properly stored.
3. **Evening**: Reconcile cash drawer against POS sales.
4. **Evening**: Review outstanding customer balances — follow up on overdue amounts.
5. **Weekly**: Check near-expiry items (within 3 months) — move to front of shelf for FEFO.

## SOP-06: Handling Returns

1. Verify original purchase receipt and date.
2. Unopened, undamaged items within 48 hours: approve return.
3. Opened strips/bottles: cannot be returned (pharmacy regulation).
4. Temperature-sensitive items: non-returnable.
5. Create a Credit Note (Sales Return) in ERPNext if approved.
6. Refund via original payment method.

## SOP-07: Prescription Verification

1. Check prescriber name and registration number.
2. Verify patient name matches the buyer (or buyer is authorized family member).
3. Check dosage is within standard range for the prescribed medicine.
4. For controlled substances: log in the controlled substance register.
5. Stamp the prescription with date and pharmacy seal.
