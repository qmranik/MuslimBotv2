'use client';

/**
 * Legacy overlay listener for `muslimbot:voice-session` custom events.
 * Prefer VoiceCallPanel (rebuild-before-session) on Knowledge / AI pages.
 * Kept so external triggers can still open a LiveKit room.
 */

import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  BarVisualizer,
  useVoiceAssistant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { PhoneOff, Loader2 } from 'lucide-react';
import type { VoiceSessionResponse } from '@/lib/api';

function AgentVisualizer() {
  const { state, audioTrack } = useVoiceAssistant();

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-16 items-center justify-center">
        {state === 'speaking' || state === 'listening' ? (
          <BarVisualizer
            state={state}
            barCount={5}
            trackRef={audioTrack}
            className="h-10 text-accent"
          />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-secondary" />
        )}
      </div>
      <p className="mt-2 text-[10px] font-semibold tracking-widest text-secondary uppercase">
        {state}
      </p>
    </div>
  );
}

export default function VoiceCallOverlay() {
  const [session, setSession] = useState<VoiceSessionResponse | null>(null);

  useEffect(() => {
    const handleVoiceSession = (e: Event) => {
      const customEvent = e as CustomEvent<VoiceSessionResponse>;
      setSession(customEvent.detail);
    };

    window.addEventListener('muslimbot:voice-session', handleVoiceSession);
    return () => {
      window.removeEventListener('muslimbot:voice-session', handleVoiceSession);
    };
  }, []);

  if (!session) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[60] flex w-72 flex-col overflow-hidden rounded-2xl border border-divider bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-divider bg-surface-hover px-4 py-3">
        <h3 className="text-sm font-semibold text-primary">MuslimBot Voice</h3>
        <button
          type="button"
          onClick={() => setSession(null)}
          className="rounded-md p-1 text-secondary hover:text-error focus:ring-2 focus:ring-accent focus:outline-none"
        >
          <PhoneOff size={16} />
        </button>
      </div>

      <LiveKitRoom
        serverUrl={session.url}
        token={session.token}
        connect
        audio
        video={false}
        className="relative flex flex-col items-center bg-background p-6"
        onDisconnected={() => setSession(null)}
      >
        <RoomAudioRenderer />
        <AgentVisualizer />
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setSession(null)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error hover:bg-error hover:text-background"
            title="End Call"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </LiveKitRoom>
    </div>
  );
}
