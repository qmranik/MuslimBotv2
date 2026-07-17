import React from 'react';
import { Sparkles, RefreshCw, Info } from 'lucide-react';
import { GenerativeChart } from '../GenerativeChart';
import { GenerativeTable } from '../GenerativeTable';
import { GenerativeMetrics } from '../GenerativeMetrics';
import { GenerativeCard } from '../GenerativeCard';

function ActionCard({ msg, actionStates, erpConnected, dataSource, onExecute, onCancel }) {
  const state = actionStates[msg.id];

  return (
    <div className="panel-card p-5 max-w-full flex flex-col gap-4 border-indigo-200/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            {msg.title || 'Confirm Action'}
          </h4>
          <p className="text-[10px] text-slate-500 font-mono">Type: {msg.actionType}</p>
        </div>
        <span className="text-[10px] font-bold font-mono tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded uppercase">
          {state?.status === 'success' ? 'Completed' : state?.status === 'cancelled' ? 'Cancelled' : 'Pending'}
        </span>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <pre className="text-[10px] text-slate-600 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(msg.actionParams, null, 2)}
        </pre>
      </div>

      {msg.missingFields?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs">
          Missing required fields: {msg.missingFields.join(', ')}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-200 pt-3">
        <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          {erpConnected ? 'Live ERP — confirm to write' : 'Offline — writes blocked'}
        </span>
        {state?.status === 'submitting' ? (
          <button disabled className="px-4 py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Submitting...
          </button>
        ) : state?.status === 'success' ? (
          <span className="text-xs text-emerald-600 font-bold">Submitted to ERP</span>
        ) : state?.status === 'cancelled' ? (
          <span className="text-xs text-slate-500 font-bold italic">Cancelled</span>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onCancel(msg.id)}
              className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onExecute(msg.id, msg.actionType, msg.actionParams)}
              disabled={(!erpConnected && dataSource === 'live') || (msg.missingFields?.length > 0)}
              className="px-4 py-1.5 accent-gradient text-white rounded-lg text-xs font-bold disabled:opacity-40"
            >
              Confirm & Submit
            </button>
          </div>
        )}
      </div>
      {state?.status === 'error' && (
        <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-700 text-[11px]">
          Error: {state.error}
        </div>
      )}
    </div>
  );
}

export function GenerativeMessageRenderer({
  msg,
  actionStates,
  erpConnected,
  dataSource,
  onExecuteAction,
  onCancelAction,
}) {
  return (
    <div className="flex flex-col gap-3 max-w-full animate-slide-up-fade">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full accent-gradient flex items-center justify-center shadow-sm">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Generative Engine</span>
      </div>

      {msg.component === 'chart' && (
        <GenerativeChart type={msg.chartType} data={msg.data} title={msg.title} />
      )}
      {msg.component === 'table' && (
        <GenerativeTable columns={msg.columns} data={msg.data} title={msg.title} />
      )}
      {msg.component === 'metrics' && (
        <GenerativeMetrics metrics={msg.metrics} title={msg.title} />
      )}
      {msg.component === 'card' && (
        <GenerativeCard cardDetails={msg.cardDetails} title={msg.title} />
      )}
      {msg.component === 'action' && (
        <ActionCard
          msg={msg}
          actionStates={actionStates}
          erpConnected={erpConnected}
          dataSource={dataSource}
          onExecute={onExecuteAction}
          onCancel={onCancelAction}
        />
      )}
      {!['chart', 'table', 'metrics', 'card', 'action', 'text'].includes(msg.component) && (
        <div className="panel-card p-4 text-sm border-rose-200">
          <p className="text-rose-600 font-bold mb-2">Unsupported: {msg.component}</p>
          <pre className="text-[10px] text-slate-600 overflow-x-auto">{JSON.stringify(msg, null, 2)}</pre>
        </div>
      )}
      {msg.explanation && (
        <div className="panel-card p-4 text-sm text-slate-600 leading-relaxed">
          <div
            dangerouslySetInnerHTML={{
              __html: msg.explanation
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900">$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 rounded text-indigo-600 text-xs">$1</code>')
                .replace(/\n/g, '<br />'),
            }}
          />
        </div>
      )}
    </div>
  );
}
