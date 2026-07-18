import React from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import ProblemSection from './components/ProblemSection';
import BentoSection from './components/BentoSection';
import DeepDiveSection from './components/DeepDiveSection';
import ArchitectureSection from './components/ArchitectureSection';
import MarketPricingSection from './components/MarketPricingSection';
import RoadmapSection from './components/RoadmapSection';
import CTASection from './components/CTASection';

function App() {
  return (
    <>
      {/* Ambient Animated Orbs */}
      <div className="ambient-orb orb-1"></div>
      <div className="ambient-orb orb-2"></div>
      <div className="ambient-orb orb-3"></div>

      <Header />
      <main>
        {/* IDs must match the Header's scrollspy targets */}
        <div id="hero"><HeroSection /></div>
        <div id="problem"><ProblemSection /></div>
        <div id="features"><BentoSection /></div>
        <div id="deep-dive"><DeepDiveSection /></div>
        <div id="architecture"><ArchitectureSection /></div>
        <div id="market"><MarketPricingSection /></div>
        <div id="roadmap"><RoadmapSection /></div>
        <CTASection />
      </main>
    </>
  );
}

export default App;
