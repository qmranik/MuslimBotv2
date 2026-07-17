import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2, RotateCcw } from 'lucide-react';
import { deleteSource, listSources, triggerSync } from '../../services/kbClient';

const STATUS_MAP = {
  indexed: { label: 'Ready', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  indexing: { label: 'Indexing', className: 'text-amber-700 bg-amber-50 border-amber-200' },
  uploading: { label: 'Indexing', className: 'text-amber-700 bg-amber-50 border-amber-200' },
  failed: { label: 'Failed', className: 'text-rose-700 bg-rose-50 border-rose-200' },
  queued: { label: 'Queued', className: 'text-slate-600 bg-slate-100 border-slate-200' },
};

export function SourceList({ refreshKey = 0, onRefresh }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listSources({ page: 1, pageSize: 50 });
      setSources(data.items || []);
    } catch (err) {
      setError(err.message);
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    const pending = sources.some((s) => ['queued', 'uploading', 'indexing'].includes(s.status));
    if (!pending) return undefined;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [sources, load]);

  if (loading && sources.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 p-4">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        Loading sources...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Indexed Sources</h3>
        <button type="button" onClick={load} className="text-[10px] text-slate-500 hover:text-indigo-600 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>}
      {sources.length === 0 ? (
        <p className="text-xs text-slate-500 p-8 border border-dashed border-slate-300 rounded-2xl text-center bg-white">
          No knowledge sources yet.
        </p>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => {
            const status = STATUS_MAP[source.status] || STATUS_MAP.queued;
            return (
              <div key={source.id} className="panel-card p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{source.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 capitalize">
                      {source.source_type}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => { triggerSync(source.id); onRefresh?.(); load(); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Re-sync">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => { if (window.confirm('Delete this source?')) { deleteSource(source.id).then(() => { onRefresh?.(); load(); }); } }} className="p-2 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
