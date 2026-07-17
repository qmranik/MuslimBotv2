"use client";
import React, { useState, useRef, useEffect } from 'react';
import {
  Bot, User, Code, ArrowUpRight, Plus, X, Paperclip, Database, BarChart3,
  Globe, Package, ShoppingCart, LifeBuoy, PenLine, Gauge, Terminal, ChevronDown,
} from 'lucide-react';
import { useUIState, useActions } from '../lib/rsc-lite';

// Preconfigured agents — each is a skill profile the Generative OS can run.
// The "builder" runs multi-step (OpenCode-style) agentic workflows over MCP tools.
const AGENTS = [
  { id: 'ops', name: 'Ops Agent', icon: Gauge, skills: ['ERPNext', 'Cross-system'], blurb: 'Reads and acts across ERP, automations and channels.' },
  { id: 'inventory', name: 'Inventory', icon: Package, skills: ['Stock', 'Purchase'], blurb: 'Stock levels, reorder points, purchase orders.' },
  { id: 'orders', name: 'Orders & Sales', icon: ShoppingCart, skills: ['Invoices', 'Payments'], blurb: 'Orders, invoices, receivables, POS.' },
  { id: 'support', name: 'Customer Service', icon: LifeBuoy, skills: ['Chatwoot', 'RAG'], blurb: 'Answers customers from the knowledge base.' },
  { id: 'copy', name: 'Copywriter', icon: PenLine, skills: ['Postiz', 'Custom models'], blurb: 'Generates marketing copy and schedules posts.' },
  { id: 'builder', name: 'OpenCode Builder', icon: Terminal, skills: ['Multi-step', 'MCP'], blurb: 'Runs multi-step agentic workflows via MCP tools.' },
];

// Toolbelt — "any-to-any" tools + documents the agent can pull in.
const TOOLS = [
  { id: 'attach', label: 'Attach file / document', icon: Paperclip },
  { id: 'erp', label: 'Query ERPNext', icon: Database, token: '@erp' },
  { id: 'chart', label: 'Generate chart', icon: BarChart3, token: '@chart' },
  { id: 'web', label: 'Fetch website / URL', icon: Globe, token: '@web' },
  { id: 'postiz', label: 'Check Postiz schedule', icon: PenLine, token: '@postiz' },
  { id: 'mcp', label: 'Run MCP tool', icon: Terminal, token: '@mcp' },
];

const STARTERS = {
  ops: ['Give me a health snapshot across ERP, Chatwoot and Postiz', 'What needs my attention today?'],
  inventory: ['Show low-stock items and draft purchase orders', 'Which products sold out this week?'],
  orders: ['List overdue invoices and total receivables', "Summarize today's sales as a chart"],
  support: ['Draft a reply to the latest customer question', 'What are our delivery timeframes?'],
  copy: ['Draft 3 promo copies for the new product', "What's scheduled in Postiz this week?"],
  builder: ['Build a dashboard: weekly revenue by product', 'Workflow: low stock → PO → notify supplier'],
};

