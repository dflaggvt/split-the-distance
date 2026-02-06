import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

console.log('Doing 3 quick searches to verify GA4...\n');

for (let i = 1; i <= 3; i++) {
  console.log(`Search ${i}...`);
  await page.goto('https://www.splitthedistance.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  await page.fill('input[placeholder="Starting point"]', i === 1 ? 'Chicago, IL' : i === 2 ? 'Miami, FL' : 'Seattle, WA');
  await page.waitForTimeout(1000);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  await page.fill('input[placeholder="Destination"]', i === 1 ? 'Detroit, MI' : i === 2 ? 'Orlando, FL' : 'Portland, OR');
  await page.waitForTimeout(1000);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  await page.click('button:has-text("Split The Distance")');
  await page.waitForTimeout(3000);
  console.log(`  ✓ Search ${i} completed`);
}

console.log('\n✅ 3 searches sent to GA4. Check Realtime report now!');
await browser.close();
