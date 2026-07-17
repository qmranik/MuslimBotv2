import React, { useEffect, useState, useCallback } from 'react';
import { Users } from 'lucide-react';
import { getCustomers } from '../services/erpClient';
import { GenerativeTable } from '../components/GenerativeTable';

export function ErpCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCustomers({ page_size: 50 });
      const rows = data.map((c) => ({
        id: c.name,
        customerName: c.customer_name,
        group: c.customer_group,
        territory: c.territory,
      }));
      setCustomers(rows);
    } catch (e) {
      console.error(e);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    window.addEventListener('erp:cache:invalidate', fetchCustomers);
    return () => window.removeEventListener('erp:cache:invalidate', fetchCustomers);
  }, [fetchCustomers]);

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'customerName', label: 'Name' },
    { key: 'group', label: 'Group' },
    { key: 'territory', label: 'Territory' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-indigo-600" />
        <div>
          <h2 className="text-base font-bold text-slate-900">Customers</h2>
          <p className="text-[11px] text-slate-500">View your customer directory</p>
        </div>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Loading customers...</p>
      ) : (
        <GenerativeTable columns={columns} data={customers} title="Customer List" />
      )}
    </div>
  );
}