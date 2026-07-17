# Skill: cncf_cloud_native

## Description
Guidelines for interacting with the Cloud Native Computing Foundation (CNCF) and adjacent open-source tooling embedded in the MuslimBot sovereign stack.

## Key CNCF & Cloud-Native Tools in MuslimBot

### 1. Observability (Promtail, Loki, Grafana)
- **Goal:** Trace latency across the Voice Agent (sub-800ms budget) and API requests.
- **Usage:** Logs from all Docker containers are scraped by Promtail and pushed to Loki.
- **Agent Action:** When debugging a failed n8n workflow or voice drop, query the Loki endpoint (or use the terminal to grep Promtail outputs). Look for `TURN_METRIC` tags in `agent.py` logs.

### 2. Storage (MinIO)
- **Goal:** S3-compatible local object storage.
- **Buckets:** `call-recordings` (Egress data), `rag-docs` (Nextcloud ingest), `cold-backups`.
- **Agent Action:** Use the `mc` (MinIO Client) CLI tool or AWS S3 SDK with the local MinIO endpoint to verify file uploads or configure bucket policies.

### 3. Vector Database (Qdrant)
- **Goal:** Data-sovereign semantic search for the Knowledge Hub.
- **Usage:** Runs locally to replace Vertex AI RAG. Interacted with via the orchestrator's `/v1/kb/retrieve` abstraction.
- **Agent Action:** When migrating RAG documents, ensure the embedding model dimensions match Qdrant's collection configuration.

### 4. Telephony (Asterisk / SIP)
- **Goal:** Open-source PBX bridging SIP trunks to WebRTC (LiveKit).
- **Usage:** Managed via `pjsip.conf`.
- **Agent Action:** Use Asterisk CLI (`asterisk -rvvv`) within its container to debug SIP registration issues or dialplan routing.