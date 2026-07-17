import React from "react";
import "./globals.css";
import Sidebar from "../components/Sidebar";

export const metadata = {
  title: "MuslimBot Unified Admin OS",
  description: "AI-Agentic Small Business Operations Control Center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="w-screen h-screen overflow-hidden flex bg-[#090D16] text-white select-none antialiased">
        {/* Left Column: Navigation Drawer */}
        <Sidebar />

        {/* Right Column: Flexible Operational Body Area */}
        <main className="flex-1 h-full overflow-y-auto bg-slate-950/20 relative">
          {children}
        </main>
      </body>
    </html>
  );
}
