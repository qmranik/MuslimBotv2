import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import AiChatPanel from "@/components/AiChatPanel";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "liteERP Command Center",
  description: "MuslimBot / liteERP Command Center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="min-h-screen bg-background text-primary font-sans flex">
          <Sidebar />

          {/* Main Content Area */}
          <main className="ml-[120px] flex-1 w-full bg-background text-primary overflow-y-auto p-6 lg:p-10 max-w-full">
            {children}
          </main>

          {/* Floating AI Chat — persists across every route, floats above iframes */}
          <AiChatPanel />

          {/* Voice Call Overlay */}
          <VoiceCallOverlay />
        </div>
      </body>
    </html>
  );
}
