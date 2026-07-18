import React, { useEffect } from 'react';
import { BrandHeader } from './components/BrandHeader';
import { FloatingNav } from './components/FloatingNav';
import { MobileNav } from './components/MobileNav';
import { SystemStatus } from './components/SystemStatus';
import HeroSection from './components/sections/HeroSection';
import ProblemSection from './components/sections/ProblemSection';
import SolutionSection from './components/sections/SolutionSection';
import GenerativeUISection from './components/sections/GenerativeUISection';
import EcosystemSection from './components/sections/EcosystemSection';
import UseCasesSection from './components/sections/UseCasesSection';
import ArchitectureSection from './components/sections/ArchitectureSection';
import RoadmapSection from './components/sections/RoadmapSection';
import PricingSection from './components/sections/PricingSection';
import SecuritySection from './components/sections/SecuritySection';
import CTASection from './components/sections/CTASection';

export default function App() {
  
  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty('--x', `${x}%`);
      document.documentElement.style.setProperty('--y', `${y}%`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] bg-neo-grid font-sans text-[#F5F5F7] selection:bg-white/20 selection:text-white">
      {/* Hardware-accelerated Flashlight Overlay */}
      <div className="flashlight-overlay"></div>

      {/* Decoupled Floating Navigation Components */}
      <BrandHeader />
      <div className="hidden md:block">
        <FloatingNav />
      </div>
      <SystemStatus />

      {/* Main Scrolling Content */}
      <main className="flex flex-col relative z-10 md:pl-32 pr-0 md:pr-12 pt-24 transition-all duration-300 ease-in-out w-full">
        <HeroSection id="hero" />
        <ProblemSection id="problem" />
        <SolutionSection id="solution" />
        <GenerativeUISection id="generative" />
        <EcosystemSection id="ecosystem" />
        <UseCasesSection id="usecases" />
        <ArchitectureSection id="architecture" />
        <RoadmapSection id="roadmap" />
        <PricingSection id="pricing" />
        <SecuritySection id="security" />
        <CTASection id="cta" />
      </main>

      <MobileNav />
    </div>
  );
}
