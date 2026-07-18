import React from 'react';
import { motion } from 'framer-motion';
import { XCircle, CheckCircle2, Clock, AlertTriangle, MessageSquareOff } from 'lucide-react';
import GlassCard from './GlassCard';

const ProblemSection = () => {
  return (
    <section id="problem" style={{ padding: '8rem 0', position: 'relative' }}>
      <div className="container">
        
        <div style={{ textAlign: 'center', marginBottom: '6rem' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 style={{ fontSize: '3rem', marginBottom: '1.5rem', letterSpacing: '-0.03em' }}>
              Fragmented Stacks <span style={{ color: '#ef4444' }}>Leak Revenue</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto', fontWeight: '300' }}>
              You didn't start a business to do manual data entry. Discover how the old way is costing you time, money, and customers.
            </p>
          </motion.div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'stretch' }}>
          
          {/* The Old Way */}
          <GlassCard style={{ padding: '4rem 3rem', border: '1px solid rgba(239, 68, 68, 0.15)', background: 'rgba(239, 68, 68, 0.02)' }} glowColor="rgba(239, 68, 68, 0.1)">
            <h3 style={{ fontSize: '1.75rem', marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171' }}>
              <XCircle size={28} /> The Old Way
            </h3>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <Clock size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: '#fca5a5' }}>Burned Payroll</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>Teams spend ~60% of their day answering repetitive WhatsApp and IG messages.</p>
                </div>
              </li>
              <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <MessageSquareOff size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: '#fca5a5' }}>Manual Order Entry</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>Orders are manually re-typed from chats into the ERP, causing typos and delays.</p>
                </div>
              </li>
              <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <AlertTriangle size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: '#fca5a5' }}>Inventory Desync</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>Disconnected tools mean your stock is never accurate, leading to overselling.</p>
                </div>
              </li>
            </ul>
          </GlassCard>

          {/* The Agentic Way */}
          <GlassCard style={{ padding: '4rem 3rem', border: '1px solid rgba(34, 197, 94, 0.2)', background: 'linear-gradient(135deg, rgba(20,20,20,0.6) 0%, rgba(6,78,59,0.1) 100%)' }} glowColor="rgba(34, 197, 94, 0.2)" delay={0.2}>
            <h3 style={{ fontSize: '1.75rem', marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#4ade80' }}>
              <CheckCircle2 size={28} /> The Agentic Way
            </h3>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ padding: '4px', background: 'rgba(34, 197, 94, 0.2)', borderRadius: '50%', flexShrink: 0, marginTop: '2px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#4ade80' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: '#86efac' }}>Omnichannel Inbox</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>AI support agent instantly handles FAQs across WhatsApp, FB, and Web.</p>
                </div>
              </li>
              <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ padding: '4px', background: 'rgba(34, 197, 94, 0.2)', borderRadius: '50%', flexShrink: 0, marginTop: '2px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#4ade80' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: '#86efac' }}>Zero-Touch Fulfillment</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>Voice and text orders are automatically extracted and injected into the ERP.</p>
                </div>
              </li>
              <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ padding: '4px', background: 'rgba(34, 197, 94, 0.2)', borderRadius: '50%', flexShrink: 0, marginTop: '2px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#4ade80' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: '#86efac' }}>Live Inventory</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>Inventory deducts in real-time. Single pane of glass for all operations.</p>
                </div>
              </li>
            </ul>
          </GlassCard>

        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
