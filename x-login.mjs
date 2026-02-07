import { chromium } from 'playwright';

const browser = await chromium.launch({ 
  headless: true,
  args: ['--disable-blink-features=AutomationControlled']
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
});

const page = await context.newPage();

console.log('Navigating to X...');
await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });

await page.waitForTimeout(5000);
await page.screenshot({ path: 'x-login.png', fullPage: true });

console.log('Page title:', await page.title());
console.log('Screenshot saved: x-login.png');

await browser.close();
