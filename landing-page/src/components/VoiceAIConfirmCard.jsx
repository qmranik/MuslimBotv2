import React, { useDeferredValue, useState } from 'react';

export const VoiceAIConfirmCard = ({
  tenantId,
  voiceIntent,
  stagedPayload
}) => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isPending, setIsPending] = useState(false);
  
  // Enforce React 18/19 deferred processing to completely isolate rendering jank
  const deferredPayload = useDeferredValue(stagedPayload);

  const handleCommitWrite = async () => {
    setIsPending(true);
    // Simulates the exact Go-Orchestrator to headless Frappe write loop
    try {
      // In production, this targets: /v1/ai/tool/execute
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate latency
      setIsConfirmed(true);
    } catch (error) {
      console.error("Mutation failed safely. DB state protected.", error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl transition-all duration-300 mx-auto text-left">
      <div className="mb-4 flex items-center justify-between border-b border-slate-900 pb-3">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-purple-500"></span>
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400">LiveKit Voice Intent</h4>
        </div>
        <span className="text-[10px] rounded bg-slate-900 px-2 py-0.5 font-mono text-slate-400">Tenant: {tenantId}</span>
      </div>

      <blockquote className="mb-4 border-l-2 border-slate-700 pl-3 italic text-slate-400 text-sm">
        "{voiceIntent}"
      </blockquote>

      <div className="space-y-2 rounded-lg bg-slate-900/50 p-4 border border-slate-900/80 mb-5">
        <div className="text-xs text-slate-500 uppercase font-mono tracking-tight mb-2">Staged ERP Next Document (Draft)</div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Item SKU:</span>
          <span className="font-mono text-slate-200">{deferredPayload.item}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Quantity:</span>
          <span className="font-mono text-slate-200">{deferredPayload.qty} units</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Estimated Total:</span>
          <span className="font-mono font-bold text-emerald-400">${(deferredPayload.qty * deferredPayload.price).toFixed(2)}</span>
        </div>
      </div>

      {!isConfirmed ? (
        <div className="flex space-x-3">
          <button 
            disabled={isPending}
            onClick={handleCommitWrite}
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition"
          >
            {isPending ? "Writing..." : "Confirm & Commit"}
          </button>
          <button 
            className="rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-medium text-slate-400 border border-slate-800 hover:bg-slate-800 transition"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="rounded-lg bg-emerald-950/30 border border-emerald-800/50 p-3 text-center text-xs text-emerald-400 font-medium">
          ✓ Document securely committed to small_erp via masked API.
        </div>
      )}
    </div>
  );
};
