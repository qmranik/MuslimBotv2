import React, { useState, useEffect } from 'react';
import { Terminal, Hexagon, Component, Database, Shield, ChevronsRight, Sparkles, Layers, Map, CreditCard } from 'lucide-react';

export function FloatingNav() {
  const [activeSection, setActiveSection] = useState('hero');
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems = [
    { id: 'hero', label: 'Command Center', icon: <Terminal size={18} /> },
    { id: 'problem', label: 'The Problem', icon: <Hexagon size={18} /> },
    { id: 'solution', label: 'Solution', icon: <Component size={18} /> },
    { id: 'generative', label: 'Generative UI', icon: <Sparkles size={18} /> },
    { id: 'ecosystem', label: 'Ecosystem', icon: <Database size={18} /> },
    { id: 'usecases', label: 'Data Flow', icon: <Component size={18} /> },
    { id: 'architecture', label: 'Architecture', icon: <Layers size={18} /> },
    { id: 'roadmap', label: 'Roadmap', icon: <Map size={18} /> },
    { id: 'pricing', label: 'Pricing', icon: <CreditCard size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-50% 0px -50% 0px' }
    );

    navItems.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const handleClick = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav 
      className={`fixed top-1/2 -translate-y-1/2 left-6 z-50 flex flex-col py-4 bg-[#1C1C1E]/80 backdrop-blur-xl rounded-[40px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out ${
        isExpanded ? 'w-64 items-stretch px-4' : 'w-16 items-center px-3'
      }`}
    >
      <div className={`flex flex-col space-y-4 mb-6 ${isExpanded ? 'items-stretch' : 'items-center'}`}>
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          const isHeroActive = isActive && item.id === 'hero';

          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => handleClick(e, item.id)}
              className={`group relative flex items-center p-3 rounded-full transition-all duration-300 ease-in-out ${
                isExpanded ? 'justify-start' : 'justify-center'
              }`}
            >
              <div 
                className={`flex items-center justify-center p-3 rounded-full transition-all duration-300 ease-in-out ${
                  isHeroActive 
                    ? 'bg-[#00FF41]/20 text-[#FFFFFF] border border-[#00FF41]/50 shadow-[0_0_15px_rgba(0,255,65,0.2)]' 
                    : isActive
                      ? 'bg-white/10 text-white'
                      : 'text-[#F5F5F7]/50 group-hover:text-[#F5F5F7] group-hover:bg-white/5'
                }`}
              >
                {item.icon}
              </div>

              {/* Label (Visible when expanded) */}
              <span 
                className={`ml-4 font-medium text-sm text-[#F5F5F7] transition-all duration-300 whitespace-nowrap ${
                  isExpanded ? 'opacity-100 flex' : 'opacity-0 hidden'
                }`}
              >
                {item.label}
              </span>

              {/* Tooltip (Visible only when collapsed and hovered) */}
              {!isExpanded && (
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#111] border border-white/10 rounded-lg text-xs font-medium text-[#F5F5F7] opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-in-out whitespace-nowrap shadow-xl">
                  {item.label}
                </div>
              )}
            </a>
          );
        })}
      </div>

      {/* Expand Nav Icon */}
      <div className={`mt-auto pt-4 pb-2 border-t border-white/10 flex transition-all duration-300 ${isExpanded ? 'justify-end px-2' : 'justify-center w-full px-3'}`}>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 text-[#F5F5F7]/50 hover:text-[#F5F5F7] transition-colors group relative flex items-center justify-center"
        >
          <ChevronsRight size={18} className={`transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180' : 'rotate-0'}`} />
          
          {/* Tooltip for expand (Visible only when collapsed) */}
          {!isExpanded && (
            <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#111] border border-white/10 rounded-lg text-xs font-medium text-[#F5F5F7] opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-xl">
              Expand Tool Box
            </div>
          )}
        </button>
      </div>

    </nav>
  );
}
