import React from 'react';

export function AppShell({ sidebar, canvas, chat, chatDocked, fab }) {
  return (
    <div className="flex h-screen bg-[var(--canvas-bg)] text-[var(--text-primary)] overflow-hidden font-sans">
      {sidebar}

      {/* Left padding on desktop reserves space for the fixed NavigationPill dock */}
      <div className="flex flex-1 min-w-0 flex-col lg:flex-row pb-16 lg:pb-0 md:pl-24">
        <main className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
          {canvas}
        </main>

        {chatDocked && chat && (
          <aside className="hidden lg:flex w-[360px] shrink-0 border-l border-slate-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 flex-col min-h-0 z-50">
            {chat}
          </aside>
        )}
      </div>

      {!chatDocked && fab}
      {!chatDocked && chat}
    </div>
  );
}
