import React from 'react';
import { Bot } from 'lucide-react';

export function MuslimbotFab({ visible, open, onClick, unread }) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Close assistant' : 'Open assistant'}
      className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full accent-gradient text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-transform hover:scale-105 ${
        open ? 'ring-4 ring-indigo-200' : ''
      }`}
    >
      <Bot className="w-6 h-6" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
