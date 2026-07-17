"use client";
import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Terminal, PlugZap, RefreshCw } from 'lucide-react';
import { parseAllowedOrigins, isAllowedOrigin } from '../config/workspaceUrls';
import { fetchPortalUrl } from '../services/ssoBridge';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

const ALLOWED = parseAllowedOrigins();

export function SecurePortal({ appId, targetUrl, ssoApp }) {
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedUrl, setResolvedUrl] = useState(targetUrl || '');
  const [loadError, setLoadError] = useState('');
  const [logs, setLogs] = useState(['> init secure tunnel...', '> establishing TLS connection...']);
  const iframeRef = useRef(null);
  const setWorkspaceUrl = useWorkspaceStore((s) => s.setWorkspaceUrl);

  useEffect(() => {
    let cancelled = false;

    async function resolveUrl() {
      setIsLoading(true);
      setLoadError('');
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
        setLogs(prev => [...prev, `> url resolved: ${url.substring(0, 25)}...`, '> mounting frame...']);
      } else {
        setLoadError(result?.error || 'Could not resolve portal URL.');
        setIsLoading(false);
      }
    }

    resolveUrl();
    return () => { cancelled = true; };
  }, [appId, targetUrl, ssoApp, setWorkspaceUrl]);

  const refreshPortal = async () => {
    if (!ssoApp) return;
    setIsLoading(true);
    setLoadError('');
    setLogs(['> refreshing secure tunnel...']);
    const result = await fetchPortalUrl(ssoApp);
    const url = result?.url || '';
    if (url) {
      setResolvedUrl(url);
      setWorkspaceUrl(appId, url);
      setLogs(prev => [...prev, '> frame mounted. waiting for onload...']);
    } else {
      setLoadError(result?.error || 'Could not refresh portal URL.');
      setIsLoading(false);
    }
  };

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
      if (isLoading) {
        setLoadError('Portal is taking longer than expected.');
        setLogs(prev => [...prev, '> timeout error: response delayed.']);
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [resolvedUrl, isLoading]);

  useEffect(() => {
    let interval;
    if (isLoading && resolvedUrl) {
      interval = setInterval(() => {
        setLogs(prev => [...prev, '> waiting for target application...']);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isLoading, resolvedUrl]);

  if (!resolvedUrl && loadError) {
    return (
      <div className="portal-frame flex h-full w-full flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/40">
          <PlugZap className="h-7 w-7 text-rose-500" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-display font-semibold text-slate-800 dark:text-slate-100">
            Couldn&rsquo;t connect to this workspace
          </h3>
          <p className="mx-auto max-w-sm text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {ssoApp && (
            <button
              type="button"
              onClick={refreshPortal}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry connection
            </button>
          )}
          {targetUrl && (
            <a
              href={targetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in new tab
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="portal-frame relative w-full h-full min-h-0 bg-slate-100/50">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--canvas-bg)] z-50 p-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-6 animate-pulse">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
          <h2 className="text-xl font-display font-semibold text-slate-900 mb-2">Establishing Secure Connection</h2>
          <p className="text-sm text-slate-500 mb-8 max-w-sm text-center">
            Initializing encrypted tunnel to your enterprise systems. Please stand by.
          </p>
          
          <div className="w-full max-w-md bg-slate-900 rounded-lg shadow-xl overflow-hidden font-mono text-xs">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
              <Terminal className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">Connection Log</span>
            </div>
            <div className="p-4 space-y-2 h-32 overflow-y-auto flex flex-col justify-end">
              {logs.slice(-6).map((log, i) => (
                <div key={i} className="text-emerald-400 opacity-80">{log}</div>
              ))}
              <div className="text-emerald-400 animate-pulse">_</div>
            </div>
          </div>
        </div>
      )}
      
      {loadError && resolvedUrl && (
        <div className="absolute top-3 right-3 z-40">
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-semibold text-emerald-600 shadow-sm hover:bg-slate-50"
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
          className={`w-full h-full min-h-[480px] border-0 bg-white transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => {
            setLogs(prev => [...prev, '> connection established successfully.']);
            setTimeout(() => {
              setIsLoading(false);
              setLoadError('');
            }, 800); // small delay to show success log
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
