import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Server, ShieldCheck, Database, LayoutGrid } from 'lucide-react';
import GlassCard from './GlassCard';

const ArchitectureSection = () => {
  return (
    <section id="architecture" style={{ padding: '6rem 0', position: 'relative' }}>
      <div className="container">
        
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
            Data Sovereignty by Design
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            A 100% open-source stack that you control. Zero vendor lock-in. Your data stays in your infrastructure.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '4rem' }}>
          <GlassCard style={{ padding: '2rem', textAlign: 'center' }} glowColor="rgba(239, 68, 68, 0.4)">
            <ShieldCheck size={40} style={{ color: '#ef4444', margin: '0 auto 1.5rem' }} />
            <h4 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Zero-Trust Edge</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Secured by Traefik and Authentik. Strict rate-limiting and OIDC identity management for all tenants.
            </p>
          </GlassCard>

          <GlassCard style={{ padding: '2rem', textAlign: 'center' }} glowColor="rgba(59, 130, 246, 0.4)" delay={0.2}>
            <Server size={40} style={{ color: '#3b82f6', margin: '0 auto 1.5rem' }} />
            <h4 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>The Go-Orchestrator</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              The central AI brain and API gateway. It safely routes all tool executions and protects your internal APIs.
            </p>
          </GlassCard>

          <GlassCard style={{ padding: '2rem', textAlign: 'center' }} glowColor="rgba(34, 197, 94, 0.4)" delay={0.4}>
            <Database size={40} style={{ color: '#22c55e', margin: '0 auto 1.5rem' }} />
            <h4 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Headless ERPNext</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Your system of record. Inventory, POS, and accounting operate silently behind the Generative UI interface.
            </p>
          </GlassCard>
        </div>

        {/* Animated Flow Diagram */}
        <GlassCard style={{ padding: '3rem', background: 'rgba(5,5,5,0.8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            
            {/* Connection Line */}
            <div style={{ position: 'absolute', left: '10%', right: '10%', top: '50%', height: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }}>
              <motion.div 
                animate={{ x: ['0%', '100%'] }} 
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{ height: '100%', width: '20%', background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)' }}
              />
            </div>

            {/* Nodes */}
            <div style={{ position: 'relative', zIndex: 1, background: 'var(--bg-base)', padding: '1.5rem', borderRadius: '50%', border: '1px solid var(--glass-border)' }}>
              <LayoutGrid size={32} style={{ color: '#a855f7' }} />
            </div>
            
            <div style={{ position: 'relative', zIndex: 1, background: 'var(--bg-base)', padding: '1.5rem', borderRadius: '50%', border: '1px solid var(--glass-border)', boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)' }}>
              <Server size={32} style={{ color: '#3b82f6' }} />
            </div>

            <div style={{ position: 'relative', zIndex: 1, background: 'var(--bg-base)', padding: '1.5rem', borderRadius: '50%', border: '1px solid var(--glass-border)' }}>
              <Database size={32} style={{ color: '#22c55e' }} />
            </div>
            
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>
            <span>Generative UI</span>
            <span>Go Orchestrator</span>
            <span>Headless ERP</span>
          </div>
        </GlassCard>

      </div>
    </section>
  );
};

export default ArchitectureSection;
