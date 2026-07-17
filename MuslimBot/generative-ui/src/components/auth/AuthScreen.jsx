'use client';

import Link from 'next/link';
import { ShieldCheck, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import { getLoginUrl, getSignupUrl, authConfigured } from '../../config/auth';

const COPY = {
  login: {
    icon: LogIn,
    title: 'Welcome back',
    subtitle: 'Sign in to your MuslimBot workspace.',
    cta: 'Continue with Single Sign-On',
    getUrl: getLoginUrl,
    altText: "Don't have an account?",
    altLabel: 'Create one',
    altHref: '/signup',
  },
  signup: {
    icon: UserPlus,
    title: 'Create your workspace',
    subtitle: 'Set up secure access to your business operations OS.',
    cta: 'Sign up with Single Sign-On',
    getUrl: getSignupUrl,
    altText: 'Already have an account?',
    altLabel: 'Sign in',
    altHref: '/login',
  },
};

export function AuthScreen({ mode = 'login' }) {
  const c = COPY[mode] || COPY.login;
  const Icon = c.icon;

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, var(--accent-primary) 18%, transparent), transparent), var(--canvas-bg)',
        color: 'var(--text-primary)',
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-xl"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)',
        }}
      >
        {/* Brand */}
        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: 'var(--accent-primary)', color: '#fff' }}
          >
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-semibold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              MuslimBot
            </div>
            <div className="text-xs opacity-60">Unified Admin OS</div>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-6 flex items-start gap-3">
          <Icon className="mt-1 h-5 w-5" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h1 className="text-xl font-semibold">{c.title}</h1>
            <p className="mt-1 text-sm opacity-70">{c.subtitle}</p>
          </div>
        </div>

        {/* Primary SSO action */}
        <a
          href={c.getUrl()}
          className="group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition-transform active:scale-[0.99]"
          style={{ background: 'var(--accent-primary)' }}
        >
          {c.cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </a>

        {!authConfigured && (
          <p className="mt-3 text-center text-xs opacity-50">
            SSO endpoint not configured — set <code>NEXT_PUBLIC_AUTHENTIK_URL</code>.
          </p>
        )}

        {/* Divider + alt action */}
        <div className="my-6 flex items-center gap-3 opacity-40">
          <div className="h-px flex-1" style={{ background: 'currentColor' }} />
          <span className="text-xs">secured by Authentik</span>
          <div className="h-px flex-1" style={{ background: 'currentColor' }} />
        </div>

        <p className="text-center text-sm opacity-70">
          {c.altText}{' '}
          <Link href={c.altHref} className="font-medium hover:underline" style={{ color: 'var(--accent-primary)' }}>
            {c.altLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
