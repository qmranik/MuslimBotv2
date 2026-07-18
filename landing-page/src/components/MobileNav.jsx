import React, { useState, useEffect } from 'react';
import { Terminal, Database, Component, Sparkles, Map, ChevronsRight } from 'lucide-react';

export function MobileNav() {
  const [activeSection, setActiveSection] = useState('hero');
  const [isOpen, setIsOpen] = useState(false);

  const primaryItems = [
    { id: 'hero', label: 'Command', icon: <Terminal size={18} /> },
    { id: 'generative', label: 'GenUI', icon: <Sparkles size={18} /> },
    { id: 'usecases', label: 'Data', icon: <Component size={18} /> },
    { id: 'ecosystem', label: 'Eco', icon: <Database size={18} /> },
  ];

  const secondaryItems = [
    { id: 'architecture', label: 'Architecture' },
    { id: 'roadmap', label: 'Roadmap' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'security', label: 'Security' },
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

    [...primaryItems, ...secondaryItems].forEach(({ id }) => {
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
    setIsOpen(false);
  };

  return (
    <>
      {/* Spacer for bottom nav */}
      <div className="h-20 md:hidden block"></div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0A0A0A]/90 backdrop-blur-xl border-t border-white/10 pb-safe">
        
        {/* Secondary Expanded Menu */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-48 border-b border-white/5' : 'max-h-0'}`}>
          <div className="p-4 grid grid-cols-2 gap-2 bg-[#1C1C1E]/50">
            {secondaryItems.map(item => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                className={`py-2 px-4 rounded-lg text-sm font-medium text-center transition-colors ${
                  activeSection === item.id 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-white/5 text-[#F5F5F7]/70 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Primary Bottom Bar */}
        <div className="flex justify-between items-center px-2 py-3">
          {primaryItems.map(item => {
            const isActive = activeSection === item.id;
            const isHeroActive = isActive && item.id === 'hero';

            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                className="flex flex-col items-center justify-center flex-1 px-1"
              >
                <div 
                  className={`p-2 rounded-full transition-all duration-300 ${
                    isHeroActive
                      ? 'bg-[#00FF41]/20 text-[#FFFFFF] border border-[#00FF41]/50 shadow-[0_0_15px_rgba(0,255,65,0.2)]'
                      : isActive
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'text-[#F5F5F7]/50 border border-transparent hover:bg-white/5'
                  }`}
                >
                  {item.icon}
                </div>
                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-white' : 'text-[#F5F5F7]/50'}`}>
                  {item.label}
                </span>
              </a>
            );
          })}

          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex flex-col items-center justify-center flex-1 px-1 group"
          >
            <div className="p-2 rounded-full text-[#F5F5F7]/50 group-hover:bg-white/5 border border-transparent transition-all">
              <ChevronsRight size={18} className={`transition-transform duration-300 ${isOpen ? '-rotate-90 text-white' : 'rotate-[-90deg]'}`} />
            </div>
            <span className="text-[10px] mt-1 font-medium text-[#F5F5F7]/50">More</span>
          </button>

        </div>
      </nav>
    </>
  );
}
