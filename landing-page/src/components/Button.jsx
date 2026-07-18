import React from 'react';
import { motion } from 'framer-motion';
import './components.css';

const Button = ({ children, variant = 'primary', className = '', icon, onClick, ...props }) => {
  const variantClass = {
    primary: 'btn-primary',
    glass: 'btn-glass',
    accent: 'btn-accent'
  }[variant];

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`btn ${variantClass} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
      {icon && <span className="btn-icon">{icon}</span>}
    </motion.button>
  );
};

export default Button;
