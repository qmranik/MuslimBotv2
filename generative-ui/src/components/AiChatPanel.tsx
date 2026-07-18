'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  User,
  Minimize2,
  Copy,
  AlertTriangle,
  Loader2,
  Maximize2,
  Wrench,
  LayoutDashboard,
} from 'lucide-react';
import GenerativeRenderer from './GenerativeRenderer';
import type { UiDescriptor, ChatHistoryEntry } from '@/lib/api';
import { generateUI, aiChat } from '@/lib/api';

/* ──────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────── */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** If the AI returned a structured UiDescriptor, store it here */
  descriptor?: UiDescriptor;
  /** Whether the response errored */
  isError?: boolean;
}

/* ──────────────────────────────────────────────
   INITIAL MESSAGE
   ────────────────────────────────────────────── */

const welcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Welcome to the MuslimBot Command Center. I can query your ERP data, manage support conversations via Chatwoot, schedule social posts via TryPost, and search your knowledge base. How can I help?',
  timestamp: new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }),
};

/* ──────────────────────────────────────────────
   QUICK SUGGESTIONS
   ────────────────────────────────────────────── */

const suggestions = [
  'Show me today\'s sales summary',
  'List overdue invoices',
  'Check low stock items',
  'Search knowledge base',
];

/* ──────────────────────────────────────────────
   SUBCOMPONENTS
   ────────────────────────────────────────────── */

