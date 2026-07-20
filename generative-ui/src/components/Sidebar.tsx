'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Briefcase,
  FileText,
  Sparkles,
  Settings,
  Headset,
  Megaphone,
  Workflow,
  Globe,
} from 'lucide-react';
import { authMe, type AuthMe } from '@/lib/api';

const NAV = [
  { href: '/', icon: Home, label: 'Dashboard' },
  { href: '/erp', icon: Briefcase, label: 'ERP' },
  { href: '/kb', icon: FileText, label: 'Knowledge Base' },
  { href: '/support', icon: Headset, label: 'Support' },
  { href: '/marketing', icon: Megaphone, label: 'Marketing' },
  { href: '/workflows', icon: Workflow, label: 'Workflows' },
  { href: '/site', icon: Globe, label: 'Website' },
  { href: '/agent', icon: Sparkles, label: 'Voice Agent' },
] as const;

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 focus:ring-2 focus:ring-accent focus:outline-none ${
        active
          ? 'bg-accent text-background shadow-md'
          : 'text-secondary hover:bg-surface-hover hover:text-primary'
      }`}
    >
      <Icon size={20} />
      <span className="pointer-events-none absolute left-16 z-50 scale-0 whitespace-nowrap rounded bg-surface px-2 py-1 text-xs text-primary shadow-lg border border-divider transition-all group-hover:scale-100">
        {label}
      </span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthMe | null>(null);

  useEffect(() => {
    authMe()
      .then(setUser)
      .catch((err) => {
        if (err?.status === 401) {
          const authUrl = process.env.NEXT_PUBLIC_AUTHENTIK_URL || 'https://auth.smb.localhost';
          window.location.href = authUrl;
        }
      });
  }, []);

  const isActive = (href: string) =>
    href === '/' ? pathname === href : pathname.startsWith(href);

  const getInitials = (name?: string, email?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return '?';
  };

  return (
    <aside className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex max-h-[85vh] w-[72px] flex-col items-center gap-6 rounded-[36px] bg-surface/70 py-6 px-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl border border-divider">
      {/* User Avatar */}
      <div className="group relative h-10 w-10 flex-shrink-0 rounded-full overflow-hidden border-2 border-divider shadow-sm cursor-pointer hover:scale-105 transition-transform flex items-center justify-center bg-gradient-to-tr from-accent to-cyan-500 text-background font-bold text-sm">
        {getInitials(user?.name, user?.email)}
        {user && (
          <span className="pointer-events-none absolute left-12 z-50 scale-0 whitespace-nowrap rounded bg-surface px-2 py-1 text-xs text-primary shadow-lg border border-divider transition-all group-hover:scale-100">
            {user.name || user.email}
          </span>
        )}
      </div>

      {/* Primary Navigation Icons */}
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto no-scrollbar py-1">
        {NAV.map((n) => (
          <NavLink key={n.href} {...n} active={isActive(n.href)} />
        ))}
      </nav>

      {/* Bottom Action (System Jobs) */}
      <NavLink
        href="/system"
        icon={Settings}
        label="System Jobs"
        active={isActive('/system')}
      />
    </aside>
  );
}
