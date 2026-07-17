"use client";
import React, { useState, useEffect, useRef } from "react";
import { Bot, Maximize2, X, RefreshCw } from "lucide-react";
import { SYSTEMS_TABS } from "../config/systemsTabs";
import { SecurePortal } from "../components/SecurePortal";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";

export function MuslimBotCanvas() {
  const [history, setHistory] = useState(() => [
    {
      id: "init",
      type: "system",
      content: "Initializing MuslimBot Generative Canvas...",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  // Auto-scroll to bottom of the upward-rolling canvas
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const addSystemMessage = (text) => {
    setHistory((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        type: "system",
        content: text,
        timestamp: Date.now(),
      },
    ]);
  };

  // Check systems state on mount
  useEffect(() => {
    const checkSystems = async () => {
      addSystemMessage("Scanning integrated systems and authenticating SSO tokens...");
      setTimeout(() => {
        addSystemMessage("All core systems provisioned and ready for teleportation.");
      }, 1500);
    };
    setTimeout(checkSystems, 1000);
  }, []);

  const handleCommand = (cmd) => {
    const text = cmd.trim();
    if (!text) return;

    setHistory((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type: "user",
        content: text,
        timestamp: Date.now(),
      },
    ]);

    // Simulate Opencode-like state tracking
    setTimeout(() => {
      addSystemMessage(`Analyzing command intent: "${text}"`);

      const lowerText = text.toLowerCase();
      let matchedSystem = null;
      let workspaceConfig = null;

      // Find the intended system by scanning for keywords
      for (const tab of SYSTEMS_TABS) {
        if (
          lowerText.includes(tab.name.toLowerCase()) ||
          lowerText.includes(tab.id.toLowerCase()) ||
          (tab.ssoApp && lowerText.includes(tab.ssoApp.toLowerCase()))
        ) {
          matchedSystem = tab;
          workspaceConfig = workspaces[tab.id];
          break;
        }
      }

      if (matchedSystem && workspaceConfig) {
        addSystemMessage(`Intent detected for system: ${matchedSystem.name}`);
        addSystemMessage(`Dynamically generating secure portal for ${workspaceConfig.title}...`);
        
        setTimeout(() => {
          setHistory((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              type: "ui",
              title: `${matchedSystem.name} Workspace`,
              component: (
                <div className="w-full h-[600px] border border-emerald-500/30 rounded-xl overflow-hidden mt-2 relative">
                  <SecurePortal 
                    appId={workspaceConfig.id}
                    targetUrl={workspaceConfig.targetUrl}
                    ssoApp={workspaceConfig.ssoApp}
                  />
                </div>
              ),
              timestamp: Date.now(),
            }
          ]);
        }, 1000);
      } else {
        setTimeout(() => {
          setHistory((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              type: "assistant",
              content: `Canvas updated based on: ${text}. Try mentioning systems like 'ERPNext', 'Chatwoot', 'n8n', 'Postiz', 'Gameball', or 'Files'.`,
              timestamp: Date.now(),
            }
          ]);
        }, 800);
      }
    }, 500);
  };

  return (
    <div className="flex flex-col h-full bg-[#020408] text-slate-200">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/50">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-emerald-400" />
          <span className="font-display font-bold text-white tracking-tight">MuslimBot Canvas</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Neural Link Active
        </div>
      </header>

      {/* Canvas Area (Scrolls Upwards) */}
      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="flex-1" /> {/* Spacer to push items to bottom */}
        
        {history.map((item) => (
          <div key={item.id} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {item.type === "system" && (
              <div className="flex items-start gap-3 text-slate-400 font-mono text-xs">
                <RefreshCw className="w-4 h-4 mt-0.5 text-slate-500 animate-spin-slow" />
                <span>{item.content}</span>
              </div>
            )}

            {item.type === "user" && (
              <div className="flex justify-end">
                <div className="px-4 py-2.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-100 rounded-2xl rounded-tr-sm max-w-[80%] text-sm">
                  {item.content}
                </div>
              </div>
            )}

            {item.type === "assistant" && (
              <div className="flex justify-start">
                <div className="px-4 py-2.5 bg-white/5 border border-white/10 text-slate-200 rounded-2xl rounded-tl-sm max-w-[80%] text-sm">
                  {item.content}
                </div>
              </div>
            )}

            {item.type === "ui" && (
              <div className="w-full my-4">
                <div className="bg-black/60 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
                    <span className="text-xs font-semibold text-slate-300">{item.title}</span>
                    <div className="flex gap-2">
                      <button className="p-1 text-slate-400 hover:text-white transition-colors">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 text-slate-400 hover:text-white transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-1 bg-black relative">
                    {item.component}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </main>

      {/* Input Area */}
      <div className="shrink-0 p-4 bg-black/50 border-t border-white/10">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleCommand(input);
            setInput("");
          }}
          className="max-w-4xl mx-auto flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Instruct MuslimBot or teleport a system UI (e.g. 'open ERPNext', 'show chatwoot')..."
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Execute
          </button>
        </form>
      </div>
    </div>
  );
}
