import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture console
const logs = [];
page.on('console', msg => {
  if (msg.text().includes('[STD]')) logs.push(msg.text());
});

// Use the dev preview URL (need to find it) or test locally
// For now, let's just verify the code compiles and run locally
console.log('Starting dev server...');
