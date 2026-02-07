import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
});

const page = await context.newPage();

await page.goto('https://www.splitthedistance.com', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(5000);

// Get detailed info about the map
const mapInfo = await page.evaluate(() => {
  const gmStyle = document.querySelector('.gm-style');
  if (!gmStyle) return { error: 'No .gm-style found' };
  
  const styles = window.getComputedStyle(gmStyle);
  const parent = gmStyle.parentElement;
  const parentStyles = parent ? window.getComputedStyle(parent) : null;
  
  return {
    gmStyleDimensions: {
      width: gmStyle.offsetWidth,
      height: gmStyle.offsetHeight,
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
    },
    parentDimensions: parent ? {
      width: parent.offsetWidth,
      height: parent.offsetHeight,
      display: parentStyles.display,
      overflow: parentStyles.overflow,
    } : null,
    canvasCount: document.querySelectorAll('canvas').length,
    iframeCount: document.querySelectorAll('iframe').length,
  };
});

console.log('Map info:', JSON.stringify(mapInfo, null, 2));

await page.screenshot({ path: 'mobile-test.png' });
await browser.close();
