import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { parseAllowedOrigins, isAllowedOrigin } from '../config/workspaceUrls';
import { fetchPortalUrl } from '../services/ssoBridge';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

const ALLOWED = parseAllowedOrigins();

export function SecurePortal({ appId, targetUrl, ssoApp }) {
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedUrl, setResolvedUrl] = useState(targetUrl || '');
  const [loadError, setLoadError] = useState('');
  const iframeRef = useRef(null);
  const setWorkspaceUrl = useWorkspaceStore((s) => s.setWorkspaceUrl);

  useEffect(() => {
    let cancelled = false;

    async function resolveUrl() {
      if (targetUrl) {
        setResolvedUrl(targetUrl);
        return;
      }
      if (!ssoApp) return;

      const result = await fetchPortalUrl(ssoApp);
      if (cancelled) return;

      const url = result?.url || '';
      if (url) {
        setResolvedUrl(url);
        setWorkspaceUrl(appId, url);
      } else {
        setLoadError('Could not resolve portal URL.');
        setIsLoading(false);
      }
    }

    resolveUrl();
    return () => { cancelled = true; };
  }, [appId, targetUrl, ssoApp, setWorkspaceUrl]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!isAllowedOrigin(event.origin, ALLOWED)) return;
      const { data } = event;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'WORKFLOW_SAVED' || data.type === 'ERP_MUTATION_COMPLETE') {
        window.dispatchEvent(new CustomEvent('erp:cache:invalidate'));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [appId]);

  useEffect(() => {
    if (!resolvedUrl) return undefined;
    const timer = setTimeout(() => {
      if (isLoading) setLoadError('Portal is taking longer than expected.');
    }, 15000);
    return () => clearTimeout(timer);
  }, [resolvedUrl, isLoading]);

  if (!resolvedUrl && loadError) {
    return (
      <div className="portal-frame flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-slate-600">{loadError}</p>
        {targetUrl && (
          <a
            href={targetUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in new tab
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="portal-frame relative w-full h-full min-h-0">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-50 rounded-xl">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="mt-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Connecting secure instance...
          </p>
        </div>
      )}
      {loadError && resolvedUrl && (
        <div className="absolute top-3 right-3 z-40">
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-semibold text-indigo-600 shadow-sm hover:bg-slate-50"
          >
            <ExternalLink className="w-3 h-3" />
            Open externally
          </a>
        </div>
      )}
      {resolvedUrl && (
        <iframe
          ref={iframeRef}
          src={resolvedUrl}
          title={`portal-${appId}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          className="w-full h-full min-h-[480px] border-0 rounded-lg bg-white"
          onLoad={() => {
            setIsLoading(false);
            setLoadError('');
          }}
          onError={() => {
            setIsLoading(false);
            setLoadError('Embed blocked — use external link.');
          }}
        />
      )}
    </div>
  );
}
