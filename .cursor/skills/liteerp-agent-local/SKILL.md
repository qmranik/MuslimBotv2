---
name: liteerp-agent-local
description: Run the liteERP Agent stack locally — the Express/TypeScript BFF proxy and the Jetpack Compose Android client. Use when the user wants to start, build, install, or debug the liteERP Agent app locally in Cursor, set up the BFF .env, run the dev server, or build/install the Android APK with Gradle.
disable-model-invocation: true
---

# Run liteERP Agent Locally

The liteERP Agent has two runnable parts:
- **BFF** — Express/TypeScript proxy (Gemini agent + Frappe/ERPNext proxy). Default root or `bff/`.
- **Android** — Jetpack Compose client in `android/`.

If `.env`/`GEMINI`/`FRAPPE` secrets are absent, the BFF falls back to the premium sandboxed simulator.

## Part 1 — BFF server

```bash
npm install
cp .env.example .env            # then fill Vertex AI (Gemini) + Frappe ERPNext creds (optional)
npm run dev                      # http://localhost:3000 (hot reload + ERP proxy tunnels)
```

The dev server serves client hot-reload and the ERP proxy on `http://localhost:3000`.

## Part 2 — Android client

Open the `android/` directory, start an emulator or connect a USB device, then:

```bash
./gradlew assembleDebug          # build the APK
./gradlew installDebug           # install + run on device/emulator
```

## Notes

- Run BFF commands from the directory containing its `package.json` (repo root or `bff/`); run Gradle from `android/`.
- Secrets stay in `.env` (gitignored) — never commit Frappe tokens or the Gemini key.
- To verify ERP connectivity, confirm the underlying ERPNext stack is up: `docker compose ps` and that `http://localhost:8000` responds.
