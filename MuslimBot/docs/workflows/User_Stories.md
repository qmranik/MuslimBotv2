# MuslimBot User Stories

These user stories map to the core practical workflows implemented in the MuslimBot ecosystem, demonstrating how the technology solves real business problems.

## 1. Omnichannel Customer Support
**Epic:** Unified Inbox & Autonomous Triage
**Problem Solved:** Prevents customer queries from being lost across channels and reduces the manual burden of basic support interactions.

* **Story 1.1:** As a Business Owner, I want my customers to be able to reach support via WhatsApp and Webchat so that they have a seamless experience, while all messages centralize in one dashboard (Chatwoot).
* **Story 1.2:** As a Support Agent, I want the AI to automatically handle common questions (like business hours or basic order status) using our Knowledge Base (RAG), so that I can focus purely on complex tickets.
* **Story 1.3:** As a Customer, I want the AI to recognize if I am frustrated (negative sentiment) and immediately hand off my chat to a human agent, so that I don't get stuck in an automated loop.
* **Story 1.4:** As a System Admin, I want to manage the routing logic visually via n8n workflows, so that I can tweak handoff rules without editing code.

## 2. Telephony & Voice-to-Order
**Epic:** 24/7 Autonomous Voice Agent
**Problem Solved:** Allows small businesses to capture revenue and service clients over the phone without staffing a 24/7 call center.

* **Story 2.1:** As a Customer, I want to call the business phone number and speak to a natural-sounding AI (Gemini Live) that can take my order conversationally, rather than navigating a confusing keypad menu.
* **Story 2.2:** As a Business Owner, I want the voice agent to directly create a Sales Invoice in my ERP (Frappe/small_erp) while on the call, so that orders are immediately ready for fulfillment without manual data entry.
* **Story 2.3:** As a Quality Assurance Manager, I want call recordings automatically saved to our object storage (MinIO) and linked to the ERP record, so I can review interactions if a dispute occurs.
* **Story 2.4:** As an IT Admin, I want the voice agent running on self-hosted infrastructure (LiveKit/Asterisk) so that data remains sovereign and compliant with local regulations.

## 3. Autonomous Marketing & Social Media
**Epic:** "Set and Forget" Marketing Engine
**Problem Solved:** Eliminates the manual grind of creating and scheduling weekly promotional content.

* **Story 3.1:** As a Marketing Manager, I want the system to automatically analyze our top-selling items from the ERP on a weekly basis, so that we promote what's actually working.
* **Story 3.2:** As a Social Media Coordinator, I want the AI brain to draft engaging, platform-specific copy based on recent inventory trends and push it to a scheduling queue (Postiz), so that I only have to review and approve, rather than write from scratch.
* **Story 3.3:** As a Sales Director, I want the system to trigger segmented email campaigns (Mautic) autonomously based on customer lifecycle events in the ERP, driving repeat business with zero manual effort.

## 4. Master Controller (ERP Operations)
**Epic:** Conversational Command Center for Operations
**Problem Solved:** Replaces tedious navigation of complex ERP menus with simple, natural language commands.

* **Story 4.1:** As an HR Manager, I want to open the MuslimBot Command Center and type "Show pending leaves and approve John's", so that I can clear administrative tasks in seconds without opening the HR module.
* **Story 4.2:** As a Support Manager, I want to verbally tell the AI (or type) to "Escalate ticket #102 to VIP priority and assign it to Sarah", so that urgent issues are routed instantly.
* **Story 4.3:** As a Business Owner, I want the system to enforce a "Confirm-before-write" safeguard on any action that modifies data or spends money, so that the AI cannot make critical mistakes autonomously.

## 5. Knowledge Hub & RAG
**Epic:** Instant Conversational SOPs
**Problem Solved:** Unblocks employees by making tribal knowledge and standard operating procedures instantly accessible.

* **Story 5.1:** As an Employee, I want to ask the Chat UI "How do I process a return for a damaged item?", and receive an exact answer cited from our latest company policy handbook, so I don't have to bother my manager.
* **Story 5.2:** As an Admin, I want to drop a new PDF policy into Nextcloud, and know that a background workflow will automatically chunk it and add it to the AI's Knowledge Base (Vertex/Qdrant) within minutes.
