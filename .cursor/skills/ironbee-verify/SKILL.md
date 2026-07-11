---
name: ironbee-verify
description: "Trigger verification of code changes — runs every active cycle wired up for this project (see the platform sections at the bottom of the file). Default is verify-only (report the verdict and stop); a leading `fix` argument adds the fix-and-re-verify loop until pass."
disable-model-invocation: true
---

# IronBee Verify

Verify the current code changes through real tools. The gate runs every cycle that has been wired up for this project, and all active cycles must be satisfied within a single verification cycle for `status: pass`. Each cycle has its own tools and flow — **see the platform sections near the bottom of this file** for which cycles apply and what to call. The verdict shape itself is platform-agnostic (`status`, `checks`, `issues?`, `fixes?`); the gate enforces that you called each cycle's required tools and that `checks` is non-empty.

## Mode

The FIRST whitespace-delimited token of whatever the user provided alongside this command selects the mode; everything after it is the scenario:

- `fix` → **verify-and-fix**: on a fail verdict, fix the reported issues, rebuild, and re-verify until the verdict passes.
- `report` → **verify-only** (the explicit form of the default).
- Anything else, or nothing → **verify-only** (default), and the WHOLE provided text is the scenario.

**Verify-only** means: submit the (possibly fail) verdict, report the issues to the user, and STOP — do **not** edit code, do **not** re-verify. The fail verdict is still recorded (that's the point — an honest status report). If the user wants the issues repaired, suggest `/ironbee-verify fix`. The mode token never overrides the gate: if enforcement blocks completion because of this turn's edits, follow the gate.

## Verification scenario

A custom verification scenario may be supplied when this command is invoked — either as **inline text** or as a **path to a file** (any location, any format; it is read at run time). The scenario is whatever the user provided alongside invoking this command, after stripping a leading `fix` / `report` mode token (see **Mode**).

- **If a scenario is supplied, it is authoritative**: verify exactly what it describes. Drive each active cycle's tools to exercise precisely the flows, states, and endpoints it names — this **replaces** the default "exercise the changed pages/endpoints" guidance.
- **If the scenario is (or points to) a file path**, read that file with your file-read tool and treat its contents as the scenario. Do not assume a fixed location or format — read whatever path was given.
- **If the path does not resolve to an existing file**, stop and report `scenario file not found: <path>`, then ask how to proceed — do not verify the literal path string or guess a target.
- **If no scenario is supplied**, fall back to the default flow: exercise the changed pages/endpoints per the active platform sections below.

Whatever the scenario directs, the gate is unchanged — you must still call every active cycle's required tools and submit a non-empty `checks`. Map each `checks` entry to a concrete scenario step/expectation, and each `issues` entry to a scenario step that failed.

## Universal steps

1. **Start verification**: Run `echo '{"session_id":"<your-session-id>"}' | ironbee hook verification-start` via terminal.
   **In fix mode**, add the intent flag so IronBee's completion gate enforces fix-until-pass:
   `echo '{"session_id":"<your-session-id>"}' | ironbee hook verification-start --intent fix`
2. **Build and start** the application if not already running.
3. **For every active cycle, run its flow** — driven by the **Verification scenario** above when one was supplied, otherwise as described in the platform sections near the bottom of this file. All active cycles must be exercised within this same verification cycle.
4. **Stop** the dev server when verification is complete (every cycle — including the final one).
5. **Honor any cycle-specific teardown** noted in the platform sections BEFORE submitting your verdict.
6. **Submit your verdict** via terminal. One verdict covers every active cycle:
    - Pass: `echo '{"session_id":"...","status":"pass","checks":["..."]}' | ironbee hook submit-verdict`
    - Fail: `echo '{"session_id":"...","status":"fail","checks":["..."],"issues":["describe what failed"]}' | ironbee hook submit-verdict`
7. **If failed** → collect ALL issues first (finish testing every active cycle) and submit ONE fail verdict with all issues. Then branch by mode:
   - **Verify-only (default)**: report the issues to the user and stop — do not edit code. Suggest `/ironbee-verify fix` to repair them.
   - **Fix mode (`fix` token)**: fix everything, rebuild, and re-verify until pass. Do not fix one issue at a time — batch fixes to avoid repeated build/restart cycles.
8. If pass after a previous fail, include `"fixes"` in the verdict describing what was fixed.

---

<!--IRONBEE:PLATFORM:browser-->
<!-- Browser cycle verification is ENABLED for this project. The stop hook
     enforces a browser cycle whenever an edited file matches
     `browser.verifyPatterns`. The `/ironbee-verify` command's mode
     arguments (default / full / visual / functional) tune the depth of the
     browser-cycle pass. -->

## Mode arguments (browser cycle)

- `/ironbee-verify` — **default** — focus on what changed, visual + functional checks on affected areas
- `/ironbee-verify full` — **full scope** — entire application, all checklists, edge cases, responsive, accessibility deep dive
- `/ironbee-verify visual` — **visual only** — contrast, layout, spacing, fonts, images, theming
- `/ironbee-verify functional` — **functional only** — clicks, forms, navigation, data flow, error handling

If no argument is given, use **default** mode. `default` and `full` apply to every active cycle (browser, node, backend) — each cycle interprets them in its own terms (see each platform section). `visual` and `functional` apply ONLY to the browser cycle; other active cycles run in `default` mode when these are passed.

## Browser steps (all modes)

1. **Start verification**: Run `echo '{"session_id":"<your-session-id>"}' | ironbee hook verification-start` via terminal
2. **Build and start** the application if not already running
3. **For EVERY page you visit**, repeat this cycle:
   a. **Navigate** using `MCP:bdt_navigation_go-to`
   b. **Take a FULL PAGE screenshot** using `MCP:bdt_content_take-screenshot` with `fullPage: true`
   c. **Take an ARIA snapshot** using `MCP:bdt_a11y_take-aria-snapshot`
   d. **STOP and visually analyze the screenshot** — switch your focus entirely to finding visual problems. Look at this screenshot as if your ONLY job is to find visual defects:
      **WARNING: ARIA reports DOM content, not what the user actually sees.** Do NOT assume the page looks correct just because ARIA shows the right content. Only the screenshot tells you what the user actually sees.
      - Text readability — is it readable against its background? Look for text that blends in or poor contrast
      - Layout — overlapping elements, unexpected gaps, overflow, content cut off
      - Spacing — consistent padding/margin? Too cramped or too far apart?
      - Colors — intentional and consistent? Any jarring mismatches?
      - Typography — right sizes? Clipped or truncated text?
      - Images/icons — loaded? Right size and aspect ratio?
      - States — empty, loading, disabled, error states rendered properly?
      Report your visual findings before continuing.
   e. **Read the ARIA snapshot** — verify headings, labels, landmarks, and structure
   f. If anything looks wrong → note it as an issue
4. **Functionally test** — run the checklist for your mode (see below). After each significant interaction, take another screenshot and repeat the visual analysis.
5. **Check console** for errors using `MCP:bdt_o11y_get-console-messages`
6. **Stop** the dev server when verification is complete
7. **If recording was started, stop it now** — `MCP:bdt_content_stop-recording`. submit-verdict rejects with `"recording is still active"` when this step is skipped. (Recording is a server-side opt-in via `recording.enable` — when on, the gate forces `MCP:bdt_content_start-recording` BEFORE the steps above and demands the matching stop here.)
8. **Submit your verdict** via terminal:
    - Pass: `echo '{"session_id":"...","status":"pass","checks":["..."]}' | ironbee hook submit-verdict`
    - Fail: `echo '{"session_id":"...","status":"fail","checks":["..."],"issues":["describe what failed"]}' | ironbee hook submit-verdict`
9. **If failed** → collect ALL issues first (finish testing all affected pages), submit one fail verdict with all issues, then fix everything, rebuild, and re-verify. Do not fix one issue at a time — batch fixes to avoid repeated build/restart cycles.
10. If pass after a previous fail, include `"fixes"` in the verdict describing what was fixed

---

## Default Mode

Focus on the code you changed — not the entire application.

### 1. Study the changes
1. Run `git diff --name-only` and `git diff --name-only HEAD~1`
2. **Ignore `.ironbee/`, `.claude/`, `.cursor/`** — tool config, not application code
3. **Read the full diff** (`git diff` and/or `git diff HEAD~1`) — understand every change: what was added, removed, modified. Note specific values (colors, sizes, conditions, logic, API endpoints, component props).
4. Before opening the browser, you should be able to answer: what exactly changed, what should look or behave differently, and what could go wrong?

### 2. Verify in the browser
- **Cross-reference the diff against what you see.** For each change in the diff, verify it is correctly reflected in the browser. If the diff changes a color → check that color. If it changes a calculation → verify the result. If it adds a component → confirm it renders.
- **Test the flow end-to-end** — navigate, click, fill forms, submit, verify the outcome
- **Check one edge case** — empty input, invalid data, or double-click
- **Console** — any new errors or warnings?

---

## Full Mode (`/ironbee-verify full`)

Comprehensive verification of the **entire application**. Do NOT run `git diff` or scope to recent changes. Test every page, every flow, every visual detail. Any issue is a failure, regardless of when it was introduced.

### Visual Checklist
In addition to the per-page visual analysis in step 3d:
- **Responsiveness** — does the layout adapt if viewport changes? No horizontal scrolling on standard widths
- **Borders & separators** — visible and consistent? Not too faint or missing
- **Scroll behavior** — does the page scroll smoothly? No content hidden behind sticky headers/footers?

### Functional Checklist
- **Navigation** — do links and buttons navigate to the correct pages?
- **Forms** — fill inputs with real data, select options, submit. Do validation messages appear correctly?
- **Buttons & interactions** — do click handlers fire? Do toggles, dropdowns, and modals work?
- **Data flow** — does submitted data appear where expected?
- **Error handling** — what happens with invalid input? Does the UI handle errors gracefully?
- **Authentication** — if applicable, do protected routes redirect correctly?
- **API calls** — do network requests succeed? Check for failed requests in console/network
- **State persistence** — does state survive page refresh where expected?
- **Edge cases** — empty inputs, very long text, special characters, rapid clicks

### Accessibility (deep dive)
- Are headings hierarchical? Do form inputs have labels? Are landmarks present?
- Check for missing alt text on images

---

## Visual Mode (`/ironbee-verify visual`)

Focus exclusively on visual quality. Run the per-page visual analysis from step 3d on every page, plus:
- **Responsiveness** — viewport changes, no horizontal scrolling
- **Borders & separators** — visible and consistent?
- **Scroll behavior** — smooth scrolling, no hidden content

Take screenshots of **multiple states** if applicable (hover, active, disabled, empty, populated).

---

## Functional Mode (`/ironbee-verify functional`)

Focus exclusively on behavior. Use the same functional checklist as Full Mode above.

Test the **complete user flow**, not just the single step you changed.
<!--/IRONBEE:PLATFORM:browser-->

<!--IRONBEE:PLATFORM:node-->
<!-- Node.js runtime debug verification is OFF for this project.
     - If your backend is Node.js and you want non-blocking debugger probes:
       run `ironbee node enable` to enable. This file will be auto-updated
       with the node-cycle guidance.
     - If your backend isn't Node.js (Java / Python / Go / Rust / .NET / Ruby / PHP / Elixir / …):
       leave this OFF — `ndt_*` tools only attach to V8/Node processes and will fail elsewhere.
     - When OFF, do NOT invoke any `ndt_*` tools voluntarily. -->
<!--/IRONBEE:PLATFORM:node-->

<!--IRONBEE:PLATFORM:backend-->
<!-- Backend protocol verification is OFF for this project.
     - To verify backend services by driving real protocol calls (HTTP / gRPC /
       GraphQL / WebSocket) — runtime- and language-agnostic — run `ironbee
       backend enable`. This file will be auto-updated with the backend-cycle
       guidance.
     - When OFF, do NOT invoke any `bedt_*` tools voluntarily. -->
<!--/IRONBEE:PLATFORM:backend-->

<!--IRONBEE:PLATFORM:android-->
<!-- Android mobile verification is OFF for this project.
     - To verify Android app changes by driving a real device or emulator (UI
       interactions, Logcat, screenshots): run `ironbee android enable`.
       This file will be auto-updated with the android-cycle guidance.
     - When OFF, do NOT invoke any `adt_*` tools voluntarily. -->
<!--/IRONBEE:PLATFORM:android-->

---

## When to FAIL

If you observe ANY problem on any active cycle — wrong data, unexpected errors, broken interactions, missing evidence, anything that doesn't match the spec — you MUST submit a **fail** verdict.

**Do NOT rationalize away problems.** If something looks wrong or behaves unexpectedly, it IS wrong.

**After a fail verdict in fix mode, you MUST fix the issues and re-verify** — do not just report and stop. In verify-only mode (the default) the opposite holds: report and stop; fixing without the `fix` token is overstepping.

## Verdict Quality

Your `checks` array must list **specific observations**, not generic statements:
- GOOD: `["login form renders with email and password fields", "submitted valid credentials, redirected to /dashboard", "console clean — 0 errors"]`
- BAD: `["it works", "looks good", "feature implemented"]`

## Important
- ALWAYS submit a verdict after every verification attempt — both pass AND fail
- Do NOT edit code before submitting a fail verdict
- **Noticing a bug and submitting pass is the #1 violation** — if you see it, fail it
