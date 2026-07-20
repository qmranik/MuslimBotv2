'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  kbRebuildVoiceBrief,
  kbVoiceSession,
  type VoiceSessionResponse,
} from '@/lib/api';

export type VoiceCallState =
  | 'idle'
  | 'refreshing_context'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface UseVoiceSessionResult {
  state: VoiceCallState;
  session: VoiceSessionResponse | null;
  error: string | null;
  contextBadge: string | null;
  kbGeneration: number | null;
  start: (participantName?: string) => Promise<void>;
  end: () => void;
  retry: () => Promise<void>;
}

/**
 * Owns rebuild-before-session ordering and session lifecycle for MuslimBot voice.
 * LiveKit Room connection is handled by VoiceCallPanel / LiveKitRoom.
 */
export function useVoiceSession(): UseVoiceSessionResult {
  const [state, setState] = useState<VoiceCallState>('idle');
  const [session, setSession] = useState<VoiceSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextBadge, setContextBadge] = useState<string | null>(null);
  const [kbGeneration, setKbGeneration] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastParticipantRef = useRef('workspace-user');

  const cleanup = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async (participantName = 'workspace-user') => {
    lastParticipantRef.current = participantName;
    cleanup();
    const ac = new AbortController();
    abortRef.current = ac;
    setError(null);
    setState('refreshing_context');
    setContextBadge('Refreshing knowledge context…');
    try {
      const brief = await kbRebuildVoiceBrief(ac.signal);
      if (typeof brief.kb_generation === 'number') {
        setKbGeneration(brief.kb_generation);
      }
      setState('connecting');
      setContextBadge('Connecting to MuslimBot…');
      const next = await kbVoiceSession(participantName, ac.signal);
      if (typeof next.kb_generation === 'number') {
        setKbGeneration(next.kb_generation);
      }
      setSession(next);
      setState('connected');
      setContextBadge(
        typeof next.kb_generation === 'number'
          ? `Context gen ${next.kb_generation}`
          : 'Connected'
      );
    } catch (err) {
      if (ac.signal.aborted) {
        setState('disconnected');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to start voice session');
      setState('error');
      setContextBadge(null);
      setSession(null);
    }
  }, [cleanup]);

  const end = useCallback(() => {
    cleanup();
    setSession(null);
    setState('disconnected');
    setContextBadge(null);
  }, [cleanup]);

  const retry = useCallback(async () => {
    setState('reconnecting');
    await start(lastParticipantRef.current);
  }, [start]);

  return {
    state,
    session,
    error,
    contextBadge,
    kbGeneration,
    start,
    end,
    retry,
  };
}
