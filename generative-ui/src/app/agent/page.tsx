'use client';

import { Sparkles } from 'lucide-react';
import VoiceCallPanel from '@/components/VoiceCallPanel';

export default function AiAssistPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] w-full items-center justify-center p-6">
      <div className="flex max-w-lg flex-col items-center gap-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-background">
          <Sparkles size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-primary">AI Assistant</h1>
          <p className="mt-2 text-sm text-secondary">
            The MuslimBot agent is available from the floating panel and as a first-class
            voice call. Voice sessions rebuild tenant knowledge context before connecting
            to LiveKit, and refresh mid-call when the knowledge base changes.
          </p>
        </div>
        <VoiceCallPanel showStartButton />
      </div>
    </div>
  );
}
