import React from 'react';
import './globals.css';
import { Inter, Playfair_Display } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { MuslimBotShell } from '../components/MuslimBotShell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata = {
  title: 'MuslimBot Unified Admin OS',
  description: 'AI-Agentic Small Business Operations Control Center',
};

import { AI } from './actions';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfair.variable}`}>
      <body className="w-screen h-screen overflow-hidden antialiased">
        <AI>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <MuslimBotShell>
              {children}
            </MuslimBotShell>
          </ThemeProvider>
        </AI>
      </body>
    </html>
  );
}
