import "./globals.css";

export const metadata = {
  title: "Small ERP CommandCenter",
  description: "AI-Agentic Small Business Operations Control Center",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-900 text-slate-100 flex flex-col select-none antialiased">
        <div id="root" className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
