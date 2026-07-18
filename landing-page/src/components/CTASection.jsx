import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Button from './Button';
import GlassCard from './GlassCard';

const CTASection = () => {
  return (
    <section style={{ padding: '8rem 0 4rem 0' }}>
      <div className="container">
        <GlassCard 
          style={{ 
            padding: '4rem 2rem', 
            textAlign: 'center', 
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8) 0%, rgba(5, 5, 5, 0.9) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}
          glowColor="rgba(99, 102, 241, 0.5)"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>
              Ready to step into the <span className="text-gradient">Agentic Era?</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto 3rem auto' }}>
              Join the forward-thinking businesses that replaced manual admin work with intelligent, autonomous execution.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <Button variant="accent" icon={<ArrowRight size={18} />} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
                Schedule Your Live Demo
              </Button>
            </div>
          </motion.div>
        </GlassCard>

        <footer style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          <div>© {new Date().getFullYear()} MuslimBot. All rights reserved.</div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <a href="#" className="nav-link">Privacy Policy</a>
            <a href="#" className="nav-link">Terms of Service</a>
            <a href="#" className="nav-link">GitHub</a>
          </div>
        </footer>
      </div>
    </section>
  );
};

export default CTASection;
