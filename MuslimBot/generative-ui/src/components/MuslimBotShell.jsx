'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthedShell } from './AuthedShell';
import { AuthSplash } from './auth/AuthSplash';
import { useAuth } from '../hooks/useAuth';

// Public routes that render bare (no shell chrome, no auth required).
const AUTH_ROUTES = ['/login', '/signup'];

// MuslimBotShell is the auth gate. Authenticated visitors get the full AuthedShell;
// guests are sent to /login. Identity comes from Authentik via /v1/auth/me.
export function MuslimBotShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname === p || pathname?.startsWith(p + '/'));
  const { status, user } = useAuth({ skip: isAuthRoute });

  useEffect(() => {
    if (!isAuthRoute && status === 'guest') router.replace('/login');
  }, [isAuthRoute, status, router]);

  if (isAuthRoute) return <>{children}</>;
  if (status === 'loading') return <AuthSplash />;
  if (status === 'guest') return <AuthSplash message="Redirecting to sign in…" />;
  return <AuthedShell user={user}>{children}</AuthedShell>;
}
