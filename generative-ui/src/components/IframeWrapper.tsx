'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { getPortalURL, type PortalApp } from '@/lib/api';

/**
 * SecurePortal — sandboxed iframe host for embedded subsystems.
 *
 * The orchestrator mints a pre-authenticated embed URL via GET /v1/portals/:app/url
 * (Chatwoot magic-link, TryPost/n8n OIDC/forward-auth). The UI never sees any secret.
 *
 * Two-phase loading (fetch URL → load iframe), request timeout + abort, retry on
 * failure, and graceful error states. Magic-links can expire — the retry path
 * re-mints a fresh URL.
 *
 * SECURITY (S-2): `allow-same-origin` + `allow-scripts` in the same sandbox lets a
 * SAME-ORIGIN framed app strip its own sandbox. This is safe ONLY because every
 * portal target is a DIFFERENT origin (chatwoot.<d>, n8n.<d>, …). Never point a
 * SecurePortal at a same-origin URL.
 */

type Phase = 'fetching' | 'loading' | 'ready' | 'error';

const LABELS: Record<PortalApp, string> = {
  'erp-ops': 'ERP Operations',
  builder: 'Website Builder',
  n8n: 'Workflows',
  chatwoot: 'Support',
  trypost: 'Social',
  nextcloud: 'Files',
};

const FETCH_TIMEOUT_MS = 12_000;

export default function IframeWrapper({ targetApp }: { targetApp: PortalApp }) {
  const [phase, setPhase] = useState<Phase>('fetching');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumping this re-runs the fetch effect (used by the Retry button).
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch the SSO embed URL. State resets happen after the async boundary so we never
  // call setState synchronously inside the effect (React 19 / Next 16 hooks rule).
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    (async () => {
      try {
        const res = await getPortalURL(targetApp);
        if (cancelled) return;
        if (!res?.url) throw new Error('The service returned no embed URL');
        setUrl(res.url);
        setPhase('loading');
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.name === 'AbortError'
              ? 'Timed out reaching the service'
              : e.message
            : 'Service unavailable'
        );
        setPhase('error');
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [targetApp, reloadKey]);

  const retry = () => {
    // Event handler — safe to setState synchronously. Show loading immediately,
    // then bump the key to re-mint a fresh URL.
    setUrl(null);
    setError(null);
    setPhase('fetching');
    setReloadKey((k) => k + 1);
  };

  const label = LABELS[targetApp];

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-divider bg-surface">
      {url && (
        <iframe
          ref={iframeRef}
          src={url}
          title={label}
          onLoad={() => setPhase('ready')}
          onError={() => {
            setError('The embedded app failed to load');
            setPhase('error');
          }}
          // S-2: safe ONLY because portal targets are cross-origin.
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
          allow="clipboard-write; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          className={`h-full w-full border-0 transition-opacity duration-300 ${
            phase === 'ready' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {phase !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center bg-surface/95 backdrop-blur-sm">
          {phase === 'error' ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <AlertTriangle className="text-error" size={28} />
              <p className="text-sm text-primary">{label} is unavailable</p>
              {error && (
                <p className="max-w-xs text-xs text-secondary">{error}</p>
              )}
              <button
                onClick={retry}
                className="mt-1 inline-flex items-center gap-2 rounded-lg border border-divider px-3 py-1.5 text-xs text-secondary transition-colors hover:border-accent hover:text-accent focus:ring-2 focus:ring-accent focus:outline-none"
              >
                <RotateCcw size={12} /> Retry
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-accent" size={28} />
              <p className="text-xs text-secondary">
                {phase === 'fetching'
                  ? `Authenticating with ${label}…`
                  : `Loading ${label}…`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
