import React from 'react';
import { motion } from 'framer-motion';
import './components.css'; // We'll create this next for component specific css

const GlassCard = ({ children, className = '', glowColor = 'rgba(59, 130, 246, 0.5)', delay = 0, hover = true, ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className={`glass-panel ${hover ? 'glass-panel-hover' : ''} ${className}`}
      style={{ '--accent-glow': glowColor }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
