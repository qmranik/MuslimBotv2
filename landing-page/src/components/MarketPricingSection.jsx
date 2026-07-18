import React from 'react';
import { motion } from 'framer-motion';
import { Check, Globe2, CircleDollarSign } from 'lucide-react';
import GlassCard from './GlassCard';
import Button from './Button';

const MarketPricingSection = () => {
  return (
    <section id="market" style={{ padding: '8rem 0', position: 'relative' }}>
      <div className="container">
        
        {/* Market Opportunity */}
        <div style={{ marginBottom: '6rem' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 style={{ fontSize: '3rem', marginBottom: '1.5rem', letterSpacing: '-0.03em', textAlign: 'center' }}>
              Built for <span className="text-gradient-accent">Global Scale</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', maxWidth: '700px', margin: '0 auto 5rem auto', textAlign: 'center', fontWeight: '300' }}>
              We are capturing the massive SMB market in emerging economies, focusing initially on Pharmacy and Tech-Retail sectors.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
            <GlassCard style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <Globe2 size={36} style={{ color: '#94a3b8', margin: '0 auto 1.5rem' }} />
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>$78B</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '0.5rem' }}>Total Addressable Market</div>
            </GlassCard>

            <GlassCard style={{ padding: '3rem 2rem', textAlign: 'center' }} glowColor="rgba(59, 130, 246, 0.4)" delay={0.2}>
              <CircleDollarSign size={36} style={{ color: '#3b82f6', margin: '0 auto 1.5rem' }} />
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#60a5fa', letterSpacing: '-0.03em' }}>$6.4B</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '0.5rem' }}>Serviceable Addressable</div>
            </GlassCard>

            <GlassCard style={{ padding: '3rem 2rem', textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }} glowColor="rgba(168, 85, 247, 0.6)" delay={0.4}>
              <div style={{ width: '12px', height: '12px', background: '#c084fc', borderRadius: '50%', margin: '0 auto 1.5rem', boxShadow: '0 0 10px #c084fc' }} />
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#c084fc', letterSpacing: '-0.03em' }}>$120M</div>
              <div style={{ color: '#c084fc', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '0.5rem' }}>3-Year Target (SOM)</div>
            </GlassCard>
          </div>
        </div>

        <div style={{ marginTop: '8rem' }}>
          <h2 style={{ fontSize: '3rem', marginBottom: '1.5rem', letterSpacing: '-0.03em', textAlign: 'center' }}>
            A Whole Team for the <span className="text-gradient">Price of Software</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto 5rem auto', textAlign: 'center', fontWeight: '300' }}>
            Simple, transparent pricing. No per-seat fees.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', alignItems: 'center' }}>
            
            {/* Starter */}
            <GlassCard style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Starter</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>$49<span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/mo</span></div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>The Digital Clerk.</p>
              
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
                <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.95rem' }}><Check size={18} color="#94a3b8" /> Powered by headless ERPNext & small_erp APIs</li>
                <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.95rem' }}><Check size={18} color="#94a3b8" /> Traefik + Authentik secured identity edge</li>
                <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.95rem' }}><Check size={18} color="#94a3b8" /> Omnichannel Text Inbox (Chatwoot)</li>
                <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.95rem' }}><Check size={18} color="#94a3b8" /> Base 5 Agents</li>
              </ul>
              
              <Button variant="glass" style={{ width: '100%' }}>Get Started</Button>
            </GlassCard>

            {/* Growth */}
            <div style={{ position: 'relative', borderRadius: '24px', padding: '1px', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'conic-gradient(from 0deg, transparent 0%, #c084fc 25%, #60a5fa 50%, #c084fc 75%, transparent 100%)', animation: 'rotateGradient 4s linear infinite' }} />
              
              <GlassCard style={{ padding: '3rem 2rem', background: 'var(--bg-base)', border: 'none', transform: 'scale(1)', margin: '1px' }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', background: '#c084fc', color: '#000', padding: '0.25rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', zIndex: 10 }}>MOST POPULAR</div>
                <h3 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Growth</h3>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#c084fc', marginBottom: '0.5rem', letterSpacing: '-0.03em' }}>$149<span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/mo</span></div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>The Digital Manager.</p>
                
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
                  <li style={{ display: 'flex', gap: '0.75rem', fontSize: '1rem' }}><Check size={20} color="#c084fc" /> Everything in Starter</li>
                  <li style={{ display: 'flex', gap: '0.75rem', fontSize: '1rem', fontWeight: '500', color: 'white' }}><Check size={20} color="#c084fc" /> Activates the LiveKit + Gemini Multimodal Voice worker pipeline</li>
                  <li style={{ display: 'flex', gap: '0.75rem', fontSize: '1rem' }}><Check size={20} color="#c084fc" /> Full 21-tool catalog execution via go-orchestrator</li>
                  <li style={{ display: 'flex', gap: '0.75rem', fontSize: '1rem' }}><Check size={20} color="#c084fc" /> Postiz Marketing Automation</li>
                </ul>
                
                <Button variant="accent" style={{ width: '100%', background: '#a855f7' }}>Start Free Trial</Button>
              </GlassCard>
            </div>

            {/* Enterprise */}
            <GlassCard style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Enterprise</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>$399<span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/mo</span></div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>The Digital Executive.</p>
              
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
                <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.95rem' }}><Check size={18} color="#94a3b8" /> Everything in Growth</li>
                <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.95rem' }}><Check size={18} color="#94a3b8" /> Strict per-tenant data isolation and resource allocation</li>
                <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.95rem' }}><Check size={18} color="#94a3b8" /> Local Nextcloud SOP grounding & Vertex RAG knowledge architecture</li>
                <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.95rem' }}><Check size={18} color="#94a3b8" /> Custom n8n MCP integrations</li>
              </ul>
              
              <Button variant="glass" style={{ width: '100%' }}>Talk to Sales</Button>
            </GlassCard>

          </div>
        </div>

      </div>
    </section>
  );
};

export default MarketPricingSection;
