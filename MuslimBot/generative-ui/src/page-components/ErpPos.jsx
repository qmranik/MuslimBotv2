import React, { useState } from 'react';
import { CreditCard, Plus, Search } from 'lucide-react';
import { posCheckout } from '../services/erpClient';

export function ErpPos() {
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState('Cash Customer');
  const [status, setStatus] = useState('');

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setStatus('Processing...');
    try {
      await posCheckout({ customer, items });
      setStatus('Success! Invoice Created.');
      setItems([]);
    } catch (e) {
      console.error(e);
      setStatus('Checkout Failed.');
    }
  };

  const addItemDummy = () => {
    setItems([...items, { item_code: 'DUMMY-ITEM', qty: 1, rate: 100 }]);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-indigo-600" />
        <div>
          <h2 className="text-base font-bold text-slate-900">Point of Sale</h2>
          <p className="text-[11px] text-slate-500">Quick checkout interface</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 panel-card p-4 space-y-4">
          <div className="flex justify-between items-center border-b pb-2 border-slate-100">
            <h3 className="text-sm font-semibold">Cart</h3>
            <button onClick={addItemDummy} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              <Plus className="w-3.5 h-3.5" /> Add Dummy Item
            </button>
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Cart is empty</p>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-xs p-2 bg-slate-50 rounded">
                  <span>{it.item_code} (x{it.qty})</span>
                  <span className="font-semibold">${it.rate * it.qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="w-full md:w-64 panel-card p-4 space-y-4">
          <h3 className="text-sm font-semibold">Checkout</h3>
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500">Customer</label>
            <input 
              type="text" 
              value={customer} 
              onChange={(e) => setCustomer(e.target.value)}
              className="w-full mt-1 p-2 text-xs border border-slate-200 rounded outline-none focus:border-indigo-500"
            />
          </div>
          <button 
            onClick={handleCheckout}
            disabled={items.length === 0}
            className="w-full py-2 bg-indigo-600 text-white rounded text-xs font-bold disabled:opacity-50"
          >
            Pay & Checkout
          </button>
          {status && <p className="text-[10px] text-center font-medium text-slate-500">{status}</p>}
        </div>
      </div>
    </div>
  );
}