---
name: muslimbot_generative_ui
description: How the MuslimBot Generative UI Command Center actually works (server-side Gemini brain returning UiDescriptor JSON, rendered as React widgets) and how to add a new generative component. Use when asked to change chat-to-UI behavior, add a chart/table/card type, or "make the Gen UI do X".
---

# MuslimBot Generative UI

The Gen UI is a **server-brain** design, not a Vercel `useChat`/`maxSteps` client loop (that path,
`generative-ui/src/app/api/chat/route.ts`, is a dead mock — do not extend it). Read `muslimbot_architecture`.

## Data flow
1. `useGenerativeChat.js` collects prompt + last-6 history → `services/serverBrain.js:runServerRouter`.
2. `POST /v1/ai/generate-ui` (orchestrator) → Gemini reads a live ERP snapshot + prompt → returns **one
   `UiDescriptor` JSON** (`generate_ui.go:systemPrompt` defines the exact schema).
3. Frontend maps `descriptor.component` → a React renderer and streams it into the chat.
4. Writes: descriptor `component:"action"` → user confirms → `executeServerTool` → `POST /v1/ai/tool/execute`
   with `confirm:true` (server rejects unconfirmed writes).

## The 11 components (never invent new ones)
`metrics · chart(bar|line|area|pie) · table · card · action · flow · navigate · open_doc · rag · text`
Renderers: `components/Generative{Metrics,Chart,Table,Card}.jsx`, dispatched by
`components/chat/GenerativeMessageRenderer.jsx`.

## Persona scoping
`personaMode` gates scope in `systemPrompt`: `full` (operator, all tools) vs `support_and_ordering`
(customer self-service only — knowledge, availability, own orders/tickets). Preserve this when editing prompts.

## To add/modify a component type
1. Add the type + fields to the schema block in `generate_ui.go:systemPrompt` (and a Rule line).
2. Add a renderer component and wire it into `GenerativeMessageRenderer.jsx`.
3. Keep field names identical between the Go schema and the JSX props.
4. Verify with `preview_start {name:...}` then a prompt that triggers it; check `read_console_messages`.

## Anti-patterns
- Don't move brain logic to the browser or add client-side `maxSteps`. Multi-step, if needed, is an
  orchestrator-side loop over the `Executor` — a deliberate architecture change, not a paste-in.
- Don't expose the Gemini key to the browser; it stays server-side (that's the whole point of the brain).
