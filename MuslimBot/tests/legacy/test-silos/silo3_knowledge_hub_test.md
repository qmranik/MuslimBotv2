# Silo 3: Knowledge Hub Test

This runbook focuses strictly on testing the **Knowledge Hub (RAG demo)** from Phase 4 of the MVP QA Prompt.

## Prerequisites
Ensure Silo 3 is running (Muslimbot KB BFF and its cache):
```bash
docker compose down
docker compose -f docker-compose.silo3.yml up -d
```
Also ensure `generative-ui` is running natively, and your `VITE_GEMINI_API_KEY` is set.

## 1. Pre-flight Health Check
Verify the KB backend is responding:
```bash
curl -s http://localhost:8787/health
```
**Pass Criteria:** `{"status":"ok"}`

## 2. UI Testing

1. Open `http://localhost:5173` and navigate to the **Knowledge Hub** workspace.
2. Use the **Upload tab** to ingest a sample markdown or text document (e.g., "Returns Policy").
3. Wait for the source list to show status **indexed**.
4. Test the RAG chat by asking: *"What is your return policy?"*
5. **Pass Criteria:** The answer cites the uploaded document, and the source chunk is visible.

## 3. Automated RAG Screenshot Test
Use the playwright script to test the knowledge hub flows automatically:
```bash
cd ../audit-screenshots
node 04-knowledge-hub.js
```
