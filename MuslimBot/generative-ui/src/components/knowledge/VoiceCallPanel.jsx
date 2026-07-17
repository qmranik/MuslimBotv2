"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Loader2 } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { createVoiceSession } from '../../services/kbClient';

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || '';

export function VoiceCallPanel() {
  const roomRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  const cleanupRoom = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    setAgentSpeaking(false);
    setStatus('idle');
  }, []);

  useEffect(() => () => { cleanupRoom(); }, [cleanupRoom]);

  const startCall = async () => {
    setError('');
    setStatus('connecting');
    try {
      const session = await createVoiceSession();
      const wsUrl = LIVEKIT_URL || session.url;
      if (!wsUrl) throw new Error('LiveKit URL is not configured (VITE_LIVEKIT_URL).');
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.id = 'muslimbot-agent-audio';
          document.body.appendChild(el);
          setAgentSpeaking(true);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
        setAgentSpeaking(false);
      });
      room.on(RoomEvent.Disconnected, () => {
        setStatus('idle');
        setAgentSpeaking(false);
      });
      await room.connect(wsUrl, session.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setMicEnabled(true);
      setStatus('in_call');
    } catch (err) {
      setError(err.message);
      setStatus('error');
      await cleanupRoom();
    }
  };

  const endCall = async () => { await cleanupRoom(); };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  };

  return (
    <div className="panel-card rounded-xl border-emerald-200/80 flex flex-col h-full min-h-[200px]">
      <div className="p-3 border-b border-slate-200">
        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-emerald-600" />
          Voice Agent
        </h3>
      </div>
      <div className="flex-grow flex flex-col items-center justify-center p-4 gap-3">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${
          status === 'in_call'
            ? agentSpeaking ? 'border-emerald-400 bg-emerald-50 animate-pulse' : 'border-emerald-300 bg-emerald-50/50'
            : 'border-slate-200 bg-slate-50'
        }`}>
          {status === 'connecting' ? (
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          ) : (
            <Mic className={`w-6 h-6 ${status === 'in_call' ? 'text-emerald-600' : 'text-slate-400'}`} />
          )}
        </div>
        <p className="text-[10px] text-slate-500 capitalize">{status.replace('_', ' ')}</p>
        {error && <p className="text-[10px] text-rose-600 text-center">{error}</p>}
        <div className="flex gap-2">
          {status === 'in_call' ? (
            <>
              <button type="button" onClick={toggleMic} className="p-2 rounded-full bg-slate-100 text-slate-700">
                {micEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={endCall} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-bold flex items-center gap-1">
                <PhoneOff className="w-3.5 h-3.5" />
                End
              </button>
            </>
          ) : (
            <button type="button" onClick={startCall} disabled={status === 'connecting'} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-40">
              {status === 'connecting' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
              Call Muslimbot
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
