---
name: muslimbot_add_agent_tool
description: Step-by-step procedure to add a new agentic tool to MuslimBot so it works across all surfaces (Go orchestrator catalog, voice agent, mobile). Use whenever asked to give the AI a new capability/action against ERPNext or another backend.
---

# Add a MuslimBot agent tool

A tool must be registered in **one Go catalog** and mirrored to each surface. Skipping a surface = the
tool silently missing there. Read `muslimbot_architecture` first.

## 1. Backend method must exist first
The tool ultimately calls a whitelisted `small_erp.api.<module>.<fn>` (thin route → `services/`), or an
n8n webhook, or KB. If it doesn't exist, add it there first (guard with `frappe.has_permission`).

## 2. Register in the Go catalog — `go-orchestrator/internal/ai/tools.go`
- Add a `ToolSpec` to `Catalog`: `{"<name>", ToolRead|ToolWrite, routeFrappe|routeKB|routeN8N, "<method>"}`.
- Reads are instant; **writes require the client to pass `confirm:true`** (enforced in `generate_ui.go:ToolExecuteHandler`).
- If canonical arg names differ from the backend's params, add a `case` to `mapArgs()`.
- Add/extend a test in `tools_test.go`; run `cd go-orchestrator && go test ./internal/ai/...` and `go build ./...`.

## 3. Mirror to the voice agent — `Muslimbot-voice-agent/agent.py`
Add an `@function_tool` method on the `Agent` subclass (auto-discovered). Keep the tool **name identical**
to the catalog key. It calls the same backend method. Voice stack is Gemini Live (`AgentSession`) — see memory.

## 4. Mirror to mobile — `erp-flutter/lib/core/.../tool_catalog.dart`
Add the tool descriptor (name, kind, params) so the mobile client can surface/confirm it. (If `erp-flutter`
is being removed from the repo, skip and note it.)

## 5. Expose to the brain
The Gemini brain (`generate_ui.go:systemPrompt`) emits writes as component `action` with `actionType`.
If the new write should be brain-invokable, add its `actionType` to the schema's `actionType` enum and to
`ACTION_TO_TOOL` in `generative-ui/src/hooks/useGenerativeChat.js`.

## 6. Verify
`go test ./...` in the orchestrator; then a live round-trip: `POST /v1/ai/tool/execute` with the tool +
(for writes) `confirm:true`, and confirm the record in ERPNext. Reads should return without confirm.

## Checklist
- [ ] backend `small_erp.api.*` method exists & permission-guarded
- [ ] `Catalog` entry + `mapArgs` case + test (Go)
- [ ] `@function_tool` in agent.py (same name)
- [ ] mobile `tool_catalog.dart` (or noted N/A)
- [ ] `actionType` enum + `ACTION_TO_TOOL` if brain-invokable write
- [ ] `go build ./...` + live execute verified
