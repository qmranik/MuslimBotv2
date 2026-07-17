import React, { useEffect, useState, useCallback } from 'react';
import { Package } from 'lucide-react';
import { getItems } from '../services/erpClient';
import { GenerativeTable } from '../components/GenerativeTable';

export function ErpInventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getItems({ page_size: 50 });
      const rows = data.map((i) => ({
        itemCode: i.item_code,
        itemName: i.item_name,
        group: i.item_group,
        stock: i.actual_qty,
        rate: `$${Number(i.standard_rate).toLocaleString()}`,
      }));
      setInventory(rows);
    } catch (e) {
      console.error(e);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
    window.addEventListener('erp:cache:invalidate', fetchInventory);
    return () => window.removeEventListener('erp:cache:invalidate', fetchInventory);
  }, [fetchInventory]);

  const columns = [
    { key: 'itemCode', label: 'Item Code' },
    { key: 'itemName', label: 'Name' },
    { key: 'group', label: 'Group' },
    { key: 'stock', label: 'Available Qty' },
    { key: 'rate', label: 'Rate' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-5 h-5 text-indigo-600" />
        <div>
          <h2 className="text-base font-bold text-slate-900">Inventory & Stock</h2>
          <p className="text-[11px] text-slate-500">Monitor your products</p>
        </div>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Loading inventory...</p>
      ) : (
        <GenerativeTable columns={columns} data={inventory} title="Products" />
      )}
    </div>
  );
}