# Quazi-Tech Inventory Management Rules

## Safety Stock Levels

Each item has a configured safety stock level in ERPNext. When actual stock falls below safety stock, it triggers a low-stock alert.

**General guidelines:**
- High-volume items (cables, thermal paste, budget peripherals): safety stock = 15-20 units
- Mid-range items (RAM, SSDs, keyboards/mice): safety stock = 5-10 units
- High-value items (laptops, GPUs, monitors): safety stock = 2-5 units
- Consumables (toner cartridges): safety stock = 5 units

## Reorder Rules

- When stock hits safety level: create a Purchase Order to the preferred supplier.
- Reorder quantity = 2x safety stock (to cover lead time + buffer).
- Lead times: Local distributors = 2-3 days. Brand distributors = 5-7 days.

## Warehouse Structure

| Warehouse | Purpose |
|-----------|---------|
| Stores | Main inventory — all received goods land here |
| Showroom Display | Demo units on display (not for sale unless last unit) |
| Defective | Items pending return to supplier or warranty claim |

## Stock Entry Types Used

- **Material Receipt**: Goods received from supplier.
- **Material Issue**: Goods consumed/damaged/written off.
- **Material Transfer**: Moving between warehouses (e.g., Stores → Showroom Display).

## Valuation Method

FIFO (First In, First Out) — ERPNext default. Purchase rate is tracked per batch.

## Physical Stock Audit

- Full audit: quarterly (every 3 months).
- Spot checks: weekly on high-value items (laptops, GPUs).
- Discrepancies > BDT 5,000 must be reported to management immediately.
