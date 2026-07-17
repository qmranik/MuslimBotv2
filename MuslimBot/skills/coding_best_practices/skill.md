# Skill: coding_best_practices

## Description
This skill outlines the standard operating procedures and coding best practices for developing within the MuslimBot ecosystem. It ensures consistency, maintainability, and security across all microservices (Go Orchestrator, Generative UI, Frappe ERP, and Voice Agents).

## Core Protocols

### 1. Unified Project Structure
The ecosystem is organized under the root `MuslimBot/` directory. All sub-projects must remain in their designated domains:
- **`go-orchestrator/`**: Backend-for-Frontend (BFF) and API Gateway. Written in Go.
- **`generative-ui/`**: Single Pane of Glass Frontend. Written in Next.js/React.
- **`small_erp/`**: Headless backend system of record. Written in Python/Frappe.
- **`Muslimbot-voice-agent/`**: Real-time voice handling. Written in Python (LiveKit).
- **`terraform/`**: Infrastructure as Code (IaC).
- **`skills/`**: Agent operating procedures and context files.

### 2. General Coding Standards
- **Clarity over Cleverness:** Write code that is easy to read and understand. Use descriptive variable and function names.
- **Single Responsibility Principle:** Functions and classes should do one thing well. If a function is handling routing, data validation, and database operations, refactor it.
- **Strict Typing:**
  - *Go:* Utilize strong typing and structs. Avoid `interface{}` unless absolutely necessary.
  - *TypeScript (Next.js):* Always define interfaces for props and state. Do not use `any`.
  - *Python:* Use type hints (`def func(name: str) -> bool:`) extensively, especially in the voice agent and Frappe services.

### 3. API & Integration Standards
- **RESTful Principles:** API endpoints in the orchestrator and Frappe should follow REST conventions where applicable, using proper HTTP verbs (GET, POST, PUT, DELETE).
- **Centralized Routing (BFF):** The frontend (`generative-ui`) must *never* call `small_erp` directly. All requests must route through `go-orchestrator` to ensure proper tenant resolution and security checks (Authentik).
- **Error Handling:** 
  - Never swallow errors silently.
  - Return standardized JSON error responses (e.g., `{"error": "description", "code": 400}`).
  - Log errors with sufficient context (Tenant ID, Request ID) to Loki via stdout.

### 4. Security & Privacy Defaults
- **Confirm Before Write:** Any AI action that mutates the database (creating orders, approving leaves, deleting records) MUST be intercepted and require a human to click a confirmation UI card.
- **No Hardcoded Secrets:** Never place API keys, passwords, or tokens in source code. Use `.env` files (which are git-ignored) for local development and GCP Secret Manager for production.
- **PII Masking:** Ensure the Presidio anonymizer middleware is active before any data is sent to an external LLM (Gemini/Claude/OpenAI).

### 5. AI Tool Development (The "Agentic" Standard)
When building new tools for the Go Orchestrator or Voice Agent to use:
1. **Schema First:** Always define a strict JSON Schema for the tool's inputs. LLMs need clear, unambiguous schemas to call tools correctly.
2. **Atomic Actions:** Keep tools atomic. Instead of one massive `manage_user` tool, prefer `get_user`, `update_user_role`, and `reset_user_password`.
3. **Fail Gracefully:** If a tool fails, return a clear natural-language error message in the tool response so the LLM can explain the failure to the user and attempt a retry if appropriate.

### 6. Documentation
- **Keep `docs/` Updated:** If you change the architecture, update `docs/ROOT.md` or the relevant workflow documentation.
- **Skill Creation:** If you automate a complex, repeatable procedure, abstract it into a new skill file in `MuslimBot/skills/`.
