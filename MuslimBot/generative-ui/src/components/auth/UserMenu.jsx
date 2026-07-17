'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { getLogoutUrl } from '../../config/auth';

// Identity chip + sign-out. Sign-out delegates to Authentik's invalidation flow.
export function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const email = user?.email || 'Signed in';
  const name = user?.full_name || user?.username || email;
  const initial = (name || 'U').trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="fixed" style={{ top: '1rem', right: '11.5rem', zIndex: 55 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm shadow-sm transition-colors"
        style={{
          background: 'var(--card-bg)',
          color: 'var(--text-primary)',
          border: '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)',
        }}
        title={email}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: 'var(--accent-primary)' }}
        >
          {initial}
        </span>
        <span className="hidden max-w-[160px] truncate sm:block">{name}</span>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl shadow-lg"
          style={{
            background: 'var(--card-bg)',
            color: 'var(--text-primary)',
            border: '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)',
          }}
        >
          <div className="px-4 py-3">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-xs opacity-60">{email}</div>
            {user?.tenant_id && (
              <div className="mt-1 text-[11px] opacity-50">tenant: {user.tenant_id}</div>
            )}
          </div>
          <div className="h-px" style={{ background: 'color-mix(in srgb, var(--text-primary) 10%, transparent)' }} />
          <a
            href={getLogoutUrl()}
            className="flex items-center gap-2 px-4 py-3 text-sm transition-colors hover:opacity-80"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </a>
        </div>
      )}
    </div>
  );
}
