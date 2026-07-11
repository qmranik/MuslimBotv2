# Silo 5: Voice Test

This runbook tests the LiveKit WebRTC Voice capabilities (Phase 4.3).

## Prerequisites
Ensure Silo 5 is running:
```bash
docker compose down
docker compose -f docker-compose.silo5.yml up -d
```
Ensure `generative-ui` is running natively, and `VITE_LIVEKIT_URL` is set in the `.env`.

## 1. Voice Connection Testing
1. Open `http://localhost:5173` in the **Knowledge Hub** workspace.
2. Click the **Call Muslimbot** / microphone icon.
3. Accept the browser microphone permissions.
4. **Pass Criteria:** The LiveKit room connects successfully and the Muslimbot voice agent joins without immediate WebRTC errors.
5. Speak: *"What is your return policy?"*
6. **Pass Criteria:** RAG voice response triggers.
