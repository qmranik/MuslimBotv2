import React, { useEffect, useState, useCallback } from 'react';
import { ShoppingCart } from 'lucide-react';
import { getOrders } from '../services/erpClient';
import { GenerativeTable } from '../components/GenerativeTable';

export function ErpOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrders({ page_size: 50 });
      const rows = data.map((o) => ({
        invoiceNumber: o.name,
        customerName: o.customer,
        amount: `$${Number(o.grand_total).toLocaleString()}`,
        status: o.status,
      }));
      setOrders(rows);
    } catch (e) {
      console.error(e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    window.addEventListener('erp:cache:invalidate', fetchOrders);
    return () => window.removeEventListener('erp:cache:invalidate', fetchOrders);
  }, [fetchOrders]);

  const columns = [
    { key: 'invoiceNumber', label: 'Invoice #' },
    { key: 'customerName', label: 'Customer' },
    { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="w-5 h-5 text-indigo-600" />
        <div>
          <h2 className="text-base font-bold text-slate-900">Orders & Invoices</h2>
          <p className="text-[11px] text-slate-500">View and manage your recent sales</p>
        </div>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Loading orders...</p>
      ) : (
        <GenerativeTable columns={columns} data={orders} title="Recent Orders" />
      )}
    </div>
  );
}