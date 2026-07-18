import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const UnifiedCommandCenterPreview = () => {
  const [activeTab, setActiveTab] = useState('support');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '24rem',
      width: '100%',
      maxWidth: '42rem',
      overflow: 'hidden',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'var(--bg-base)',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      margin: '0 auto'
    }}>
      {/* GenUI Universal Header & Navigation Pill */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(5, 5, 5, 0.8)',
        padding: '0.75rem 1rem',
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ height: '12px', width: '12px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.8)' }}></div>
            <div style={{ height: '12px', width: '12px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.8)' }}></div>
            <div style={{ height: '12px', width: '12px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.8)' }}></div>
          </div>
          <span style={{ marginLeft: '1rem', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
            MuslimBot / Admin OS
          </span>
        </div>
        
        {/* Navigation Pill */}
        <div style={{
          display: 'flex',
          gap: '4px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.02)',
          padding: '4px'
        }}>
          {['support', 'erp', 'automation'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '0.75rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: activeTab === tab ? '#9333ea' : 'transparent',
                color: activeTab === tab ? '#fff' : 'var(--text-secondary)'
              }}
            >
              {tab === 'support' && 'Omnichannel (Chatwoot)'}
              {tab === 'erp' && 'ERP Hub'}
              {tab === 'automation' && 'Workflows (n8n)'}
            </button>
          ))}
        </div>
      </div>

      {/* Simulated Secure Iframe Content Area */}
      <div style={{ position: 'relative', flex: 1, background: 'rgba(20,20,20,0.3)', padding: 0 }}>
        {/* Generative AI Overlay (The "Brain") */}
        <div style={{
          position: 'absolute',
          bottom: '1rem',
          right: '1rem',
          zIndex: 10,
          width: '18rem',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(15, 23, 42, 0.95)',
          padding: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(16px)'
        }}>
           <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span style={{ height: '8px', width: '8px', borderRadius: '50%', background: '#34d399', animation: 'pulseGlow 2s infinite' }}></span>
             <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399' }}>GenAI Assistant Active</span>
           </div>
           <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
             {activeTab === 'support' && "Analyzing incoming WhatsApp intent... Suggesting zero-cost replacement order."}
             {activeTab === 'erp' && "Extracting sales velocity from small_erp APIs for the last 24 hours."}
             {activeTab === 'automation' && "Validating n8n webhook routing against the 21-tool catalog."}
           </p>
        </div>

        {/* Tab Content Mockups */}
        <div style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed rgba(255,255,255,0.1)',
          color: 'var(--text-muted)'
        }}>
           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               transition={{ duration: 0.2 }}
               style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
             >
               {activeTab === 'support' && "[ Secure Chatwoot Iframe Rendered via X-authentik-user ]"}
               {activeTab === 'erp' && "[ Headless Frappe Sales Dashboard Rendered ]"}
               {activeTab === 'automation' && "[ n8n Canvas Rendered ]"}
             </motion.div>
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default UnifiedCommandCenterPreview;
