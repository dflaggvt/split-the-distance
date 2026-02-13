const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const url = 'https://split-the-distance-git-dev-daryl-flaggs-projects.vercel.app/';

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TESTING VERCEL BRANCH DEPLOYMENT');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('URL:', url, '\n');

  try {
    console.log('Navigating to URL...\n');
    const response = await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 20000 
    });
    
    const status = response.status();
    console.log('HTTP Status:', status);
    
    if (status === 404) {
      await page.screenshot({ path: '/tmp/vercel-branch-404.png' });
      console.log('\n✗ URL returned 404 - Deployment not found');
      console.log('Test stopped.');
      await browser.close();
      return;
    }
    
    await new Promise(r => setTimeout(r, 2000));
    
    const initialCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasApp: text.includes('Split The Distance'),
        hasModernUI: document.querySelector('[class*="teal"]') !== null ||
                     document.querySelector('[class*="cyan"]') !== null,
        hasMap: text.includes('Map') || document.querySelector('[class*="map"]') !== null,
        title: document.title,
        inputCount: document.querySelectorAll('input[type="text"]').length
      };
    });
    
    console.log('Page loaded:', initialCheck.hasApp ? 'YES' : 'NO');
    console.log('Modern UI (teal/cyan):', initialCheck.hasModernUI ? 'YES' : 'NO');
    console.log('Map visible:', initialCheck.hasMap ? 'YES' : 'NO');
    console.log('Inputs found:', initialCheck.inputCount);
    
    if (!initialCheck.hasApp) {
      console.log('\n⚠️  Page loaded but not the expected app');
      await page.screenshot({ path: '/tmp/vercel-branch-wrong.png', fullPage: true });
      await browser.close();
      return;
    }
    
    console.log('\n✓ App loaded successfully!\n');
    
    console.log('STEP 1: Homepage screenshot\n');
    await page.screenshot({ path: '/tmp/vercel-step1-home.png', fullPage: true });
    
    const layout = await page.evaluate(() => {
      const hasPanel = document.querySelector('[class*="panel"]') !== null ||
                      document.querySelector('[class*="sidebar"]') !== null;
      const hasMap = document.querySelector('[class*="map"]') !== null;
      return { hasPanel, hasMap };
    });
    
    console.log('Layout check:');
    console.log('  Left panel:', layout.hasPanel ? 'Present' : 'Unknown');
    console.log('  Map on right:', layout.hasMap ? 'YES' : 'NO');
    
    console.log('\n\nSTEP 2: Enter locations\n');
    
    const inputs = await page.$$('input[type="text"]');
    if (inputs.length < 2) {
      console.log('⚠️  Not enough inputs');
      await browser.close();
      return;
    }
    
    console.log('Typing "New York, NY"...');
    await inputs[0].click();
    await page.keyboard.type('New York, NY', { delay: 80 });
    await new Promise(r => setTimeout(r, 1500));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 500));
    
    console.log('Typing "Philadelphia, PA"...');
    await inputs[1].click();
    await page.keyboard.type('Philadelphia, PA', { delay: 80 });
    await new Promise(r => setTimeout(r, 1500));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 500));
    
    console.log('\n\nSTEP 3: Click Split The Distance\n');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('Split The Distance'));
      if (btn) btn.click();
    });
    
    console.log('Waiting 5 seconds for results...\n');
    await new Promise(r => setTimeout(r, 5000));
    
    await page.screenshot({ path: '/tmp/vercel-step3-results.png', fullPage: true });
    
    const step3 = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasMidpointCard: text.includes('Halfway') || text.includes('HALFWAY'),
        hasRoute: text.includes('mi') && (text.includes('min') || text.includes('hr')),
        hasFilterChips: text.includes('Food') && text.includes('Coffee') && text.includes('Parks')
      };
    });
    
    console.log('STEP 3 Results:');
    console.log('  Midpoint card:', step3.hasMidpointCard ? '✓ YES' : '✗ NO');
    console.log('  Map shows route:', step3.hasRoute ? '✓ YES' : '✗ NO');
    console.log('  Filter chips:', step3.hasFilterChips ? '✓ YES' : '✗ NO');
    
    console.log('\n\nSTEP 4: Click Food filter\n');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('Food') && !b.textContent.includes('Fast'));
      if (btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: '/tmp/vercel-step4-food.png', fullPage: true });
    
    const step4 = await page.evaluate(() => {
      const text = document.body.innerText;
      const placeMatches = text.match(/\d+\.?\d*\s*mi away/g);
      return { placeCount: placeMatches ? placeMatches.length : 0 };
    });
    
    console.log('STEP 4 Results:');
    console.log('  Place cards appeared:', step4.placeCount > 0 ? '✓ YES' : '✗ NO');
    console.log('  Place count:', step4.placeCount);
    
    console.log('\n\nSTEP 5: Click Route Options\n');
    const routeClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, div'));
      const routeBtn = elements.find(e => 
        e.textContent.includes('Route Options') || 
        e.textContent.includes('Route')
      );
      if (routeBtn) {
        routeBtn.click();
        return true;
      }
      return false;
    });
    
    console.log('Route Options clicked:', routeClicked ? 'YES' : 'NO');
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: '/tmp/vercel-step5-route-options.png', fullPage: true });
    
    console.log('\n\nSTEP 6: Add third location (Group Gravity)\n');
    const addClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a'));
      const addBtn = elements.find(e => 
        e.textContent.includes('Add person') || 
        e.textContent.includes('+ Add')
      );
      if (addBtn) {
        addBtn.click();
        return true;
      }
      return false;
    });
    
    console.log('Add person clicked:', addClicked ? 'YES' : 'NO');
    
    if (addClicked) {
      await new Promise(r => setTimeout(r, 1000));
      
      const newInputs = await page.$$('input[type="text"]');
      console.log('Input count after add:', newInputs.length);
      
      if (newInputs.length >= 3) {
        console.log('Typing "Baltimore, MD" in third input...');
        await newInputs[2].click();
        await page.keyboard.type('Baltimore, MD', { delay: 80 });
        await new Promise(r => setTimeout(r, 1500));
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 500));
        
        console.log('Clicking Split The Distance again...');
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent.includes('Split The Distance'));
          if (btn) btn.click();
        });
        
        console.log('Waiting 5 seconds for group results...\n');
        await new Promise(r => setTimeout(r, 5000));
        
        await page.screenshot({ path: '/tmp/vercel-step6-group.png', fullPage: true });
        
        const step6 = await page.evaluate(() => {
          const text = document.body.innerText;
          return {
            hasGroupCard: text.includes('Group Meeting Point'),
            hasThreeLocations: text.includes('New York') && 
                             text.includes('Philadelphia') && 
                             text.includes('Baltimore')
          };
        });
        
        console.log('STEP 6 Results:');
        console.log('  Group Meeting Point card:', step6.hasGroupCard ? '✓ YES' : '✗ NO');
        console.log('  Shows all 3 locations:', step6.hasThreeLocations ? '✓ YES' : '✗ NO');
      }
    }
    
    console.log('\n\n═══ CONSOLE ERRORS ═══');
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors.length);
      consoleErrors.slice(0, 5).forEach((err, i) => {
        console.log(`${i + 1}. ${err.substring(0, 150)}`);
      });
    } else {
      console.log('No errors ✓');
    }
    
  } catch (error) {
    console.log('\n✗ ERROR:', error.message);
    await page.screenshot({ path: '/tmp/vercel-branch-error.png' });
  }

  await browser.close();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
})();
