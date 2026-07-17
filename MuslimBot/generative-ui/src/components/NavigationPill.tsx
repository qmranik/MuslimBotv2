'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun, Home, BookOpen, Server, Sparkles } from 'lucide-react';
import { useNavigationStyle } from '../hooks/useNavigationStyle';

export function NavigationPill() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { pillClass, isMobile } = useNavigationStyle();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const navItems = [
    { name: 'Home', href: '/command-center', icon: Home, matchPrefix: '/command-center' },
    { name: 'Knowledge Base', href: '/knowledge-hub', icon: BookOpen, matchPrefix: '/knowledge-hub' },
    { name: 'Systems', href: '/erp-orders', icon: Server, matchPrefix: '/erp-' },
    { name: 'Generative AI', href: '/generative', icon: Sparkles, matchPrefix: '/generative' },
    { name: 'Canvas', href: '/canvas', icon: Sparkles, matchPrefix: '/canvas' },
  ];

  return (
    <nav className={pillClass}>
      <button 
        onClick={toggleTheme} 
        className="p-3 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
        title="Toggle Theme"
      >
        {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <div className="flex flex-row md:flex-col items-center justify-center gap-4 md:gap-6">
        {navItems.filter(i => i.name !== 'Generative AI').map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.matchPrefix) || (pathname === '/' && item.name === 'Home');
          
          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={`p-3 rounded-full transition-all duration-300 ${
                isActive 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' 
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon size={24} />
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-center">
        {navItems.filter(i => i.name === 'Generative AI').map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.matchPrefix);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={`p-3 rounded-full transition-all duration-300 flex items-center justify-center ${
                isActive 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' 
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon size={24} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

