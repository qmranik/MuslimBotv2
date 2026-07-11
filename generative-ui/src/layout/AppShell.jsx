import React from 'react';

export function AppShell({ sidebar, canvas, chat, chatDocked, fab, mobileNav }) {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      <aside className="hidden lg:flex w-[260px] shrink-0 border-r border-slate-200/80 bg-white flex-col">
        {sidebar}
      </aside>

      <div className="flex flex-1 min-w-0 flex-col lg:flex-row pb-16 lg:pb-0">
        <main className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
          {canvas}
        </main>

        {chatDocked && chat && (
          <aside className="hidden lg:flex w-[360px] shrink-0 border-l border-slate-200/80 bg-white flex-col min-h-0">
            {chat}
          </aside>
        )}
      </div>

      {!chatDocked && fab}
      {!chatDocked && chat}

      {mobileNav && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-2 py-1 safe-area-pb">
          {mobileNav}
        </div>
      )}
    </div>
  );
}
