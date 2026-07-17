'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SYSTEM_HUB, SYSTEMS_TABS, SYSTEMS_BAR_HEIGHT, isSystemRoute, isTabActive } from '../config/systemsTabs';

/**
 * Shared Systems Hub top navigation. One component, one config — every system
 * screen shows the same tools with a consistent text + icon treatment.
 */
export function SystemsTabBar() {
  const pathname = usePathname();
  if (!isSystemRoute(pathname)) return null;

  const HubIcon = SYSTEM_HUB.icon;

  return (
    <div
      style={{ height: SYSTEMS_BAR_HEIGHT }}
      className="absolute inset-x-0 top-0 z-20 flex items-center gap-4 border-b border-slate-200 bg-white px-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex shrink-0 items-center gap-2 pr-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <HubIcon className="h-4 w-4" />
        </span>
        <span className="hidden font-display text-sm font-semibold text-slate-900 dark:text-slate-100 sm:inline">
          {SYSTEM_HUB.label}
        </span>
      </div>

      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Systems Hub">
        {SYSTEMS_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab, pathname);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              title={tab.name}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{tab.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
