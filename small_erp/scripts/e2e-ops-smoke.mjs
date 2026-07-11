/**
 * Browser smoke test for /ops — run: node small_erp/scripts/e2e-ops-smoke.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.OPS_URL || 'http://localhost:8000';
const USER = process.env.OPS_USER || 'operator@test.local';
const PASS = process.env.OPS_PASS || 'operator123';

const issues = [];

function logIssue(page, msg) {
  issues.push({ page, msg });
  console.error(`[ISSUE] ${page}: ${msg}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#login-email', USER);
  await page.fill('#login-password', PASS);
  await page.click('#login-btn');
  await page.waitForURL(/\/ops/, { timeout: 15000 });
  if (!page.url().includes('/ops')) {
    throw new Error(`Login failed — at ${page.url()}`);
  }
}

async function assertNoConsoleErrors(page, label) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function waitForSpinnerGone(page, timeout = 10000) {
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('.content-loading .spinner');
    return spinners.length === 0 || [...spinners].every((s) => !s.offsetParent);
  }, { timeout }).catch(() => {});
}

async function testDashboard(page) {
  await page.goto(`${BASE}/ops`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#kpi-container .kpi-card', { timeout: 15000 }).catch(() =>
    logIssue('dashboard', 'KPI cards did not render'));
  await page.click('#chart-weekly').catch(() =>
    logIssue('dashboard', 'Weekly chart toggle missing'));
  await page.waitForTimeout(500);
}

async function testGlobalSearch(page) {
  await page.goto(`${BASE}/ops`, { waitUntil: 'networkidle' });
  const desktopSearch = page.locator('#global-search');
  if (await desktopSearch.count()) {
    await desktopSearch.pressSequentially('PARACETAMOL', { delay: 30 });
  } else {
    await page.click('.mobile-search-fab').catch(() => {});
    await page.locator('#mobile-global-search').pressSequentially('PARACETAMOL', { delay: 30 });
  }
  await page.waitForTimeout(1000);
  const results = await page.locator('#search-results .search-result-item, #mobile-search-results .search-result-item').count();
  if (results === 0) logIssue('shell', 'Global search returned no dropdown results');
}

async function testPOS(page) {
  await page.goto(`${BASE}/ops/pos`, { waitUntil: 'networkidle' });
  await waitForSpinnerGone(page);
  const items = await page.locator('#pos-items-grid .pos-item-card, #pos-items-grid [onclick]').count();
  if (items === 0) logIssue('pos', 'No POS items in grid');
  else {
    await page.locator('#pos-items-grid .pos-item-card, #pos-items-grid [onclick]').first().click();
    await page.waitForTimeout(300);
    const cartCount = await page.locator('#tab-cart-count').textContent();
    if (cartCount === '0') logIssue('pos', 'Add to cart did not update count');
  }
  await page.locator('#smart-pos-input').pressSequentially('10 napa', { delay: 30 });
  await page.waitForTimeout(2500);
  const proposal = await page.locator('#pos-proposal-area').innerText();
  if (!proposal.trim()) logIssue('pos', 'Voice proposal area empty after query');
}

async function testOrders(page) {
  await page.goto(`${BASE}/ops/orders`, { waitUntil: 'networkidle' });
  await waitForSpinnerGone(page);
  const rows = await page.locator('#orders-table-body tr').count();
  if (rows === 0) logIssue('orders', 'Orders table empty');
  await page.click('button:has-text("New Invoice")');
  await page.waitForTimeout(500);
  const drawer = await page.locator('#drawer.open').count();
  if (drawer === 0) logIssue('orders', 'New Invoice drawer did not open');
  await page.click('#drawer .btn-secondary:has-text("x"), #drawer button[onclick*="closeDrawer"]').catch(() => page.keyboard.press('Escape'));
}

async function testInventory(page) {
  await page.goto(`${BASE}/ops/inventory`, { waitUntil: 'networkidle' });
  await waitForSpinnerGone(page);
  const rows = await page.locator('#items-table-body tr').count();
  if (rows === 0) logIssue('inventory', 'Inventory table empty');
  await page.click('button:has-text("Add Item")');
  await page.waitForTimeout(400);
  if (await page.locator('#drawer.open').count() === 0) logIssue('inventory', 'Add Item drawer failed');
  await page.keyboard.press('Escape');
}

async function testCustomers(page) {
  await page.goto(`${BASE}/ops/customers`, { waitUntil: 'networkidle' });
  await waitForSpinnerGone(page);
  const rows = await page.locator('#cust-table-body tr').count();
  if (rows === 0) logIssue('customers', 'Customers table empty');
  await page.click('button:has-text("Add Customer")');
  await page.waitForTimeout(400);
  if (await page.locator('#drawer.open').count() === 0) logIssue('customers', 'Add Customer drawer failed');
  await page.keyboard.press('Escape');
}

async function testAccounting(page) {
  await page.goto(`${BASE}/ops/accounting`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#pnl-cards .kpi-card', { timeout: 15000 }).catch(() =>
    logIssue('accounting', 'P&L cards did not load'));
}

async function testAI(page) {
  await page.goto(`${BASE}/ops/ai`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const chat = await page.locator('#ai-chat-input, input[placeholder*="Ask"]').count();
  if (chat === 0) logIssue('ai', 'AI chat input missing');
}

async function testSettings(page) {
  await page.goto(`${BASE}/ops/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const profile = await page.locator('text=My Profile').count();
  if (profile === 0) logIssue('settings', 'Settings profile section missing');
}

async function testSidebarNav(page) {
  const routes = ['/ops', '/ops/pos', '/ops/orders', '/ops/inventory', '/ops/customers', '/ops/accounting', '/ops/ai', '/ops/settings'];
  for (const route of routes) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    if (!page.url().includes(route.replace('/ops', '/ops'))) {
      logIssue('nav', `Failed to load ${route}`);
    }
    if (page.url().includes('/login')) {
      logIssue('nav', `Redirected to login from ${route}`);
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log(`Testing ${BASE} as ${USER}`);
  try {
    await login(page);
    console.log('Login OK');
    await testSidebarNav(page);
    await testDashboard(page);
    await testGlobalSearch(page);
    await testPOS(page);
    await testOrders(page);
    await testInventory(page);
    await testCustomers(page);
    await testAccounting(page);
    await testAI(page);
    await testSettings(page);
  } catch (e) {
    console.error('Fatal:', e.message);
    issues.push({ page: 'fatal', msg: e.message });
  } finally {
    await browser.close();
  }

  console.log('\n=== E2E SUMMARY ===');
  if (issues.length === 0) {
    console.log('All checks passed.');
    process.exit(0);
  } else {
    issues.forEach((i) => console.log(`- [${i.page}] ${i.msg}`));
    process.exit(1);
  }
}

main();