export function GenerativeWorkspace() {
  const [messages, setMessages] = useUIState();
  const { submitMessage } = useActions();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [agentId, setAgentId] = useState('ops');
  const [toolMenu, setToolMenu] = useState(false);
  const [attachments, setAttachments] = useState([]);

  const messagesEndRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  const agent = AGENTS.find((a) => a.id === agentId) || AGENTS[0];

  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark');
  }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  const runQuery = async (raw) => {
    const value = (raw ?? input).trim();
    if (!value || isLoading) return;
    setInput('');
    setIsLoading(true);
    const attachNote = attachments.length ? ` [${attachments.length} attachment${attachments.length > 1 ? 's' : ''}]` : '';
    setLogs((p) => [...p, `${agent.name}: parsing "${value}"${attachNote}`]);

    setMessages((cur) => [...cur, { id: Date.now().toString(), role: 'user', display: value + attachNote }]);
    setAttachments([]);

    try {
      setLogs((p) => [...p, `Planning steps with ${agent.skills.join(', ')} skills…`]);
      const responseMessage = await submitMessage(value);
      setLogs((p) => [...p, 'Rendered generative component.']);
      setMessages((cur) => [...cur, { id: (Date.now() + 1).toString(), role: 'assistant', display: responseMessage }]);
    } catch (err) {
      console.error(err);
      setLogs((p) => [...p, 'Error: failed to fetch AI response.']);
    } finally {
      setIsLoading(false);
    }
  };

  const pickTool = (tool) => {
    setToolMenu(false);
    if (tool.id === 'attach') { fileRef.current?.click(); return; }
    setInput((v) => (v ? `${v} ${tool.token} ` : `${tool.token} `));
    inputRef.current?.focus();
  };

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setAttachments((prev) => [...prev, ...files.map((f) => ({ id: `${f.name}-${f.size}`, name: f.name }))]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const empty = messages.length === 0;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#111827] font-sans text-white">
      {/* Ambient light */}
      <div className="pointer-events-none absolute left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-emerald-900/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-indigo-900/20 blur-[100px]" />

      {/* Conversation / empty state */}
      <div className="z-10 mx-auto w-full max-w-5xl flex-1 space-y-6 overflow-y-auto p-4 pb-40 md:p-12">
        {empty ? (
          <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center py-6">
            <SparklesIcon className="mb-4 h-12 w-12 text-emerald-500 opacity-90" />
            <h2 className="text-center font-display text-3xl font-medium">Generative OS</h2>
            <p className="mt-2 max-w-md text-center text-sm text-slate-400">
              Pick an agent, attach anything, and describe a task. I plan multi-step workflows and
              generate the screens to complete them.
            </p>

            {/* Agent picker */}
            <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
              {AGENTS.map((a) => {
                const Icon = a.icon;
                const active = a.id === agentId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAgentId(a.id)}
                    className={`group rounded-2xl border p-3 text-left transition-colors ${
                      active
                        ? 'border-emerald-500/70 bg-emerald-950/40 ring-1 ring-emerald-500/40'
                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-semibold">{a.name}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {a.skills.map((s) => (
                        <span key={s} className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400">{s}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Starters for the active agent */}
            <div className="mt-6 w-full">
              <p className="mb-2 text-xs text-slate-500">{agent.blurb}</p>
              <div className="flex flex-wrap gap-2">
                {(STARTERS[agentId] || []).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => runQuery(s)}
                    className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-emerald-500/60 hover:text-emerald-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role !== 'user' && (
                <div className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-800 bg-emerald-900/50">
                  <Bot className="h-4 w-4 text-emerald-400" />
                </div>
              )}
              <div className={`max-w-[90%] rounded-2xl p-4 ${m.role === 'user' ? 'rounded-br-none border border-slate-700 bg-slate-800 text-slate-100' : 'bg-transparent text-slate-200'}`}>
                {typeof m.display === 'string' ? <p className="whitespace-pre-wrap leading-relaxed">{m.display}</p> : m.display}
              </div>
              {m.role === 'user' && (
                <div className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700">
                  <User className="h-4 w-4 text-slate-300" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="absolute bottom-8 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 px-4">
        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300">
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[160px] truncate">{f.name}</span>
                <button type="button" onClick={() => setAttachments((p) => p.filter((x) => x.id !== f.id))} className="text-slate-500 hover:text-rose-400">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); runQuery(); }} className="relative flex items-center gap-1 rounded-full border border-emerald-900/50 bg-[#1A2521] px-2 py-1.5 shadow-2xl">
          {/* Toolbelt */}
          <div className="relative">
            <button type="button" onClick={() => setToolMenu((v) => !v)} aria-label="Tools and attachments"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-800">
              <Plus className={`h-5 w-5 transition-transform ${toolMenu ? 'rotate-45' : ''}`} />
            </button>
            {toolMenu && (
              <div className="absolute bottom-12 left-0 w-60 overflow-hidden rounded-2xl border border-slate-800 bg-[#0D1520] p-1.5 shadow-2xl">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tools & documents</p>
                {TOOLS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} type="button" onClick={() => pickTool(t)}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-slate-300 hover:bg-slate-800">
                      <Icon className="h-4 w-4 text-emerald-400" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={onFiles} />

          {/* Active agent badge */}
          <button type="button" onClick={() => runQuery('')} title={agent.name}
            className="hidden items-center gap-1.5 rounded-full bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-emerald-300 sm:inline-flex">
            <agent.icon className="h-3.5 w-3.5" />
            {agent.name}
          </button>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={empty ? 'Ask anything, or describe a UI to build…' : 'What would you like to change or create?'}
            className="min-w-0 flex-1 border-none bg-transparent px-2 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />
          <button type="submit" disabled={isLoading || !input.trim()}
            className="mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-slate-900 transition-colors hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500">
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Agent Log */}
      <div className="absolute bottom-8 left-8 z-30">
        <div className={`flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0D1520] shadow-2xl transition-all duration-300 ${isLogOpen ? 'w-80' : 'w-auto'}`}>
          <button onClick={() => setIsLogOpen(!isLogOpen)} className="flex w-full items-center justify-between p-3 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-emerald-500" />
              <span>Agent Log</span>
              {!isLogOpen && logs.length > 0 && <span className="ml-1 rounded-md bg-emerald-900/50 px-1.5 py-0.5 text-[10px] text-emerald-400">{logs.length}</span>}
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${isLogOpen ? '' : 'rotate-180'}`} />
          </button>
          {isLogOpen && (
            <div className="flex h-64 flex-col border-t border-slate-800/50 p-4 pt-2 font-mono text-[11px] text-slate-400">
              <div className="flex-1 space-y-3 overflow-y-auto">
                {logs.length === 0 && <p className="text-slate-600">Waiting for a task…</p>}
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 text-xs leading-none text-emerald-500">◆</span>
                    <span>{log}</span>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 animate-pulse text-xs leading-none text-amber-500">◆</span>
                    <span className="animate-pulse">Running…</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SparklesIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}
