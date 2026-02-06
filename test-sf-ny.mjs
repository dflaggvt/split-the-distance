import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('error') || text.includes('Error') || text.includes('MAX') || text.includes('ROUTE')) {
    console.log('CONSOLE:', text);
  }
});

console.log('Loading site...');
await page.goto('https://www.splitthedistance.com', { waitUntil: 'networkidle' });
await page.waitForSelector('input[placeholder*="Starting"]', { timeout: 10000 });

console.log('Entering San Francisco...');
const fromInput = page.locator('input[placeholder*="Starting"]');
await fromInput.click();
await fromInput.fill('San Francisco, CA');
await page.waitForTimeout(2000);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);

console.log('Entering New York...');
const toInput = page.locator('input[placeholder*="Destination"]');
await toInput.click();
await toInput.fill('New York, NY');
await page.waitForTimeout(2000);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);

console.log('Clicking search...');
await page.locator('button:has-text("Split The Distance")').click();
console.log('Waiting for result...');

await page.waitForTimeout(10000);

// Get page text
const bodyText = await page.evaluate(() => document.body.innerText);

if (bodyText.includes('too long') || bodyText.includes('6,000')) {
  console.log('❌ Got MAX_ROUTE_LENGTH error (friendly message)');
} else if (bodyText.includes('MAX_ROUTE_LENGTH')) {
  console.log('❌ Got raw MAX_ROUTE_LENGTH_EXCEEDED');
} else if (bodyText.includes('No route found')) {
  console.log('❌ Got ZERO_RESULTS error');
} else if (bodyText.includes('miles') && bodyText.includes('hour')) {
  console.log('✅ SUCCESS - Route calculated!');
  // Extract the distance/time
  const match = bodyText.match(/(\d[\d,]*)\s*miles.*?(\d+)\s*h/);
  if (match) {
    console.log(`Distance: ${match[1]} miles, Time: ${match[2]}+ hours`);
  }
} else if (bodyText.includes('Routing failed')) {
  console.log('❌ Got routing error');
  // Find the error
  const errorMatch = bodyText.match(/Routing failed[^\n]*/);
  if (errorMatch) console.log('Error:', errorMatch[0]);
}

await page.screenshot({ path: 'test-sf-ny.png', fullPage: true });
console.log('Screenshot saved: test-sf-ny.png');

await browser.close();
