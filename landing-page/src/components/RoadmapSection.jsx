import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, FastForward } from 'lucide-react';
import GlassCard from './GlassCard';

const RoadmapSection = () => {
  return (
    <section id="roadmap" style={{ padding: '8rem 0', position: 'relative' }}>
      
      {/* Background decoration */}
      <div style={{ position: 'absolute', bottom: '10%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, rgba(0,0,0,0) 70%)', zIndex: -1 }}></div>

      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
            Built for <span className="text-gradient">Momentum</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            We've already shipped the core foundation. Here's what's live today and what's coming next.
          </p>
        </div>

        <div style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Vertical Line */}
          <div style={{ position: 'absolute', left: '30px', top: '0', bottom: '0', width: '2px', background: 'rgba(255,255,255,0.1)' }} />

          {/* Shipped */}
          <div style={{ position: 'relative', paddingLeft: '80px', marginBottom: '4rem' }}>
            <div style={{ position: 'absolute', left: '16px', top: '0', width: '30px', height: '30px', background: '#22c55e', borderRadius: '50%', border: '4px solid var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Rocket size={14} color="#000" />
            </div>
            
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#4ade80' }}>Shipped</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Live today in production.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <GlassCard style={{ padding: '1.5rem' }} glowColor="rgba(34, 197, 94, 0.2)">
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>ERP Core Foundation</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Full inventory, POS, accounting, and order management running headlessly via ERPNext.</p>
              </GlassCard>
              
              <GlassCard style={{ padding: '1.5rem' }} glowColor="rgba(34, 197, 94, 0.2)">
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Voice AI Agent</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>LiveKit + Gemini WebRTC agent capable of calling 21 distinct ERP tools in real-time.</p>
              </GlassCard>
              
              <GlassCard style={{ padding: '1.5rem' }} glowColor="rgba(34, 197, 94, 0.2)">
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Multi-tenant Infrastructure</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Per-tenant data isolation, zero-trust routing, and scalable architecture (30+ tenants per node).</p>
              </GlassCard>
            </div>
          </div>

          {/* Next */}
          <div style={{ position: 'relative', paddingLeft: '80px' }}>
            <div style={{ position: 'absolute', left: '16px', top: '0', width: '30px', height: '30px', background: '#3b82f6', borderRadius: '50%', border: '4px solid var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FastForward size={14} color="#000" />
            </div>
            
            <div style={{ position: 'relative', marginBottom: '2rem' }}>
              <div style={{ position: 'absolute', top: 0, left: '-2.4rem', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-base)', border: '4px solid #94a3b8', zIndex: 10 }}></div>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', fontWeight: 'bold' }}>Next Up (W1)</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>One Identity</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Consolidating all authentication surfaces (staff, mobile, customers) under Authentik with single sign-out.</p>
            </div>
            
            <div style={{ position: 'relative', marginBottom: '2rem' }}>
              <div style={{ position: 'absolute', top: 0, left: '-2.4rem', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-base)', border: '4px solid #94a3b8', zIndex: 10 }}></div>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', fontWeight: 'bold' }}>Next Up (W5)</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Enterprise Observability</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Deploying OpenTelemetry, Prometheus, Grafana, Loki, and Sentry for deep system health tracking.</p>
            </div>
            
            <div style={{ position: 'relative', marginBottom: '2rem' }}>
              <div style={{ position: 'absolute', top: 0, left: '-2.4rem', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-base)', border: '4px solid #94a3b8', zIndex: 10 }}></div>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', fontWeight: 'bold' }}>Next Up (W4)</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Automated DR & Tenancy</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Enforcing strict orchestrator-level TenantUserMapping and 24h RPO / 4h RTO automated database backup drills.</p>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
};

export default RoadmapSection;
