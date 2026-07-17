'use client';

import React, { useState } from 'react';
import { Phone, PhoneOff, Loader2, AlertCircle } from 'lucide-react';
import { LiveKitRoom, RoomAudioRenderer, VoiceAssistantControlBar } from '@livekit/components-react';
import '@livekit/components-styles';

export function VoiceCallButton() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Fetch token from Go Orchestrator
      const res = await fetch('/v1/voice/token?source=Web+App+(Generative+UI)', {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Failed to fetch voice token');
      
      const data = await res.json();
      setToken(data.token);
      setServerUrl(data.url || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://dummy.livekit.cloud');
      setConnected(true);
    } catch (e) {
      console.error('Failed to connect to voice agent', e);
      setError('Failed to connect. Check network.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 px-3 py-1 rounded-full text-xs font-medium shadow-sm flex items-center gap-1.5 animate-in fade-in slide-in-from-right-4">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
      {!connected ? (
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-70 disabled:hover:scale-100"
        >
          {connecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
          <span className="font-semibold text-sm">{connecting ? 'Connecting...' : 'Call Support'}</span>
        </button>
      ) : (
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full shadow-lg transition-all duration-300"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="font-semibold text-sm">End Call</span>
          </button>
          
          <LiveKitRoom
            serverUrl={serverUrl}
            token={token}
            connect={connected}
            onDisconnected={handleDisconnect}
            className="hidden" // Hiding the default UI since we only want audio
          >
            <RoomAudioRenderer />
            {/* The VoiceAssistantControlBar can be shown if you want visual feedback of the agent speaking */}
          </LiveKitRoom>
        </div>
      )}
    </div>
  );
}
