import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import Button from './Button';
import './components.css';

const Header = () => {
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'problem', 'features', 'deep-dive', 'architecture', 'market', 'roadmap'];
      const scrollPosition = window.scrollY + 100; // Offset for header

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const offsetTop = element.offsetTop;
          const height = element.offsetHeight;

          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (e, sectionId) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80, // Account for fixed header height
        behavior: 'smooth'
      });
    }
  };

  return (
    <header className="header">
      <div className="container header-content">
        <motion.div 
          className="logo"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{ cursor: 'pointer' }}
          onClick={(e) => scrollTo(e, 'hero')}
        >
          <Bot className="logo-icon" size={28} />
          <span>MuslimBot</span>
        </motion.div>
        
        <motion.nav 
          className="nav-links"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <a href="#problem" onClick={(e) => scrollTo(e, 'problem')} className={`nav-link ${activeSection === 'problem' ? 'active' : ''}`}>The Problem</a>
          <a href="#features" onClick={(e) => scrollTo(e, 'features')} className={`nav-link ${activeSection === 'features' ? 'active' : ''}`}>Platform</a>
          <a href="#deep-dive" onClick={(e) => scrollTo(e, 'deep-dive')} className={`nav-link ${activeSection === 'deep-dive' ? 'active' : ''}`}>Voice AI</a>
          <a href="#architecture" onClick={(e) => scrollTo(e, 'architecture')} className={`nav-link ${activeSection === 'architecture' ? 'active' : ''}`}>Architecture</a>
          <a href="#market" onClick={(e) => scrollTo(e, 'market')} className={`nav-link ${activeSection === 'market' ? 'active' : ''}`}>Pricing</a>
          <a href="#roadmap" onClick={(e) => scrollTo(e, 'roadmap')} className={`nav-link ${activeSection === 'roadmap' ? 'active' : ''}`}>Roadmap</a>
          <Button variant="accent" style={{ marginLeft: '1rem' }}>Deploy AI</Button>
        </motion.nav>
      </div>
    </header>
  );
};

export default Header;
