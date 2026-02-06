import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[STD]') || text.includes('error') || text.includes('Error') || text.includes('MAX')) {
    console.log('CONSOLE:', text);
  }
});

console.log('Loading site...');
await page.goto('https://www.splitthedistance.com', { waitUntil: 'networkidle' });
await page.waitForSelector('input[placeholder*="Starting"]', { timeout: 10000 });

// Alaska to Argentina - same landmass but 15,000+ km
console.log('Entering Anchorage, Alaska...');
const fromInput = page.locator('input[placeholder*="Starting"]');
await fromInput.click();
await fromInput.fill('Anchorage, Alaska');
await page.waitForTimeout(2000);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);

console.log('Entering Buenos Aires, Argentina...');
const toInput = page.locator('input[placeholder*="Destination"]');
await toInput.click();
await toInput.fill('Buenos Aires, Argentina');
await page.waitForTimeout(2000);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);

console.log('Clicking search...');
await page.locator('button:has-text("Split The Distance")').click();
console.log('Waiting for result...');

await page.waitForTimeout(10000);

const bodyText = await page.evaluate(() => document.body.innerText);
console.log('\n--- RESULT ---');
if (bodyText.includes('too long') || bodyText.includes('6,000')) {
  console.log('✅ SUCCESS: Friendly MAX_ROUTE_LENGTH message shown!');
} else if (bodyText.includes('MAX_ROUTE_LENGTH')) {
  console.log('❌ FAIL: Raw error shown');
} else if (bodyText.includes('No route found')) {
  console.log('⚠️ Got ZERO_RESULTS (no route exists)');
} else if (bodyText.includes('miles') || bodyText.includes('minutes')) {
  console.log('⚠️ Route actually worked! (under 10k km?)');
}
console.log('--- END ---');

await page.screenshot({ path: 'test-long-route.png', fullPage: true });
await browser.close();
