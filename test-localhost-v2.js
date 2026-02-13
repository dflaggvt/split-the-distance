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

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  COMPREHENSIVE APP TEST - localhost:3000 (v2)');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // TEST 1 - Homepage
    console.log('TEST 1 - HOMEPAGE\n');
    
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle0',
      timeout: 15000 
    });
    
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: '/tmp/v2-test1-homepage.png', fullPage: true });
    
    const test1 = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasHeader: text.includes('Split The Distance'),
        inputCount: document.querySelectorAll('input[type="text"]').length,
        hasButton: Array.from(document.querySelectorAll('button'))
          .some(b => b.textContent.includes('Split The Distance'))
      };
    });
    
    console.log('✓ Homepage loaded');
    console.log('  Header:', test1.hasHeader ? 'YES' : 'NO');
    console.log('  Input fields:', test1.inputCount);
    console.log('  Split button:', test1.hasButton ? 'YES' : 'NO');
    
    // TEST 2 - Basic Search with better autocomplete handling
    console.log('\n\nTEST 2 - BASIC SEARCH\n');
    
    // Get fresh references to inputs
    let inputs = await page.$$('input[type="text"]');
    
    // Fill first input
    console.log('Filling Person A input with "New York, NY"...');
    await inputs[0].click();
    await new Promise(r => setTimeout(r, 300));
    await page.keyboard.type('New York, NY', { delay: 100 });
    await new Promise(r => setTimeout(r, 2000));
    
    // Try Tab to accept suggestion
    await page.keyboard.press('Tab');
    await new Promise(r => setTimeout(r, 500));
    
    // Verify first input has value
    const input1Value = await page.evaluate(() => {
      const inp = document.querySelectorAll('input[type="text"]')[0];
      return inp ? inp.value : '';
    });
    console.log('  Person A value:', input1Value);
    
    // Get fresh reference to second input
    inputs = await page.$$('input[type="text"]');
    
    // Fill second input
    console.log('Filling Person B input with "Philadelphia, PA"...');
    await inputs[1].click();
    await new Promise(r => setTimeout(r, 300));
    await page.keyboard.type('Philadelphia, PA', { delay: 100 });
    await new Promise(r => setTimeout(r, 2000));
    
    // Try Tab to accept suggestion
    await page.keyboard.press('Tab');
    await new Promise(r => setTimeout(r, 500));
    
    // Verify second input has value
    const input2Value = await page.evaluate(() => {
      const inp = document.querySelectorAll('input[type="text"]')[1];
      return inp ? inp.value : '';
    });
    console.log('  Person B value:', input2Value);
    
    // Check if button is enabled
    const buttonState = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('Split The Distance'));
      return {
        exists: btn !== undefined,
        disabled: btn ? btn.disabled : true,
        classes: btn ? btn.className : ''
      };
    });
    
    console.log('  Button enabled:', !buttonState.disabled ? 'YES' : 'NO');
    
    if (!buttonState.disabled) {
      console.log('\nClicking "Split The Distance"...');
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.includes('Split The Distance'));
        if (btn) btn.click();
      });
      
      console.log('Waiting 7 seconds for API calls and results...\n');
      await new Promise(r => setTimeout(r, 7000));
      await page.screenshot({ path: '/tmp/v2-test2-results.png', fullPage: true });
      
      const test2 = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasMidpointCard: text.includes('Halfway') || text.includes('HALFWAY'),
          hasDistance: text.match(/\d+\.?\d*\s*mi/),
          hasDuration: text.match(/\d+\s*(min|hr)/),
          hasFilterChips: text.includes('Food') && text.includes('Coffee'),
          hasRouteInfo: text.includes('from') || text.includes('Route'),
          bodyText: text.substring(0, 500)
        };
      });
      
      console.log('✓ Results check:');
      console.log('  Midpoint card:', test2.hasMidpointCard ? 'YES' : 'NO');
      console.log('  Distance shown:', test2.hasDistance ? 'YES' : 'NO');
      console.log('  Duration shown:', test2.hasDuration ? 'YES' : 'NO');
      console.log('  Filter chips:', test2.hasFilterChips ? 'YES' : 'NO');
      console.log('  Route info:', test2.hasRouteInfo ? 'YES' : 'NO');
      
      if (test2.hasFilterChips) {
        // TEST 3 - Filter Chips
        console.log('\n\nTEST 3 - FILTER CHIPS\n');
        
        console.log('Clicking "Food" filter...');
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const foodBtn = btns.find(b => b.textContent === 'Food' || 
                                         (b.textContent.includes('Food') && !b.textContent.includes('Fast')));
          if (foodBtn) foodBtn.click();
        });
        
        await new Promise(r => setTimeout(r, 4000));
        await page.screenshot({ path: '/tmp/v2-test3-food.png', fullPage: true });
        
        const test3 = await page.evaluate(() => {
          const text = document.body.innerText;
          const distMatches = text.match(/\d+\.?\d*\s*mi\s+away/g);
          return {
            placeCount: distMatches ? distMatches.length : 0,
            hasOpenClosed: text.includes('Open') || text.includes('Closed'),
            hasPlaceCards: text.includes('Restaurant') || text.includes('Café')
          };
        });
        
        console.log('✓ Food filter applied');
        console.log('  Place count:', test3.placeCount);
        console.log('  Open/Closed badges:', test3.hasOpenClosed ? 'YES' : 'NO');
        
        // TEST 4 - Midpoint Mode Toggle
        console.log('\n\nTEST 4 - MIDPOINT MODE TOGGLE\n');
        
        const toggleInfo = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const timeBtn = btns.find(b => b.textContent === 'Time' || 
                                         (b.textContent.includes('Time') && !b.textContent.includes('Split')));
          const distBtn = btns.find(b => b.textContent === 'Distance' || 
                                         (b.textContent.includes('Distance') && !b.textContent.includes('Split')));
          return {
            hasTimeBtn: timeBtn !== undefined,
            hasDistBtn: distBtn !== undefined,
            timeBtnActive: timeBtn && timeBtn.className.includes('bg-teal'),
            distBtnActive: distBtn && distBtn.className.includes('bg-teal')
          };
        });
        
        console.log('Toggle buttons found:');
        console.log('  Time button:', toggleInfo.hasTimeBtn ? 'YES' : 'NO');
        console.log('  Distance button:', toggleInfo.hasDistBtn ? 'YES' : 'NO');
        
        if (toggleInfo.hasDistBtn && !toggleInfo.distBtnActive) {
          console.log('\nSwitching to Distance mode...');
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const distBtn = btns.find(b => b.textContent === 'Distance' || 
                                           (b.textContent.includes('Distance') && !b.textContent.includes('Split')));
            if (distBtn) distBtn.click();
          });
          
          await new Promise(r => setTimeout(r, 3000));
          await page.screenshot({ path: '/tmp/v2-test4-distance.png', fullPage: true });
          console.log('✓ Distance mode activated');
        } else {
          console.log('Distance mode already active or toggle not accessible');
        }
        
        // TEST 5 - Midpoint Roulette
        console.log('\n\nTEST 5 - MIDPOINT ROULETTE\n');
        
        const rouletteInfo = await page.evaluate(() => {
          const text = document.body.innerText;
          const btns = Array.from(document.querySelectorAll('button'));
          const rouletteBtn = btns.find(b => 
            b.textContent.includes('Surprise Me') || 
            b.textContent.includes('🎲')
          );
          return {
            found: rouletteBtn !== undefined,
            isComingSoon: text.includes('Coming Soon') && text.includes('Roulette'),
            buttonText: rouletteBtn ? rouletteBtn.textContent : null
          };
        });
        
        console.log('Roulette button:', rouletteInfo.found ? 'FOUND' : 'NOT FOUND');
        if (rouletteInfo.buttonText) {
          console.log('  Button text:', rouletteInfo.buttonText);
        }
        console.log('  Status:', rouletteInfo.isComingSoon ? 'Coming Soon' : 'Unknown');
        
        if (rouletteInfo.found && !rouletteInfo.isComingSoon) {
          console.log('\nClicking Surprise Me...');
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const rouletteBtn = btns.find(b => b.textContent.includes('Surprise Me') || b.textContent.includes('🎲'));
            if (rouletteBtn) rouletteBtn.click();
          });
          
          await new Promise(r => setTimeout(r, 3000));
          await page.screenshot({ path: '/tmp/v2-test5-roulette.png', fullPage: true });
          
          const test5 = await page.evaluate(() => {
            const text = document.body.innerText;
            return {
              hasResult: text.includes('Revealed') || text.includes('Found'),
              hasSpinAgain: text.includes('Spin Again')
            };
          });
          
          console.log('✓ Roulette activated');
          console.log('  Result shown:', test5.hasResult ? 'YES' : 'NO');
          console.log('  Spin Again button:', test5.hasSpinAgain ? 'YES' : 'NO');
        }
        
        // TEST 6 - Road Trip Mode
        console.log('\n\nTEST 6 - ROAD TRIP MODE\n');
        
        const roadTripInfo = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const rtBtn = btns.find(b => 
            b.textContent.includes('Plan Stops') || 
            b.textContent.includes('Road Trip') ||
            b.textContent.includes('🛣️')
          );
          return {
            found: rtBtn !== undefined,
            isPremium: rtBtn && (rtBtn.textContent.includes('PRO') || rtBtn.textContent.includes('🔒')),
            text: rtBtn ? rtBtn.textContent : null
          };
        });
        
        console.log('Road Trip button:', roadTripInfo.found ? 'FOUND' : 'NOT FOUND');
        if (roadTripInfo.found) {
          console.log('  Button text:', roadTripInfo.text);
          console.log('  Premium locked:', roadTripInfo.isPremium ? 'YES' : 'NO');
          console.log('  Note: NYC-Philly route is ~1.5 hrs, may be too short for this feature');
        }
        
        // TEST 7 - Group Gravity
        console.log('\n\nTEST 7 - GROUP GRAVITY (3 LOCATIONS)\n');
        
        const addPersonInfo = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('button, a'));
          const addBtn = elements.find(e => 
            e.textContent.includes('Add person') || 
            e.textContent.includes('+ Add')
          );
          return {
            found: addBtn !== undefined,
            text: addBtn ? addBtn.textContent : null
          };
        });
        
        console.log('Add person button:', addPersonInfo.found ? 'FOUND' : 'NOT FOUND');
        if (addPersonInfo.text) {
          console.log('  Button text:', addPersonInfo.text);
        }
        
        if (addPersonInfo.found) {
          console.log('\nClicking Add person...');
          await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, a'));
            const addBtn = elements.find(e => e.textContent.includes('Add person') || e.textContent.includes('+ Add'));
            if (addBtn) addBtn.click();
          });
          
          await new Promise(r => setTimeout(r, 1500));
          
          const modalCheck = await page.evaluate(() => {
            const text = document.body.innerText;
            return {
              hasModal: text.includes('Sign in') || text.includes('Log in') || text.includes('Continue with'),
              hasThirdInput: document.querySelectorAll('input[type="text"]').length >= 3
            };
          });
          
          if (modalCheck.hasModal) {
            console.log('⚠️  Sign-in modal appeared (authentication required)');
            await page.screenshot({ path: '/tmp/v2-test7-modal.png', fullPage: true });
          } else if (modalCheck.hasThirdInput) {
            console.log('✓ Third input added (user is authenticated)');
            await page.screenshot({ path: '/tmp/v2-test7-three-inputs.png', fullPage: true });
          }
        }
        
        // TEST 8 - Drift Radius
        console.log('\n\nTEST 8 - DRIFT RADIUS\n');
        
        const driftInfo = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('button, div, label'));
          const driftEl = elements.find(e => 
            e.textContent.includes('Drift Radius') || 
            e.textContent.includes('🎯')
          );
          return {
            found: driftEl !== undefined,
            isPremium: driftEl && (driftEl.textContent.includes('PRO') || driftEl.textContent.includes('🔒')),
            text: driftEl ? driftEl.textContent.trim() : null
          };
        });
        
        console.log('Drift Radius element:', driftInfo.found ? 'FOUND' : 'NOT FOUND');
        if (driftInfo.found) {
          console.log('  Text:', driftInfo.text);
          console.log('  Premium locked:', driftInfo.isPremium ? 'YES' : 'NO');
          await page.screenshot({ path: '/tmp/v2-test8-drift.png', fullPage: true });
        }
      } else {
        console.log('\n⚠️  Could not proceed to subsequent tests - no filter chips found');
        console.log('This suggests the route calculation may have failed');
      }
    } else {
      console.log('\n⚠️  Split button remained disabled - inputs may not have been filled correctly');
      await page.screenshot({ path: '/tmp/v2-test2-button-disabled.png', fullPage: true });
    }
    
    // Console Errors
    console.log('\n\n═══ CONSOLE ERRORS ═══');
    if (consoleErrors.length > 0) {
      console.log('Total:', consoleErrors.length);
      consoleErrors.slice(0, 5).forEach((err, i) => {
        console.log(`${i + 1}. ${err.substring(0, 150)}`);
      });
    } else {
      console.log('No errors ✓');
    }
    
  } catch (error) {
    console.log('\n✗ ERROR:', error.message);
    await page.screenshot({ path: '/tmp/v2-error.png' });
  }

  await browser.close();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TEST SUITE COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
})();
