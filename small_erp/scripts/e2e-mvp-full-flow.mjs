/**
 * Full real-user flow E2E for docker-compose.mvp.yml
 * Run: node small_erp/scripts/e2e-mvp-full-flow.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.OPS_URL || 'http://localhost:8000';
const USER = process.env.OPS_USER || 'operator@test.local';
const PASS = process.env.OPS_PASS || 'operator123';

const issues = [];
const passes = [];

function fail(area, msg) {
  issues.push({ area, msg });
  console.error(`[FAIL] ${area}: ${msg}`);
}

function ok(area, msg) {
  passes.push({ area, msg });
  console.log(`[OK] ${area}: ${msg}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#login-email', USER);
  await page.fill('#login-password', PASS);
  await page.click('#login-btn');
  await page.waitForURL(/\/ops/, { timeout: 20000 });
  ok('login', `landed on ${page.url()}`);
}

async function clickSidebar(page, href, label) {
  await page.locator(`.sidebar-nav a[href="${href}"]`).click();
  await page.waitForURL(new RegExp(href.replace('/', '\\/') + '(\\?|$)'), { timeout: 10000 });
  if (page.url().includes('/login')) fail('nav', `${label} redirected to login`);
  else ok('nav', `${label} via sidebar`);
}

async function testDashboard(page) {
  await page.goto(`${BASE}/ops`, { waitUntil: 'networkidle' });
  const kpis = await page.locator('#kpi-container .kpi-card').count();
  if (kpis >= 4) ok('dashboard', `${kpis} KPI cards`);
  else fail('dashboard', `expected KPI cards, got ${kpis}`);
  await page.click('#chart-weekly');
  await page.click('a[href="/ops/pos"]');
  await page.waitForURL(/\/ops\/pos/);
  ok('dashboard', 'quick action → POS');
}

async function testPOS(page) {
  await page.goto(`${BASE}/ops/pos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const item = page.locator('#pos-items-grid [onclick], #pos-items-grid .pos-item-card').first();
  if (await item.count() === 0) {
    fail('pos', 'no items in grid');
    return;
  }
  await item.click();
  await page.waitForTimeout(400);
  const count = await page.locator('#tab-cart-count').textContent();
  if (count !== '0') ok('pos', `added to cart (${count})`);
  else fail('pos', 'cart count still 0');
  await page.locator('#smart-pos-input').pressSequentially('10 napa', { delay: 40 });
  await page.waitForTimeout(2500);
  const proposal = (await page.locator('#pos-proposal-area').innerText()).trim();
  if (proposal) ok('pos', 'voice proposal rendered');
  else fail('pos', 'voice proposal empty');
}

async function testOrders(page) {
  await page.goto(`${BASE}/ops/orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const rows = await page.locator('#orders-table-body tr').count();
  if (rows > 0) ok('orders', `${rows} rows in table`);
  else fail('orders', 'empty orders table');
  await page.click('button:has-text("New Invoice")');
  await page.waitForSelector('#drawer.open', { timeout: 5000 }).catch(() =>
    fail('orders', 'New Invoice drawer did not open'));
  await page.keyboard.press('Escape');
}

async function testInventory(page) {
  await page.goto(`${BASE}/ops/inventory`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const rows = await page.locator('#items-table-body tr').count();
  if (rows > 0) ok('inventory', `${rows} items listed`);
  else fail('inventory', 'empty inventory');
  await page.click('button:has-text("Add Item")');
  await page.waitForSelector('#drawer.open', { timeout: 5000 }).catch(() =>
    fail('inventory', 'Add Item drawer failed'));
  await page.keyboard.press('Escape');
  await page.click('button:has-text("Low Stock")');
  await page.waitForTimeout(800);
  ok('inventory', 'low stock drawer opened');
  await page.keyboard.press('Escape');
}

async function testCustomers(page) {
  await page.goto(`${BASE}/ops/customers`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const rows = await page.locator('#cust-table-body tr').count();
  if (rows > 0) ok('customers', `${rows} customers`);
  else fail('customers', 'empty customers');
  await page.click('button:has-text("Add Customer")');
  await page.waitForSelector('#drawer.open', { timeout: 5000 }).catch(() =>
    fail('customers', 'Add Customer drawer failed'));
  await page.keyboard.press('Escape');
}

async function testAccounting(page) {
  await page.goto(`${BASE}/ops/accounting`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#pnl-cards .kpi-card', { timeout: 15000 }).catch(() =>
    fail('accounting', 'P&L cards missing'));
  const cards = await page.locator('#pnl-cards .kpi-card').count();
  if (cards >= 3) ok('accounting', `${cards} P&L cards`);
  await page.click('button:has-text("Last Month")');
  await page.waitForTimeout(800);
  ok('accounting', 'period toggle works');
}

async function testAI(page) {
  await page.goto(`${BASE}/ops/ai`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const input = page.locator('#ai-input');
  if (await input.count() === 0) {
    fail('ai', '#ai-input missing');
    return;
  }
  ok('ai', 'chat input present');
  await page.waitForFunction(() => {
    const t = document.getElementById('erp-status-text')?.textContent?.trim();
    return t && t !== 'Checking...';
  }, { timeout: 15000 });
  const erpStatus = await page.locator('#erp-status-text').textContent();
  if (erpStatus?.includes('Connected')) ok('ai', 'ERP status connected');
  else fail('ai', `ERP status: ${erpStatus}`);
  await page.click('button:has-text("Low Stock Alerts")');
  await page.waitForTimeout(3000);
  const msgs = await page.locator('.ai-msg-bot .ai-msg-bubble').count();
  if (msgs >= 2) ok('ai', 'quick action produced bot reply');
  else fail('ai', 'quick action did not produce reply');
}

async function testSettings(page) {
  await page.goto(`${BASE}/ops/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const profile = await page.locator(':text("My Profile")').count();
  if (profile) ok('settings', 'profile section visible');
  else fail('settings', 'profile section missing');
}

async function testGlobalSearch(page) {
  await page.goto(`${BASE}/ops`, { waitUntil: 'networkidle' });
  const search = page.locator('#global-search');
  if (await search.count() === 0) {
    fail('shell', 'global search input missing');
    return;
  }
  await search.pressSequentially('PARACETAMOL', { delay: 40 });
  await page.waitForTimeout(1200);
  const results = await page.locator('#search-results .search-result-item').count();
  if (results > 0) ok('shell', 'global search dropdown');
  else fail('shell', 'global search no results');
}

async function testSidebarFlow(page) {
  await page.goto(`${BASE}/ops`, { waitUntil: 'networkidle' });
  const links = [
    ['/ops/pos', 'POS'],
    ['/ops/orders', 'Orders'],
    ['/ops/inventory', 'Inventory'],
    ['/ops/customers', 'Customers'],
    ['/ops/accounting', 'Accounting'],
    ['/ops/ai', 'AI'],
    ['/ops/settings', 'Settings'],
    ['/ops', 'Dashboard'],
  ];
  for (const [href, label] of links) {
    await clickSidebar(page, href, label);
    await page.waitForTimeout(500);
  }
}

async function main() {
  console.log(`\n=== MVP Full Flow E2E ===`);
  console.log(`URL: ${BASE}  User: ${USER}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  try {
    await login(page);
    await testSidebarFlow(page);
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
    fail('fatal', e.message);
  } finally {
    await browser.close();
  }

  console.log(`\n=== RESULTS: ${passes.length} passed, ${issues.length} failed ===`);
  if (issues.length) {
    issues.forEach((i) => console.log(`  FAIL [${i.area}] ${i.msg}`));
  }
  if (consoleErrors.length) {
    console.log(`\nConsole errors (${consoleErrors.length}):`);
    consoleErrors.slice(0, 5).forEach((e) => console.log(`  - ${e.slice(0, 120)}`));
  }
  process.exit(issues.length ? 1 : 0);
}

main();
