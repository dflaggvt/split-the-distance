import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Capture console messages
const consoleLogs = [];
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[STD]') || text.includes('gtag') || text.includes('GA4')) {
    consoleLogs.push(text);
  }
});

console.log('Loading splitthedistance.com...');
await page.goto('https://www.splitthedistance.com', { waitUntil: 'networkidle' });

// Wait for GA4 to load
await page.waitForTimeout(3000);

// Check if gtag exists
const gtagExists = await page.evaluate(() => typeof window.gtag === 'function');
console.log('gtag exists:', gtagExists);

// Check dataLayer
const dataLayerLength = await page.evaluate(() => window.dataLayer?.length || 0);
console.log('dataLayer entries:', dataLayerLength);

// Try a search
console.log('Entering locations...');
await page.fill('input[placeholder="Starting point"]', 'New York, NY');
await page.waitForTimeout(1500);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);

await page.fill('input[placeholder="Destination"]', 'Boston, MA');
await page.waitForTimeout(1500);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);

// Click search button
console.log('Clicking search...');
await page.click('button:has-text("Split The Distance")');
await page.waitForTimeout(5000);

// Print console logs
console.log('\n--- Console logs ---');
consoleLogs.forEach(log => console.log(log));

// Check dataLayer after search
const dataLayerAfter = await page.evaluate(() => JSON.stringify(window.dataLayer?.slice(-5) || []));
console.log('\nLast 5 dataLayer entries:', dataLayerAfter);

await browser.close();