function ChatBubble({
  message,
  onCopy,
}: {
  message: ChatMessage;
  onCopy?: (text: string) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-accent-muted text-accent'
            : message.isError
              ? 'bg-error/20 text-error'
              : 'bg-accent text-background'
        }`}
      >
        {isUser ? (
          <User size={14} />
        ) : message.isError ? (
          <AlertTriangle size={14} />
        ) : (
          <Sparkles size={14} />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`group relative max-w-[85%] space-y-1 ${isUser ? 'items-end' : ''}`}
      >
        {/* If we have a structured descriptor, render it */}
        {!isUser && message.descriptor && !message.isError ? (
          <div className="rounded-2xl rounded-tl-sm border border-divider bg-surface-hover p-3">
            {/* Text explanation above the generative component */}
            {message.descriptor.explanation &&
              message.descriptor.component !== 'text' && (
                <p className="mb-3 text-sm text-primary">
                  {message.descriptor.explanation}
                </p>
              )}
            <GenerativeRenderer descriptor={message.descriptor} />
          </div>
        ) : (
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? 'rounded-tr-sm bg-accent text-background'
                : message.isError
                  ? 'rounded-tl-sm border border-error/30 bg-error/10 text-error'
                  : 'rounded-tl-sm border border-divider bg-surface-hover text-primary'
            }`}
          >
            {/* Render newlines and bold text */}
            {message.content.split('\n').map((line, i) => (
              <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
                {line.split(/(\*\*[^*]+\*\*)/).map((segment, j) => {
                  if (segment.startsWith('**') && segment.endsWith('**')) {
                    return (
                      <span key={j} className="font-semibold">
                        {segment.slice(2, -2)}
                      </span>
                    );
                  }
                  return segment;
                })}
              </p>
            ))}
          </div>
        )}

        {/* Timestamp + actions */}
        <div
          className={`flex items-center gap-2 px-1 ${isUser ? 'justify-end' : ''}`}
        >
          <span className="text-[10px] text-secondary">{message.timestamp}</span>
          {!isUser && (
            <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => onCopy?.(message.content)}
                className="flex h-5 w-5 items-center justify-center rounded text-secondary hover:text-primary focus:ring-2 focus:ring-accent focus:outline-none"
                title="Copy"
              >
                <Copy size={10} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-background">
        <Sparkles size={14} />
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-divider bg-surface-hover px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────── */

export default function AiChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  /**
   * Agent mode routes prompts through /v1/ai/chat (Gemini function-calling with
   * MCP tools — Chatwoot, TryPost) for real cross-system actions. Dashboard mode
   * uses /v1/ai/generate-ui for structured data visualizations.
   */
  const [agentMode, setAgentMode] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  /**
   * Build the chat history for the AI brain.
   * The orchestrator uses this for context continuity.
   */
  const buildHistory = useCallback((): ChatHistoryEntry[] => {
    return messages
      .filter((m) => m.id !== 'welcome')
      .slice(-10) // Keep last 10 messages for context
      .map((m) => ({
        sender: m.role === 'user' ? 'user' : 'assistant',
        text: m.content,
      }));
  }, [messages]);

  /**
   * Send a message to the Go orchestrator's AI brain.
   * Calls POST /v1/ai/generate-ui and parses the UiDescriptor response.
   */
  const handleSend = useCallback(
    async (overrideInput?: string) => {
      const text = (overrideInput ?? input).trim();
      if (!text) return;

      const userMessage: ChatMessage = {
        id: String(Date.now()),
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsTyping(true);

      try {
        let aiMessage: ChatMessage;

        if (agentMode) {
          // MCP-capable agent: function-calling loop across ERP/Chatwoot/TryPost.
          const response = await aiChat(text);
          aiMessage = {
            id: String(Date.now() + 1),
            role: 'assistant',
            content: response,
            timestamp: new Date().toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            }),
          };
        } else {
          // Dashboard mode: structured UI descriptor for data visualizations.
          const descriptor = await generateUI(text, buildHistory());
          aiMessage = {
            id: String(Date.now() + 1),
            role: 'assistant',
            content:
              descriptor.explanation ?? descriptor.title ?? 'Here are the results:',
            timestamp: new Date().toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            }),
            descriptor,
          };
        }

        setMessages((prev) => [...prev, aiMessage]);
      } catch (err) {
        // Graceful error handling — show the error in-chat, never crash
        const errorMessage: ChatMessage = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content:
            err instanceof Error
              ? `Unable to reach the AI brain: ${err.message}`
              : 'Something went wrong. The orchestrator may be offline.',
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          }),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
      }
    },
    [input, buildHistory, agentMode]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      /* silently fail */
    });
  };

  /* ── Collapsed FAB ── */
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-background shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(16,185,129,0.25)] focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background focus:outline-none"
        title="Open AI Assistant"
      >
        <MessageSquare size={24} />
        {/* Notification dot */}
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
        </span>
      </button>
    );
  }

  /* ── Panel Size ── */
  const panelClasses = isExpanded
    ? 'fixed inset-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-divider bg-surface shadow-2xl'
    : 'fixed bottom-6 right-6 z-50 flex h-[520px] w-[400px] flex-col overflow-hidden rounded-2xl border border-divider bg-surface shadow-xl md:h-[600px] md:w-[440px]';

  /* ── Expanded Chat Panel ── */
  return (
    <div className={panelClasses}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-divider bg-surface px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-accent text-background">
            <Sparkles size={16} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">MuslimBot Agent</p>
            <p className="text-[10px] text-secondary">
              ERP · Chatwoot · TryPost · KB
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAgentMode((v) => !v)}
            className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium transition-colors focus:ring-2 focus:ring-accent focus:outline-none ${
              agentMode
                ? 'bg-accent-muted text-accent'
                : 'text-secondary hover:bg-surface-hover hover:text-primary'
            }`}
            title={
              agentMode
                ? 'Agent mode — acts across ERP, Chatwoot & TryPost via MCP tools'
                : 'Dashboard mode — renders structured data visualizations'
            }
          >
            {agentMode ? <Wrench size={12} /> : <LayoutDashboard size={12} />}
            {agentMode ? 'Agent' : 'Dashboard'}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors hover:bg-surface-hover hover:text-primary focus:ring-2 focus:ring-accent focus:outline-none"
            title={isExpanded ? 'Shrink' : 'Expand'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              setIsExpanded(false);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors hover:bg-error/10 hover:text-error focus:ring-2 focus:ring-accent focus:outline-none"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} onCopy={handleCopy} />
        ))}
        {isTyping && <TypingIndicator />}

        {/* Quick suggestions (only show when minimal messages) */}
        {messages.length <= 1 && !isTyping && (
          <div className="space-y-2 pt-2">
            <p className="text-[10px] uppercase tracking-wider text-secondary">
              Try asking:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-divider bg-surface px-3 py-1.5 text-xs text-secondary transition-colors hover:border-accent hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-divider bg-surface px-4 py-3">
        <div className="flex items-end gap-2 rounded-xl border border-divider bg-background px-3 py-2 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything — ERP, support, social, KB..."
            rows={1}
            disabled={isTyping}
            className="max-h-20 min-h-[20px] flex-1 resize-none bg-transparent text-sm text-primary placeholder:text-secondary focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent text-background transition-all hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-30 focus:ring-2 focus:ring-accent focus:outline-none"
          >
            {isTyping ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-secondary">
          Powered by Gemini via Go Orchestrator · Responses may be inaccurate
        </p>
      </div>
    </div>
  );
}
