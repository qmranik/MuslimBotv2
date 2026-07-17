'use client';

import { Loader2, ShieldCheck } from 'lucide-react';

export function AuthSplash({ message = 'Loading your workspace…' }) {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center gap-4"
      style={{ background: 'var(--canvas-bg)', color: 'var(--text-primary)' }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: 'var(--accent-primary)', color: '#fff' }}
      >
        <ShieldCheck className="h-7 w-7" />
      </div>
      <div className="flex items-center gap-2 text-sm opacity-70">
        <Loader2 className="h-4 w-4 animate-spin" />
        {message}
      </div>
    </div>
  );
}
