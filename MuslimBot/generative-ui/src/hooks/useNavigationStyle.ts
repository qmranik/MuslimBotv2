import { useState, useEffect } from 'react';

export function useNavigationStyle() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkMobile();
    
    // Listen for resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return {
    isMobile,
    pillClass: isMobile
      ? 'fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-row w-[90%] max-w-[400px] justify-around z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-2xl rounded-full p-3 border border-slate-200 dark:border-gray-800'
      : 'fixed left-6 top-1/2 -translate-y-1/2 flex flex-col justify-center z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-2xl rounded-full p-3 py-6 space-y-6 border border-slate-200 dark:border-gray-800',
  };
}
