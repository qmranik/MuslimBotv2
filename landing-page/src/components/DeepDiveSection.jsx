import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { PhoneCall, Database, AudioWaveform } from 'lucide-react';
import GlassCard from './GlassCard';
import VoiceAIConfirmCard from './VoiceAIConfirmCard';

const DeepDiveSection = () => {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  const waveHeight1 = useTransform(scrollYProgress, [0.3, 0.5, 0.7], ["20%", "90%", "20%"]);
  const waveHeight2 = useTransform(scrollYProgress, [0.3, 0.55, 0.7], ["20%", "70%", "20%"]);
  const waveHeight3 = useTransform(scrollYProgress, [0.3, 0.45, 0.7], ["20%", "100%", "20%"]);
  const waveHeight4 = useTransform(scrollYProgress, [0.3, 0.6, 0.7], ["20%", "85%", "20%"]);

  return (
    <section ref={sectionRef} id="deep-dive" style={{ padding: '10rem 0', position: 'relative', overflow: 'hidden' }}>
      
      {/* Background decoration */}
      <div style={{ position: 'absolute', top: '50%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, rgba(0,0,0,0) 70%)', transform: 'translateY(-50%)', zIndex: -1 }}></div>

      <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
        
        {/* Left Column: Visual */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <GlassCard style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(10,10,10,0.8)' }} glowColor="rgba(168, 85, 247, 0.4)">
            
            {/* Caller */}
            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <PhoneCall size={32} style={{ color: '#c084fc' }} />
            </div>

            <div style={{ position: 'relative', marginTop: '1rem' }}>
              <VoiceAIConfirmCard />
            </div>

          </GlassCard>
        </motion.div>

        {/* Right Column: Copy */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '20px', color: '#c084fc', fontSize: '0.875rem', marginBottom: '1.5rem', fontWeight: '500' }}>
            <AudioWaveform size={16} />
            <span>Autonomous Voice-to-Order</span>
          </div>

          <h2 style={{ fontSize: '3rem', marginBottom: '1.5rem', letterSpacing: '-0.03em' }}>
            Speak Directly to Your <span className="text-gradient">ERP.</span>
          </h2>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', marginBottom: '2.5rem', lineHeight: 1.6, fontWeight: '300' }}>
            Powered by WebRTC (LiveKit) and Gemini 2.0 Flash, our Voice Agent natively supports "barge-in" interruption handling and contextual room metadata injection. 
            <br/><br/>
            Crucially, it is constrained by a strict "Confirm-before-write" safeguard in the SecurePortal, ensuring AI can stage data but never mutate the System of Record without human approval.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-primary)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c084fc' }} />
              Real-time conversational latency (&lt; 800ms)
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-primary)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c084fc' }} />
              Checks live inventory before committing
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-primary)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c084fc' }} />
              Generates sales orders instantly, hands-free
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-primary)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c084fc' }} />
              Automatically sends confirmation SMS/WhatsApp via Chatwoot
            </li>
          </ul>
        </motion.div>

      </div>
    </section>
  );
};

export default DeepDiveSection;
