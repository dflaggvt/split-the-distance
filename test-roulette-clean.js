const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  console.log('Testing Roulette\n');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.type('input[placeholder*="Starting"]', 'New York, NY');
  await new Promise(r => setTimeout(r, 800));
  await page.keyboard.press('Tab');
  await page.type('input[placeholder*="Destination"]', 'Philadelphia, PA');
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Split The Distance')?.click());
  await new Promise(r => setTimeout(r, 10000));
  await page.screenshot({ path: '/tmp/final-step5.png' });
  const step5 = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('🎲'));
    return { found: !!btn };
  });
  console.log('Surprise Me found:', step5.found ? 'YES' : 'NO');
  if (step5.found) {
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('🎲'))?.click());
    await new Promise(r => setTimeout(r, 3500));
    await page.screenshot({ path: '/tmp/final-step8.png' });
    const step8 = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        party: t.includes('🎉'),
        spinAgain: t.includes('Spin Again'),
        place: t.includes('mi away'),
        dirs: t.includes('Get Directions')
      };
    });
    console.log('Party:', step8.party ? 'YES' : 'NO');
    console.log('Place:', step8.place ? 'YES' : 'NO');
    console.log('Directions:', step8.dirs ? 'YES' : 'NO');
    console.log('Spin Again:', step8.spinAgain ? 'YES' : 'NO');
    if (step8.spinAgain) {
      await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Spin Again'))?.click());
      await new Promise(r => setTimeout(r, 3500));
      await page.screenshot({ path: '/tmp/final-step10.png' });
      console.log('Second roll tested');
    }
  }
  await browser.close();
  console.log('Done');
})();
