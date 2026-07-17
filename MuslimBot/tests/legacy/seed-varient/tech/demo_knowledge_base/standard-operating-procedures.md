# Quazi-Tech Standard Operating Procedures

## SOP-01: Processing a Walk-in Sale

1. Greet the customer and ask what they need.
2. Search for the requested item in inventory.
3. Confirm availability, price, and any current promotions.
4. If the customer wants to proceed, collect their name (for warranty registration).
5. Create a Sales Invoice with `update_stock = 1` (point-of-sale mode).
6. Accept payment (Cash, bKash, card).
7. Print receipt and hand over the product with warranty card.

## SOP-02: Processing a Corporate/Bulk Order

1. Verify the customer account exists in ERPNext. If not, create one under "Commercial" group.
2. Create a Sales Order (not invoice) with all items and agreed pricing.
3. Get written confirmation (email/PO) from the client.
4. Submit the Sales Order.
5. Once goods are ready, create a Delivery Note from the Sales Order.
6. After delivery confirmation, create a Sales Invoice from the Sales Order.
7. For credit customers, follow up on payment within the agreed terms (typically Net 30).

## SOP-03: Receiving Stock from Supplier

1. Verify the delivery against the Purchase Order.
2. Physically inspect all items — check for damage, count quantities.
3. Create a Stock Entry (Material Receipt) in ERPNext.
4. Enter each item with its item code, received quantity, and purchase rate.
5. Set the target warehouse (default: "Stores").
6. Submit the Stock Entry.
7. File the supplier invoice and create a Purchase Invoice in ERPNext.

## SOP-04: Handling a Return/Exchange

1. Verify the original invoice and purchase date.
2. If within 7 days (unopened) or 3 days (DOA): approve return.
3. Create a Sales Return (Credit Note) in ERPNext.
4. Process refund via original payment method, or issue store credit.
5. If DOA exchange: create a new Sales Invoice for the replacement unit.

## SOP-05: Daily Closing Procedure

1. Run the "Stock Alerts" check — note items below safety stock.
2. Reconcile cash drawer against today's cash sales.
3. Review all pending Sales Orders — follow up on any older than 3 days.
4. Check outstanding receivables — send reminders for invoices overdue > 7 days.
5. Back up the day's transactions (automated via ERPNext scheduler).

## SOP-06: Custom PC Build Process

1. Help customer select components (CPU, GPU, RAM, SSD, motherboard, PSU, case, cooler).
2. Verify component compatibility (socket, DDR generation, PSU wattage).
3. Create a Sales Order with all components listed.
4. Assembly team builds and tests within 1-2 business days.
5. Install OS if requested (Windows license must be customer-purchased).
6. Run stress test (30 min Prime95 + FurMark).
7. Notify customer for pickup/delivery.
8. Convert Sales Order to Sales Invoice upon handover.
