const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log('🚀 Starting screen capture script...');
  const artifactsDir = '/Users/qmranik/.gemini/antigravity/brain/af336af7-25fe-4369-83e1-cd09e1b153e4';
  
  // Launch headless browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set consistent responsive viewport
  await page.setViewport({ width: 1200, height: 800 });
  
  try {
    // 1. Navigate to locally running project
    console.log('📡 Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    
    // Wait for the welcome card to load
    await page.waitForSelector('h2');
    
    // Capture Welcome Screen
    const welcomePath = path.join(artifactsDir, 'welcome_screen.png');
    console.log(`📸 Capturing Welcome Screen -> ${welcomePath}`);
    await page.screenshot({ path: welcomePath });
    
    // 2. Query 1: Chart Generation
    console.log('✍️ Inputting prompt: "Show me a bar chart of our monthly revenue vs expenses trend"...');
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Type e.g."]');
      input.value = 'Show me a bar chart of our monthly revenue vs expenses trend';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      const form = document.querySelector('form');
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    });
    
    // Wait for loader to start and then finish (approx 2s in mock mode)
    console.log('⌛ Waiting for chart component to generate and render...');
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Capture Chart Screen
    const chartPath = path.join(artifactsDir, 'chart_rendered.png');
    console.log(`📸 Capturing Chart Screen -> ${chartPath}`);
    await page.screenshot({ path: chartPath });
    
    // 3. Query 2: Table Generation
    console.log('✍️ Inputting prompt: "List all overdue invoices in a table"...');
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Type e.g."]');
      input.value = 'List all overdue invoices in a table';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      const form = document.querySelector('form');
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    });
    
    console.log('⌛ Waiting for table component to generate and render...');
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Capture Table Screen
    const tablePath = path.join(artifactsDir, 'table_rendered.png');
    console.log(`📸 Capturing Table Screen -> ${tablePath}`);
    await page.screenshot({ path: tablePath });

    // 4. Query 3: KPI Metrics Generation
    console.log('✍️ Inputting prompt: "Give me a KPI summary of our core business metrics"...');
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Type e.g."]');
      input.value = 'Give me a KPI summary of our core business metrics';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      const form = document.querySelector('form');
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    });
    
    console.log('⌛ Waiting for KPI metrics component to generate and render...');
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Capture KPI Metrics Screen
    const metricsPath = path.join(artifactsDir, 'metrics_rendered.png');
    console.log(`📸 Capturing KPI Metrics Screen -> ${metricsPath}`);
    await page.screenshot({ path: metricsPath });
    
    console.log('✅ Flow captured successfully! All screenshots saved to artifacts directory.');
    
  } catch (error) {
    console.error('❌ Screen capture failed:', error);
  } finally {
    await browser.close();
  }
})();
