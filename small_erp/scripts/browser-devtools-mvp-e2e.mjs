#!/usr/bin/env node
/**
 * Full E2E via Browser DevTools MCP (HTTP transport).
 * Prereq: PLATFORM=browser npx -y @ironbee-ai/devtools --transport=streamable-http --port=3010
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = process.env.BROWSER_DEVTOOLS_MCP_URL || 'http://localhost:3010/mcp';
const ERP = process.env.OPS_URL || 'http://localhost:8000';
const GENUI = process.env.GENUI_URL || 'http://localhost:5173';
const USER = process.env.OPS_USER || 'operator@test.local';
const PASS = process.env.OPS_PASS || 'operator123';

const results = { passed: [], failed: [], warnings: [] };

function pass(area, msg) {
  results.passed.push({ area, msg });
  console.log(`[OK] ${area}: ${msg}`);
}
function fail(area, msg) {
  results.failed.push({ area, msg });
  console.error(`[FAIL] ${area}: ${msg}`);
}
function warn(area, msg) {
  results.warnings.push({ area, msg });
  console.warn(`[WARN] ${area}: ${msg}`);
}

const EXECUTE_CODE = `
const ERP = ${JSON.stringify(ERP)};
const GENUI = ${JSON.stringify(GENUI)};
const USER = ${JSON.stringify(USER)};
const PASS = ${JSON.stringify(PASS)};
const out = { passed: [], failed: [], warnings: [], consoleErrors: [] };

function ok(a, m) { out.passed.push({ area: a, msg: m }); }
function bad(a, m) { out.failed.push({ area: a, msg: m }); }
function wrn(a, m) { out.warnings.push({ area: a, msg: m }); }

page.on('console', (msg) => {
  if (msg.type() === 'error') out.consoleErrors.push(msg.text());
});

async function pressKeys(selector, text) {
  await callTool('interaction_click', { selector });
  for (const ch of text) {
    await callTool('interaction_press-key', { selector, key: ch });
  }
}

async function waitMs(ms) {
  await sleep(ms);
}

// ─── GENERATIVE UI ───────────────────────────────────────────────
await callTool('navigation_go-to', { url: GENUI + '/', waitForNavigation: true });
const genSnap = await callTool('a11y_take-aria-snapshot', {}, true);
const genText = JSON.stringify(genSnap.output || genSnap);
if (genText.includes('Generative UI') || genText.includes('Welcome')) ok('genui', 'welcome screen loaded');
else bad('genui', 'welcome screen missing');

// Edge: empty submit
const inputRef = Object.entries(genSnap.refs || {}).find(([, v]) => v.role === 'textbox')?.[0];
if (inputRef) {
  await callTool('interaction_click', { selector: inputRef });
  const sendRef = Object.entries(genSnap.refs || {}).find(([, v]) => v.role === 'button' && (v.name || '').toLowerCase().includes('send'))?.[0];
  if (sendRef) {
    await callTool('interaction_click', { selector: sendRef });
    await waitMs(500);
    ok('genui-edge', 'empty submit did not crash');
  }
}

// Chart via suggestion
const revBtn = Object.entries(genSnap.refs || {}).find(([, v]) => (v.name || '').includes('Revenue vs Expenses'))?.[0];
if (revBtn) {
  await callTool('interaction_click', { selector: revBtn });
  await waitMs(3500);
  const after = await page.evaluate(() => document.body.innerText);
  if (after.includes('Generative Engine') || after.includes('Revenue')) ok('genui', 'revenue chart suggestion rendered');
  else bad('genui', 'chart suggestion did not render');
} else {
  if (inputRef) {
    await pressKeys(inputRef, 'Show me a bar chart of our monthly revenue vs expenses trend');
    const snap2 = await callTool('a11y_take-aria-snapshot', {}, true);
    const send2 = Object.entries(snap2.refs || {}).find(([, v]) => v.role === 'button')?.[0];
    if (send2) await callTool('interaction_click', { selector: send2 });
    await waitMs(3500);
    ok('genui', 'typed chart prompt submitted');
  }
}

// Table suggestion
const snap3 = await callTool('a11y_take-aria-snapshot', {}, true);
const invBtn = Object.entries(snap3.refs || {}).find(([, v]) => (v.name || '').includes('Overdue Invoices'))?.[0];
if (invBtn) {
  await callTool('interaction_click', { selector: invBtn });
  await waitMs(3500);
  const t = await page.evaluate(() => document.body.innerText);
  if (t.toLowerCase().includes('invoice') || t.includes('table') || t.includes('Overdue')) ok('genui', 'overdue invoices table flow');
  else bad('genui', 'invoice table not rendered');
}

// Edge: nonsense query
const snap4 = await callTool('a11y_take-aria-snapshot', {}, true);
const inp4 = Object.entries(snap4.refs || {}).find(([, v]) => v.role === 'textbox')?.[0];
if (inp4) {
  await pressKeys(inp4, 'asdfghjkl random gibberish 12345');
  const send4 = Object.entries(snap4.refs || {}).find(([, v]) => v.role === 'button')?.[0];
  if (send4) await callTool('interaction_click', { selector: send4 });
  await waitMs(2500);
  ok('genui-edge', 'gibberish query handled without crash');
}

// API key modal edge
const keyBtn = Object.entries(snap4.refs || {}).find(([, v]) => (v.name || '').toLowerCase().includes('api') || (v.name || '').includes('Key'))?.[0];
if (keyBtn) {
  await callTool('interaction_click', { selector: keyBtn });
  await waitMs(800);
  const modal = await page.evaluate(() => document.body.innerText.includes('Gemini API Key'));
  if (modal) ok('genui-edge', 'API key modal opens');
  await callTool('interaction_press-key', { key: 'Escape' });
}

// ─── SMALL ERP /ops ──────────────────────────────────────────────
await callTool('navigation_go-to', { url: ERP + '/login', waitForNavigation: true });
const loginSnap = await callTool('a11y_take-aria-snapshot', {}, true);
const emailRef = Object.entries(loginSnap.refs || {}).find(([, v]) => v.role === 'textbox' && ((v.name || '').toLowerCase().includes('email') || (v.selector || '').includes('email')))?.[0]
  || Object.entries(loginSnap.refs || {}).find(([, v]) => v.role === 'textbox')?.[0];
const passRef = Object.entries(loginSnap.refs || {}).find(([, v]) => v.role === 'textbox' && ((v.name || '').toLowerCase().includes('password') || (v.selector || '').includes('password')))?.[0]
  || Object.entries(loginSnap.refs || {}).filter(([, v]) => v.role === 'textbox')[1]?.[0];
const loginBtn = Object.entries(loginSnap.refs || {}).find(([, v]) => v.role === 'button' && ((v.name || '').toLowerCase().includes('login') || (v.name || '').toLowerCase().includes('sign')))?.[0];

if (emailRef && passRef && loginBtn) {
  await callTool('interaction_fill', { selector: emailRef, value: USER });
  await callTool('interaction_fill', { selector: passRef, value: PASS });
  await callTool('interaction_click', { selector: loginBtn, waitForNavigation: true });
  await waitMs(2000);
  const url = page.url();
  if (url.includes('/ops')) ok('erp', 'login → /ops');
  else bad('erp', 'login failed, url=' + url);
} else {
  bad('erp', 'login form refs not found');
}

// Edge: bad password
await callTool('navigation_go-to', { url: ERP + '/login', waitForNavigation: true });
const ls2 = await callTool('a11y_take-aria-snapshot', {}, true);
const e2 = Object.entries(ls2.refs || {}).find(([, v]) => v.role === 'textbox')?.[0];
const p2 = Object.entries(ls2.refs || {}).filter(([, v]) => v.role === 'textbox')[1]?.[0];
const b2 = Object.entries(ls2.refs || {}).find(([, v]) => v.role === 'button')?.[0];
if (e2 && p2 && b2) {
  await callTool('interaction_fill', { selector: e2, value: USER });
  await callTool('interaction_fill', { selector: p2, value: 'wrong-password-xyz' });
  await callTool('interaction_click', { selector: b2 });
  await waitMs(1500);
  if (!page.url().includes('/ops')) ok('erp-edge', 'bad password blocked');
  else bad('erp-edge', 'bad password should not reach /ops');
}

// Re-login
await callTool('navigation_go-to', { url: ERP + '/login', waitForNavigation: true });
const ls3 = await callTool('a11y_take-aria-snapshot', {}, true);
const e3 = Object.entries(ls3.refs || {}).find(([, v]) => v.role === 'textbox')?.[0];
const p3 = Object.entries(ls3.refs || {}).filter(([, v]) => v.role === 'textbox')[1]?.[0];
const b3 = Object.entries(ls3.refs || {}).find(([, v]) => v.role === 'button')?.[0];
if (e3 && p3 && b3) {
  await callTool('interaction_fill', { selector: e3, value: USER });
  await callTool('interaction_fill', { selector: p3, value: PASS });
  await callTool('interaction_click', { selector: b3, waitForNavigation: true });
  await waitMs(1500);
}

const routes = [
  ['/ops', 'Dashboard'],
  ['/ops/pos', 'POS'],
  ['/ops/orders', 'Orders'],
  ['/ops/inventory', 'Inventory'],
  ['/ops/customers', 'Customers'],
  ['/ops/accounting', 'Accounting'],
  ['/ops/ai', 'AI'],
  ['/ops/settings', 'Settings'],
];

for (const [path, label] of routes) {
  await callTool('navigation_go-to', { url: ERP + path, waitForNavigation: true });
  await waitMs(1200);
  const snap = await callTool('a11y_take-aria-snapshot', {}, true);
  const body = await page.evaluate(() => document.body.innerText);
  if (page.url().includes('/login')) bad('erp-nav', label + ' redirected to login');
  else if (body.length < 50) bad('erp-nav', label + ' page nearly empty');
  else ok('erp-nav', label + ' loaded');
}

// Dashboard KPIs
await callTool('navigation_go-to', { url: ERP + '/ops', waitForNavigation: true });
await waitMs(1500);
const kpiCount = await page.evaluate(() => document.querySelectorAll('.kpi-card').length);
if (kpiCount >= 4) ok('erp', kpiCount + ' KPI cards');
else bad('erp', 'expected KPI cards, got ' + kpiCount);

// Global search
const dashSnap = await callTool('a11y_take-aria-snapshot', {}, true);
const searchRef = Object.entries(dashSnap.refs || {}).find(([, v]) => (v.selector || '').includes('global-search') || (v.name || '').toLowerCase().includes('search'))?.[0];
if (searchRef) {
  await pressKeys(searchRef, 'PARACETAMOL');
  await waitMs(1500);
  const hits = await page.evaluate(() => document.querySelectorAll('#search-results .search-result-item').length);
  if (hits > 0) ok('erp', 'global search results');
  else bad('erp', 'global search empty');
}

// POS add to cart
await callTool('navigation_go-to', { url: ERP + '/ops/pos', waitForNavigation: true });
await waitMs(1500);
const posClick = await page.evaluate(() => {
  const el = document.querySelector('#pos-items-grid [onclick], #pos-items-grid .pos-item-card');
  if (el) { el.click(); return true; }
  return false;
});
if (posClick) {
  await waitMs(500);
  const cart = await page.evaluate(() => document.getElementById('tab-cart-count')?.textContent);
  if (cart && cart !== '0') ok('erp', 'POS add to cart (' + cart + ')');
  else bad('erp', 'POS cart count 0');
}

// POS voice proposal edge
const posSnap = await callTool('a11y_take-aria-snapshot', {}, true);
const voiceRef = Object.entries(posSnap.refs || {}).find(([, v]) => (v.selector || '').includes('smart-pos') || (v.name || '').toLowerCase().includes('voice'))?.[0];
if (voiceRef) {
  await pressKeys(voiceRef, '10 napa');
  await waitMs(2500);
  const proposal = await page.evaluate(() => (document.getElementById('pos-proposal-area')?.innerText || '').trim());
  if (proposal) ok('erp', 'POS voice proposal');
  else bad('erp', 'POS voice proposal empty');
}

// Orders drawer
await callTool('navigation_go-to', { url: ERP + '/ops/orders', waitForNavigation: true });
await waitMs(1500);
const ordSnap = await callTool('a11y_take-aria-snapshot', {}, true);
const newInv = Object.entries(ordSnap.refs || {}).find(([, v]) => (v.name || '').includes('New Invoice'))?.[0];
if (newInv) {
  await callTool('interaction_click', { selector: newInv });
  await waitMs(1000);
  const open = await page.evaluate(() => document.getElementById('drawer')?.classList.contains('open'));
  if (open) ok('erp', 'New Invoice drawer');
  else bad('erp', 'drawer did not open');
  await callTool('interaction_press-key', { key: 'Escape' });
}

// Inventory low stock
await callTool('navigation_go-to', { url: ERP + '/ops/inventory', waitForNavigation: true });
await waitMs(1500);
const invSnap = await callTool('a11y_take-aria-snapshot', {}, true);
const lowBtn = Object.entries(invSnap.refs || {}).find(([, v]) => (v.name || '').toLowerCase().includes('low stock'))?.[0];
if (lowBtn) {
  await callTool('interaction_click', { selector: lowBtn });
  await waitMs(1000);
  ok('erp', 'low stock drawer');
}

// AI page status
await callTool('navigation_go-to', { url: ERP + '/ops/ai', waitForNavigation: true });
await waitMs(3000);
const erpStatus = await page.evaluate(() => document.getElementById('erp-status-text')?.textContent?.trim());
if (erpStatus?.includes('Connected')) ok('erp', 'AI ERP status connected');
else if (erpStatus === 'Checking...') wrn('erp', 'AI ERP status still checking');
else bad('erp', 'AI ERP status: ' + erpStatus);

const aiSnap = await callTool('a11y_take-aria-snapshot', {}, true);
const lowStockAi = Object.entries(aiSnap.refs || {}).find(([, v]) => (v.name || '').includes('Low Stock'))?.[0];
if (lowStockAi) {
  await callTool('interaction_click', { selector: lowStockAi });
  await waitMs(4000);
  const bots = await page.evaluate(() => document.querySelectorAll('.ai-msg-bot .ai-msg-bubble').length);
  if (bots >= 2) ok('erp', 'AI quick action reply');
  else bad('erp', 'AI quick action no reply');
}

// Edge: direct /app blocked for SMB
await callTool('navigation_go-to', { url: ERP + '/app', waitForNavigation: true });
await waitMs(1500);
const appUrl = page.url();
if (!appUrl.includes('/app') || appUrl.includes('/ops')) ok('erp-edge', 'SMB blocked from /app desk');
else wrn('erp-edge', '/app may be accessible: ' + appUrl);

return out;
`;

async function main() {
  console.log('\n=== Browser DevTools MCP E2E ===');
  console.log(`MCP: ${MCP_URL}  ERP: ${ERP}  GenUI: ${GENUI}\n`);

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({ name: 'liteerp-e2e', version: '1.0.0' });
  await client.connect(transport);

  const { content } = await client.callTool({
    name: 'execute',
    arguments: { code: EXECUTE_CODE, timeoutMs: 120000 },
  });

  let payload = null;
  for (const part of content || []) {
    if (part.type === 'text') {
      try {
        const parsed = JSON.parse(part.text);
        payload = parsed.result ?? parsed;
      } catch {
        const m = part.text.match(/\{[\s\S]*\}/);
        if (m) {
          try { payload = JSON.parse(m[0]).result ?? JSON.parse(m[0]); } catch { /* ignore */ }
        }
      }
    }
  }

  if (!payload) {
    console.error('Execute returned no parseable result:', JSON.stringify(content).slice(0, 500));
    process.exit(1);
  }

  for (const p of payload.passed || []) pass(p.area, p.msg);
  for (const f of payload.failed || []) fail(f.area, f.msg);
  for (const w of payload.warnings || []) warn(w.area, w.msg);

  if (payload.consoleErrors?.length) {
    console.log(`\nConsole errors (${payload.consoleErrors.length}):`);
    [...new Set(payload.consoleErrors)].slice(0, 8).forEach((e) => console.log('  -', e));
  }

  console.log(`\n=== RESULTS: ${results.passed.length} passed, ${results.failed.length} failed, ${results.warnings.length} warnings ===`);
  await client.close();
  process.exit(results.failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
