import React from 'react';
import { useFabContext } from '../hooks/useFabContext';

export function MuslimbotFab({ visible, open, onClick, unread }) {
  const { icon: Icon, label, tooltip, mode } = useFabContext();

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center justify-center group">
      <div className="absolute right-full mr-4 whitespace-nowrap bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {tooltip}
      </div>
      <button
        type="button"
        onClick={onClick}
        aria-label={open ? 'Close assistant' : label}
        className={`px-5 py-3 rounded-full text-white shadow-lg flex items-center gap-2 transition-transform hover:scale-105 dark:shadow-slate-900/50 dark:border dark:border-slate-700 ${
          mode === 'knowledge' || mode === 'generative' ? 'bg-[#1F2937] shadow-slate-900/30' : 'bg-[#047857] shadow-emerald-900/30'
        } ${open ? 'ring-4 ring-emerald-200' : ''}`}
      >
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{label}</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
