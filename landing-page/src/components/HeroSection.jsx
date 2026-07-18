import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Sparkles, MessageSquare, ArrowRight, BarChart3, ChevronRight } from 'lucide-react';
import Button from './Button';
import UnifiedCommandCenterPreview from './UnifiedCommandCenterPreview';

const HeroSection = () => {
  const [chatStep, setChatStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setChatStep(1), 1000); // User asks question
    const timer2 = setTimeout(() => setChatStep(2), 2500); // Bot replies
    const timer3 = setTimeout(() => setChatStep(3), 3500); // Chart renders
    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
  }, []);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const yPos = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacityVal = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={heroRef} id="hero" className="hero-section" style={{ paddingTop: '140px', paddingBottom: '100px', minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '5rem', alignItems: 'center' }}>
        
        {/* Left Column: Copy */}
        <motion.div
          style={{ y: yPos, opacity: opacityVal }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '20px', color: '#60a5fa', fontSize: '0.875rem', marginBottom: '1.5rem', fontWeight: '500' }}>
            <Sparkles size={16} />
            <span>The Future of Enterprise is Headless</span>
          </div>
          
          <h1 style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>
            Stop Managing Software.<br/>
            <span className="text-gradient-accent">Start Managing Outcomes.</span>
          </h1>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', marginBottom: '2.5rem', maxWidth: '90%' }}>
            MuslimBot is the world's first open-source AI-Agentic ERP. It autonomously answers customers, processes voice orders, and runs your marketing—all through a single pane of glass.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Button variant="accent" icon={<ArrowRight size={18} />}>
              Hire Your Digital Workforce
            </Button>
            <Button variant="glass">
              Watch the Demo
            </Button>
          </div>
          
          <div style={{ marginTop: '3rem', display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '-10px' }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ width: '32px', height: '32px', borderRadius: '50%', background: `linear-gradient(135deg, #3b82f6 ${i*20}%, #1e1b4b)`, border: '2px solid var(--bg-base)', zIndex: 5-i, marginLeft: i>1 ? '-10px' : '0' }} />
              ))}
            </div>
            <span>Trusted by forward-thinking digital businesses.</span>
          </div>
        </motion.div>

        {/* Right Column: Unified Command Center Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative' }}
        >
          {/* Background glowing orb specific to hero */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120%', height: '120%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(168,85,247,0.15) 50%, transparent 70%)', zIndex: -1, filter: 'blur(40px)' }}></div>
          
          <UnifiedCommandCenterPreview />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
