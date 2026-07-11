# MuslimBot Mobile — Build Status

Living status for the rebuild described in [REBUILD_PLAN.md](REBUILD_PLAN.md).
Gate for every phase: **`flutter analyze` = 0 issues** and **`flutter test` = all pass**.

## ✅ P0 — Foundation (done, verified)
- `pubspec.yaml`: provider, http, intl, go_router, flutter_secure_storage (+ webview in P1).
- `core/config/app_config.dart` — runtime config (Frappe + orchestrator base, tenant, workspace URLs, feature flags).
- `core/auth/persona.dart` — `Persona` (owner/employee/customer) + role→persona mapping.
- `core/muslimbot/persona.dart` + `persona_mode.dart` — MuslimBot persona (₹, Asia/Dhaka, en/bn), system instructions, per-persona scope.
- `core/muslimbot/tool_catalog.dart` — **canonical 21-tool catalog** (12 read / 9 write) mirroring `agent.py`.
- `core/models/ui_descriptor.dart` + `tool_call.dart` — generative-UI contract (+ `navigate`/`flow`/`openDoc`/`rag` extensions) and tool-call validation.
- `core/frappe/app_exception.dart` — error taxonomy.
- `core/theme/app_theme.dart` (light **and** dark) + `formatters.dart` (₹ / dates).
- Tests: `tool_catalog_test`, `ui_descriptor_test`, `persona_test`.

## ✅ P1 — Auth + persona shell + WebView (done, verified)
- `core/auth/secure_store.dart`, `session.dart`, `auth_controller.dart`; `core/network/frappe_auth_api.dart` (login→sid, logged-user, best-effort roles, logout).
- `app/app.dart`, `app/router.dart` (auth redirect), `app/persona_shell.dart` (persona-tailored nav, lazy tabs, MuslimBot FAB).
- `features/auth/login_screen.dart` (new, AuthController-driven).
- `features/home/home_screen.dart` (persona-aware), `features/settings/more_screen.dart` (identity, persona preview, sign-out).
- `features/portal/portal_client.dart` + `webview_page.dart` — **Tier 3**: SSO/cookie-synced ERPNext WebView + JS mutation bridge.
- `features/assistant/assistant_sheet.dart` — MuslimBot chat UI shell (brain wired in P3).
- Tests: `auth_test` (session round-trip, restore/login/logout/persona-override with fakes).

**Total: `flutter analyze` clean · 29 tests passing.**

### How to run
```bash
cd erp-flutter
flutter pub get
flutter run                 # against a device/emulator
flutter analyze && flutter test
```
Default instance is `AppConfig.dev()` (`http://small.localhost:8000`, orchestrator `:8080`). Wire real values via a settings screen / `--dart-define` before prod.

### P1 smoke checklist (verify against a live stack — not reachable from CI)
1. Launch → login screen prefilled with last instance URL.
2. Sign in as **owner** (System Manager) → lands on owner shell (Home · Explore · ERP Desk · More).
3. Sign in as **operator** → employee shell; **portal/website user** → customer shell.
4. Open **ERP Desk** tab → embedded ERPNext loads **already authenticated** (cookie sync).
5. FAB → MuslimBot sheet opens with greeting + quick prompts.
6. More → switch persona preview (staff) → nav updates; Sign out → returns to login.

## ⏳ Next — P2 Generic engine (Tier 2), needs prerequisites
Integrating `frappe_mobile_sdk` is the "operate the whole ERP" milestone. **Blocked on infra** (must be done to wire + verify correctly):
1. Install the companion app **`frappe_mobile_control`** (`/api/v2/method/mobile_auth.*`) into the liteERP Frappe image (bake like `small_erp`).
2. Confirm a reachable dev site with a test user per persona.

Once available: add `frappe_mobile_sdk`, create `core/frappe_engine/` adapter (init from `Session`), wire the **Explore** tab → doctype picker → list → metadata form (create/submit/workflow), permission- and offline-aware.

## ⏳ P3 assistant brain · P4 voice+KB+support · P5 Tier-1 · P6 hardening
See REBUILD_PLAN §6. P3 can start without new infra (Dart Gemini fallback via `AppConfig.geminiApiKey`, or the recommended `/v1/ai/generate-ui` endpoint). P4 voice needs `LIVEKIT_*` + KB BFF reachable.
