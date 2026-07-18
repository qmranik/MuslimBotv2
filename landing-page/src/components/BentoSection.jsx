import React from 'react';
import { motion } from 'framer-motion';
import { Headphones, ShoppingCart, TrendingUp, PieChart } from 'lucide-react';
import GlassCard from './GlassCard';

const BentoSection = () => {
  return (
    <section id="features" style={{ padding: '6rem 0', position: 'relative' }}>
      
      {/* Background decoration */}
      <div style={{ position: 'absolute', top: '20%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)', zIndex: -1 }}></div>

      <div className="container">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '6rem' }}
        >
          <h2 style={{ fontSize: '3rem', marginBottom: '1.5rem', letterSpacing: '-0.03em' }}>Meet Your New <span className="text-gradient">Digital Workforce</span></h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto', fontWeight: '300' }}>
            Stop buying software seats. Hire autonomous AI agents that work inside your ERP, 24/7, across every channel.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem', gridAutoRows: 'minmax(280px, auto)' }}>
          
          {/* The Support Agent (Large) */}
          <GlassCard className="col-span-8" style={{ gridColumn: 'span 8', padding: '3rem', display: 'flex', flexDirection: 'column', background: 'linear-gradient(145deg, rgba(30,30,30,0.4) 0%, rgba(10,10,10,0.6) 100%)' }} glowColor="rgba(168, 85, 247, 0.4)">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(168, 85, 247, 0.2)', borderRadius: '12px', color: '#c084fc' }}>
                <Headphones size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.5rem', margin: 0 }}>The Support Agent</h3>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Omnichannel Inbox (WhatsApp, IG, Web)</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', flex: 1 }}>
              Instantly answers FAQs and checks live stock across every channel. If a customer is angry or the issue is complex, it automatically flips the conversation to your human team.
            </p>
            {/* Visual simulation */}
            <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#c084fc', marginBottom: '0.5rem' }}>WhatsApp Customer</div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'inline-block' }}>Do you have the iPhone 15 Pro in stock?</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: 'rgba(168, 85, 247, 0.2)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem', border: '1px solid rgba(168, 85, 247, 0.3)' }}>Yes, we have 4 units left at the downtown branch. Would you like me to hold one?</div>
              </div>
            </div>
          </GlassCard>

          {/* The Order Clerk (Medium) */}
          <GlassCard className="col-span-4" style={{ gridColumn: 'span 4', padding: '3rem', display: 'flex', flexDirection: 'column' }} glowColor="rgba(34, 197, 94, 0.4)" delay={0.2}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(34, 197, 94, 0.2)', borderRadius: '12px', color: '#4ade80' }}>
                <ShoppingCart size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>The Order Clerk</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', flex: 1, fontSize: '0.95rem' }}>
              Extracts orders from phone calls (Voice AI) and texts, injecting them directly into the ERP. Inventory deducts in real-time. Zero typos.
            </p>
          </GlassCard>

          {/* The Marketing Manager (Medium) */}
          <GlassCard className="col-span-5" style={{ gridColumn: 'span 5', padding: '3rem', display: 'flex', flexDirection: 'column' }} glowColor="rgba(249, 115, 22, 0.4)" delay={0.3}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(249, 115, 22, 0.2)', borderRadius: '12px', color: '#fb923c' }}>
                <TrendingUp size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>The Marketing Manager</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', flex: 1, fontSize: '0.95rem' }}>
              Watches your top-sellers, auto-creates promotional copy and image prompts, and schedules posts across X, LinkedIn, and Instagram.
            </p>
          </GlassCard>

          {/* The Analyst (Large) */}
          <GlassCard className="col-span-7" style={{ gridColumn: 'span 7', padding: '3rem', display: 'flex', flexDirection: 'column' }} delay={0.4}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '12px', color: '#60a5fa' }}>
                <PieChart size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.5rem', margin: 0 }}>The Analyst</h3>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Generative CEO Dashboard</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              Ask your data in plain English. The AI generates live React charts and tables grounded in your real ERP data. Decisions based on numbers, not gut feelings.
            </p>
          </GlassCard>

        </div>
      </div>
    </section>
  );
};

export default BentoSection;
