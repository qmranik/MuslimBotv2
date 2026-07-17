# MuslimBot System Overview

## 1. Executive Summary & Vision

**MuslimBot** is an advanced, sovereign, AI-first operating system designed for digital businesses and SMEs. Moving beyond traditional, clunky ERP systems, MuslimBot adopts a **"Single Pane of Glass"** philosophy. Instead of users navigating complex software menus to achieve a task, they interact with the **MuslimBot Agent**—a single Generative UI interface capable of understanding intent, fetching context, and executing multi-step actions across various integrated platforms (ERP, Support, Marketing, and Voice).

At its core, MuslimBot transforms business operations from manual, reactive tasks into autonomous, AI-assisted workflows. It provides a highly capable "digital employee" that lives inside your business infrastructure.

## 2. Business Value & Problem Solving

SMEs frequently struggle with disjointed software silos: one tool for support, another for accounting, another for marketing, and a phone system that is completely isolated.

MuslimBot solves these problems by providing:
*   **Unification:** Integrating ERP records, omnichannel support, and social media management under a single conversational interface.
*   **Automation:** Utilizing `n8n` workflows combined with AI to autonomously handle repetitive tasks like customer support triage and weekly social media publishing.
*   **24/7 Availability:** Supplying a high-fidelity voice agent capable of answering phone calls and placing orders directly into the ERP at any time of day.
*   **Data Sovereignty:** Designing the entire stack to be self-hostable, preventing vendor lock-in and keeping sensitive data out of public cloud LLMs (via on-premise components like Qdrant and Presidio for PII masking).

## 3. Core Architecture (The Three Backbones)

The system is built on three foundational pillars, heavily interconnected via secure APIs and Webhooks.

### 3.1 `go-orchestrator` (The Brain & BFF)
A highly performant Go-based API gateway and Backend-for-Frontend (BFF).
*   **Identity & Security:** Manages Authentik ForwardAuth middleware, OIDC setups, and tenant resolution.
*   **AI Routing:** Houses the core AI logic (`/v1/ai/generate-ui` and `/v1/ai/tool/execute`). It exposes 21 standardized tools that Gemini/LLMs can invoke (e.g., fetching records, executing orders).
*   **Gateway:** Acts as the single ingress for external webhooks (Stripe, Twilio, Chatwoot), routing them to the correct tenant's n8n workflow.

### 3.2 `small_erp` (The Headless System of Record)
A Frappe-based backend ERP module stripped of its front-end UI.
*   Acts as the single source of truth for business data (inventory, orders, leaves, tickets, etc.).
*   Guards API calls with strict permission checks and roles.
*   Exposes a comprehensive suite of whitelisted APIs mapped to the orchestrator's AI tools.

### 3.3 `generative-ui` (The Command Center)
A Next.js frontend providing the "MuslimBot Agent" interface.
*   Features a chat-based Command Center capable of rendering complex data (Charts, Tables, Cards) directly in the chat stream via custom `UiDescriptors`.
*   Embeds external platforms (n8n, Chatwoot, Nextcloud) securely via the `SecurePortal` iframe architecture.
*   Enforces a strict "Confirm-before-write" safeguard to keep a human in the loop for critical operations.

## 4. Key Solutions & Capabilities

### 4.1 Master Controller
Users interact with the Generative UI to control the ERP. Examples include escalating helpdesk tickets, managing HR leaves, or querying sales metrics using natural language. The system bridges the gap between intent and the underlying Frappe modules (Helpdesk, CMS, HRMS).

### 4.2 Autonomous Voice-to-Order
A `Muslimbot-voice-agent` worker utilizes **LiveKit** and **Gemini Multimodal Agent** to handle inbound phone calls (via SIP/Asterisk). The agent talks conversationally with the caller and executes Frappe tools in real-time, such as creating a Sales Order directly from the voice call.

### 4.3 Omnichannel Support (Chatwoot + n8n)
Incoming messages from WhatsApp or Webchat hit Chatwoot, triggering webhooks to the orchestrator, and flowing into n8n. The AI uses Knowledge Base (RAG) lookups to automatically reply to common questions. If sentiment is negative, it hands off to a human agent.

### 4.4 RAG Knowledge Hub
Corporate documents placed in **Nextcloud** trigger chunking workflows that ingest data into **Vertex RAG** (or **Qdrant**). Employees can then ask the Command Center policy questions, receiving synthesized answers with exact citations.

## 5. Technical Infrastructure & Ecosystem

MuslimBot is designed for a sovereign, self-hosted deployment using Docker Compose, orchestrated by Traefik for routing and Authentik for zero-trust security.

**Expansion Pillars (Sovereign Operations):**
*   **WebRTC & Telephony:** Self-hosted `livekit-server` paired with an `asterisk` SIP bridge handles inbound phone lines without depending on SaaS telephony APIs.
*   **Vector Search:** `Qdrant` provides a local alternative to Vertex RAG.
*   **Marketing Automation:** `Mautic` (running on MariaDB) acts as the engine for AI-generated marketing campaigns.
*   **Object Storage:** `MinIO` acts as the S3-compatible layer for voice call recordings and RAG source documents.
*   **Observability:** `Loki` and `Promtail` provide telemetry and latency tracking (crucial for sub-800ms voice agent budgets).
*   **Infrastructure as Code:** A robust `terraform` setup (GCP) handles VPC provisioning, static IP routing for telephony, and Secret Manager integration.

## 6. Security & Privacy

*   **Validation Protocol v3.0:** An end-to-end acceptance suite ensuring regressions do not break core flows (Traefik -> Authentik -> GenUI -> Voice -> RAG).
*   **PII Masking:** Utilizing Microsoft **Presidio**, the system masks Personally Identifiable Information *before* it leaves the perimeter to interact with any external LLM nodes, ensuring high privacy standards.
*   **Confirm Before Write:** AI agents are prevented from mutating data blindly. High-stakes actions require a user to click "Confirm" on a rendered UI card.

## 7. Documentation Strategy

To maintain scalability, documentation is strictly organized:
*   **`README.md` & `CLAUDE.md`:** Root-level onboarding and AI instructions.
*   **`docs/`:** Centralized hub for system architecture, plans, and business overviews.
*   **`docs/workflows/`:** Houses practical, implemented workflows and associated User Stories (`Workflows.md`, `User_Stories.md`).
*   **`skills/`:** Repeatable development procedures for AI agents extending the system (e.g., adding tools, building Frappe bridges).
