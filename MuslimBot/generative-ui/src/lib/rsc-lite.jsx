"use client";
/**
 * Minimal local replacement for the removed `ai/rsc` client-state API.
 *
 * The Vercel AI SDK dropped the `ai/rsc` entrypoint (createAI / useUIState /
 * useActions / streamUI) in v7, which this project depends on. We only ever used
 * the client-side state container — `createAI` + `useUIState` + `useActions` —
 * driving a mock `submitMessage` that returns generative UI nodes. This shim
 * reimplements just those hooks with React context (no server streaming), so the
 * `<AI>` provider and the /generative workspace keep working without pinning an
 * older `ai` version. The primary chat path uses `@ai-sdk/react` (useGenerativeChat).
 */
import React, { createContext, useContext, useState } from "react";

const UIStateContext = createContext(undefined);
const AIStateContext = createContext(undefined);
const ActionsContext = createContext({});

export function createAI({ actions = {}, initialUIState = [], initialAIState = [] } = {}) {
  function AIProvider({ children }) {
    const uiState = useState(initialUIState);
    const aiState = useState(initialAIState);
    return (
      <ActionsContext.Provider value={actions}>
        <AIStateContext.Provider value={aiState}>
          <UIStateContext.Provider value={uiState}>{children}</UIStateContext.Provider>
        </AIStateContext.Provider>
      </ActionsContext.Provider>
    );
  }
  return AIProvider;
}

export function useUIState() {
  return useContext(UIStateContext) ?? [[], () => {}];
}

export function useAIState() {
  return useContext(AIStateContext) ?? [[], () => {}];
}

export function useActions() {
  return useContext(ActionsContext);
}
