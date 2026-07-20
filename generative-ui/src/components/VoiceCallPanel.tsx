'use client';

import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  BarVisualizer,
  useVoiceAssistant,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Loader2, Mic, MicOff, Phone, PhoneOff, RefreshCw } from 'lucide-react';
import { useVoiceSession } from '@/hooks/useVoiceSession';

function AgentVisualizer() {
  const { state, audioTrack } = useVoiceAssistant();
  useRoomContext();

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

function KbContextBadge({
  label,
  roomConnected,
}: {
  label: string | null;
  roomConnected: boolean;
}) {
  const [packetStatus, setPacketStatus] = useState<string | null>(null);
  const room = useRoomContext();

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string
    ) => {
      if (topic && topic !== 'kb-context') return;
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload)) as {
          status?: string;
          generation?: number;
          mode?: string;
        };
        if (parsed.status === 'refreshing') {
          setPacketStatus(
            `Refreshing context${parsed.generation ? ` (gen ${parsed.generation})` : ''}…`
          );
        } else if (parsed.status === 'refreshed') {
          setPacketStatus(
            `Context updated${parsed.generation ? ` · gen ${parsed.generation}` : ''}${
              parsed.mode ? ` · ${parsed.mode}` : ''
            }`
          );
        } else if (parsed.status === 'error') {
          setPacketStatus('Context refresh failed');
        }
      } catch {
        /* ignore non-json */
      }
    };
    room.on('dataReceived', onData);
    return () => {
      room.off('dataReceived', onData);
    };
  }, [room]);

  const text = packetStatus || label;
  if (!text && !roomConnected) return null;
  return (
    <div className="rounded-md bg-surface-hover px-2 py-1 text-[11px] text-secondary">
      {text || (roomConnected ? 'Connected' : null)}
    </div>
  );
}

export interface VoiceCallPanelProps {
  /** When true, render an inline start button (Knowledge / AI pages). */
  showStartButton?: boolean;
  className?: string;
}

/**
 * First-class MuslimBot voice surface: rebuild brief → mint session → LiveKit.
 */
export default function VoiceCallPanel({
  showStartButton = true,
  className = '',
}: VoiceCallPanelProps) {
  const voice = useVoiceSession();
  const [muted, setMuted] = useState(false);

  const busy =
    voice.state === 'refreshing_context' ||
    voice.state === 'connecting' ||
    voice.state === 'reconnecting';

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {showStartButton && !voice.session && (
        <button
          type="button"
          onClick={() => void voice.start('workspace-user')}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:outline-none disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
          {voice.state === 'refreshing_context'
            ? 'Refreshing context…'
            : voice.state === 'connecting' || voice.state === 'reconnecting'
              ? 'Connecting…'
              : 'Call MuslimBot'}
        </button>
      )}

      {voice.contextBadge && !voice.session && (
        <p className="text-xs text-secondary">{voice.contextBadge}</p>
      )}
      {voice.error && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-error">
          <span>{voice.error}</span>
          <button
            type="button"
            onClick={() => void voice.retry()}
            className="inline-flex items-center gap-1 rounded border border-divider px-2 py-0.5 text-xs text-primary"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {voice.session && (
        <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-divider bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-divider bg-surface-hover px-4 py-3">
            <h3 className="text-sm font-semibold text-primary">MuslimBot Voice</h3>
            <button
              type="button"
              onClick={voice.end}
              className="rounded-md p-1 text-secondary hover:text-error focus:ring-2 focus:ring-accent focus:outline-none"
              title="End call"
            >
              <PhoneOff size={16} />
            </button>
          </div>

          <LiveKitRoom
            serverUrl={voice.session.url}
            token={voice.session.token}
            connect
            audio={!muted}
            video={false}
            className="relative flex flex-col items-center bg-background p-6"
            onDisconnected={voice.end}
          >
            <RoomAudioRenderer />
            <KbContextBadge
              label={voice.contextBadge}
              roomConnected={voice.state === 'connected'}
            />
            <div className="mt-3">
              <AgentVisualizer />
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-divider text-primary hover:bg-surface-hover"
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                type="button"
                onClick={voice.end}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error hover:bg-error hover:text-background"
                title="End Call"
              >
                <PhoneOff size={20} />
              </button>
              <button
                type="button"
                onClick={() => void voice.retry()}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-divider text-primary hover:bg-surface-hover"
                title="Reconnect"
              >
                <RefreshCw size={18} />
              </button>
            </div>
            {typeof voice.kbGeneration === 'number' && (
              <p className="mt-3 text-[10px] tracking-wide text-secondary uppercase">
                KB generation {voice.kbGeneration}
              </p>
            )}
          </LiveKitRoom>
        </div>
      )}
    </div>
  );
}
