import React, { useDeferredValue, useState } from 'react';

const VoiceAIConfirmCard = ({
  tenantId = "tx_9981",
  voiceIntent = "Can you create an order for 5 units of Paracetamol?",
  stagedPayload = {
    item: "Paracetamol 500mg",
    qty: 5,
    price: 12.50,
    customer_phone: "+1 (555) 019-283"
  }
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
      await new Promise(resolve => setTimeout(resolve, 800)); // simulate latency
      setIsConfirmed(true);
    } catch (error) {
      console.error("Mutation failed safely. DB state protected.", error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '28rem',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(5, 5, 5, 0.9)',
      padding: '1.5rem',
      color: '#f8fafc',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      transition: 'all 0.3s',
      margin: '0 auto',
      backdropFilter: 'blur(16px)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ position: 'relative', display: 'flex', height: '12px', width: '12px' }}>
            <span style={{ position: 'absolute', height: '100%', width: '100%', borderRadius: '50%', background: '#c084fc', opacity: 0.7, animation: 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></span>
            <span style={{ position: 'relative', height: '12px', width: '12px', borderRadius: '50%', background: '#a855f7' }}></span>
          </span>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#c084fc', margin: 0 }}>LiveKit Voice Intent</h4>
        </div>
        <span style={{ fontSize: '0.65rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', fontFamily: 'monospace', color: '#94a3b8' }}>Tenant: {tenantId}</span>
      </div>

      <blockquote style={{ marginBottom: '1rem', borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '0.75rem', fontStyle: 'italic', color: '#94a3b8', fontSize: '0.875rem' }}>
        "{voiceIntent}"
      </blockquote>

      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>Staged ERP Next Document (Draft)</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
          <span style={{ color: '#94a3b8' }}>Item SKU:</span>
          <span style={{ fontFamily: 'monospace', color: '#e2e8f0' }}>{deferredPayload.item}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
          <span style={{ color: '#94a3b8' }}>Quantity:</span>
          <span style={{ fontFamily: 'monospace', color: '#e2e8f0' }}>{deferredPayload.qty} units</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
          <span style={{ color: '#94a3b8' }}>Estimated Total:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#34d399' }}>${(deferredPayload.qty * deferredPayload.price).toFixed(2)}</span>
        </div>
      </div>

      {!isConfirmed ? (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            disabled={isPending}
            onClick={handleCommitWrite}
            style={{
              flex: 1,
              borderRadius: '8px',
              background: '#9333ea',
              padding: '0.5rem 1rem',
              textAlign: 'center',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'white',
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1,
              transition: 'all 0.2s'
            }}
          >
            {isPending ? "Writing..." : "Confirm & Commit"}
          </button>
          <button 
            style={{
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)',
              padding: '0.5rem 1rem',
              textAlign: 'center',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Reject
          </button>
        </div>
      ) : (
        <div style={{ borderRadius: '8px', background: 'rgba(6, 78, 59, 0.3)', border: '1px solid rgba(6, 78, 59, 0.5)', padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#34d399', fontWeight: 500 }}>
          ✓ Document securely committed to small_erp via masked API.
        </div>
      )}
    </div>
  );
};

export default VoiceAIConfirmCard;
