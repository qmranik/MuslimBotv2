import { Sparkles } from 'lucide-react';

export default function AiAssistPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] w-full items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-background">
          <Sparkles size={26} />
        </div>
        <h1 className="text-2xl font-semibold text-primary">AI Assistant</h1>
        <p className="text-sm text-secondary">
          The MuslimBot agent is always available from the floating panel in the
          bottom-right corner. In <span className="text-accent">Agent</span> mode it
          acts across ERP, Chatwoot, and TryPost via MCP tools; switch to{' '}
          <span className="text-accent">Dashboard</span> mode for structured data
          visualizations.
        </p>
      </div>
    </div>
  );
}
