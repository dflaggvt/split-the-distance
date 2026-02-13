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
  console.log('  COMPREHENSIVE APP TEST - localhost:3000');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // TEST 1 - Homepage
    console.log('TEST 1 - HOMEPAGE\n');
    console.log('Navigating to http://localhost:3000...\n');
    
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle0',
      timeout: 15000 
    });
    
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: '/tmp/test1-homepage.png', fullPage: true });
    
    const test1 = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasHeader: text.includes('Split The Distance') || text.includes('SPLIT THE DISTANCE'),
        inputCount: document.querySelectorAll('input[type="text"]').length,
        hasButton: document.querySelector('button') !== null,
        hasEmptyState: text.includes('How It Works') || text.includes('Enter') || 
                       document.querySelector('svg') !== null
      };
    });
    
    console.log('✓ Page loaded');
    console.log('  Header present:', test1.hasHeader ? 'YES' : 'NO');
    console.log('  Input fields:', test1.inputCount);
    console.log('  Button present:', test1.hasButton ? 'YES' : 'NO');
    console.log('  Empty state/illustration:', test1.hasEmptyState ? 'YES' : 'NO');
    
    // TEST 2 - Basic Search
    console.log('\n\nTEST 2 - BASIC SEARCH\n');
    
    const inputs = await page.$$('input[type="text"]');
    console.log('Found', inputs.length, 'inputs');
    
    if (inputs.length < 2) {
      console.log('⚠️  Not enough inputs found');
      await browser.close();
      return;
    }
    
    console.log('Typing "New York, NY" in first input...');
    await inputs[0].click();
    await page.keyboard.type('New York, NY', { delay: 80 });
    await new Promise(r => setTimeout(r, 1500));
    
    // Try to click autocomplete suggestion
    const acClicked1 = await page.evaluate(() => {
      const suggestions = Array.from(document.querySelectorAll('[role="option"], li, div'))
        .filter(el => el.textContent.includes('New York'));
      if (suggestions.length > 0) {
        suggestions[0].click();
        return true;
      }
      return false;
    });
    
    if (acClicked1) {
      console.log('  Clicked autocomplete suggestion');
    } else {
      console.log('  No autocomplete, pressing Enter');
      await page.keyboard.press('Enter');
    }
    
    await new Promise(r => setTimeout(r, 500));
    
    console.log('Typing "Philadelphia, PA" in second input...');
    await inputs[1].click();
    await page.keyboard.type('Philadelphia, PA', { delay: 80 });
    await new Promise(r => setTimeout(r, 1500));
    
    const acClicked2 = await page.evaluate(() => {
      const suggestions = Array.from(document.querySelectorAll('[role="option"], li, div'))
        .filter(el => el.textContent.includes('Philadelphia'));
      if (suggestions.length > 0) {
        suggestions[0].click();
        return true;
      }
      return false;
    });
    
    if (acClicked2) {
      console.log('  Clicked autocomplete suggestion');
    } else {
      console.log('  No autocomplete, pressing Enter');
      await page.keyboard.press('Enter');
    }
    
    await new Promise(r => setTimeout(r, 500));
    
    console.log('\nClicking "Split The Distance" button...');
    const btnClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('Split The Distance'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    
    if (!btnClicked) {
      console.log('⚠️  Could not find Split The Distance button');
    }
    
    console.log('Waiting 5 seconds for results...\n');
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: '/tmp/test2-search-results.png', fullPage: true });
    
    const test2 = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasMidpointCard: text.includes('Halfway') || text.includes('HALFWAY') || 
                         text.includes('Meeting Point'),
        hasDistance: text.match(/\d+\.?\d*\s*mi/),
        hasDuration: text.match(/\d+\s*(min|hr)/),
        hasFilterChips: text.includes('Food') && text.includes('Coffee'),
        chipCount: Array.from(document.querySelectorAll('button'))
          .filter(b => ['Food', 'Coffee', 'Parks', 'Shopping'].some(t => b.textContent.includes(t))).length
      };
    });
    
    console.log('✓ Results loaded');
    console.log('  Midpoint card:', test2.hasMidpointCard ? 'YES' : 'NO');
    console.log('  Distance shown:', test2.hasDistance ? 'YES' : 'NO');
    console.log('  Duration shown:', test2.hasDuration ? 'YES' : 'NO');
    console.log('  Filter chips:', test2.hasFilterChips ? 'YES' : 'NO');
    console.log('  Chip count:', test2.chipCount);
    
    // TEST 3 - Filter Chips
    console.log('\n\nTEST 3 - FILTER CHIPS\n');
    
    console.log('Clicking "Food" filter chip...');
    const foodClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent === 'Food' || (b.textContent.includes('Food') && !b.textContent.includes('Fast')));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    
    console.log('Food clicked:', foodClicked ? 'YES' : 'NO');
    
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: '/tmp/test3-food-filter.png', fullPage: true });
    
    const test3 = await page.evaluate(() => {
      const text = document.body.innerText;
      const distanceMatches = text.match(/\d+\.?\d*\s*mi\s+away/g);
      const openClosed = text.match(/Open|Closed/g);
      return {
        placeCount: distanceMatches ? distanceMatches.length : 0,
        hasOpenClosedBadges: openClosed && openClosed.length > 0,
        hasPlaceNames: text.includes('Restaurant') || text.includes('Cafe') || text.includes('Bar')
      };
    });
    
    console.log('✓ Filter applied');
    console.log('  Place cards:', test3.placeCount);
    console.log('  Open/Closed badges:', test3.hasOpenClosedBadges ? 'YES' : 'NO');
    console.log('  Place names shown:', test3.hasPlaceNames ? 'YES' : 'NO');
    
    // TEST 4 - Midpoint Mode Toggle
    console.log('\n\nTEST 4 - MIDPOINT MODE TOGGLE\n');
    
    console.log('Looking for Time/Distance toggle...');
    const toggleFound = await page.evaluate(() => {
      const text = document.body.innerText;
      const buttons = Array.from(document.querySelectorAll('button'));
      const distanceBtn = buttons.find(b => 
        (b.textContent.includes('Distance') && !b.textContent.includes('Split')) ||
        b.textContent === 'Distance'
      );
      return {
        hasToggle: text.includes('Time') && text.includes('Distance') && 
                   buttons.some(b => b.textContent.includes('Time') || b.textContent === 'Time'),
        distanceBtnFound: distanceBtn !== undefined
      };
    });
    
    console.log('Toggle found:', toggleFound.hasToggle ? 'YES' : 'NO');
    console.log('Distance button:', toggleFound.distanceBtnFound ? 'YES' : 'NO');
    
    if (toggleFound.distanceBtnFound) {
      console.log('Clicking Distance mode...');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const distanceBtn = buttons.find(b => 
          (b.textContent.includes('Distance') && !b.textContent.includes('Split')) ||
          b.textContent === 'Distance'
        );
        if (distanceBtn) distanceBtn.click();
      });
      
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: '/tmp/test4-distance-mode.png', fullPage: true });
      
      console.log('✓ Switched to distance mode (screenshot captured)');
    } else {
      console.log('⚠️  Distance toggle not found or already active');
    }
    
    // TEST 5 - Midpoint Roulette
    console.log('\n\nTEST 5 - MIDPOINT ROULETTE\n');
    
    console.log('Looking for Roulette/Surprise Me button...');
    const rouletteFound = await page.evaluate(() => {
      const text = document.body.innerText;
      const buttons = Array.from(document.querySelectorAll('button'));
      const rouletteBtn = buttons.find(b => 
        b.textContent.includes('Surprise Me') || 
        b.textContent.includes('🎲') ||
        b.textContent.includes('Roulette')
      );
      return {
        found: rouletteBtn !== undefined,
        isComingSoon: text.includes('Coming Soon') && text.includes('Roulette')
      };
    });
    
    console.log('Roulette button found:', rouletteFound.found ? 'YES' : 'NO');
    console.log('Coming Soon status:', rouletteFound.isComingSoon ? 'YES' : 'NO');
    
    if (rouletteFound.found) {
      console.log('Clicking Surprise Me...');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const rouletteBtn = buttons.find(b => 
          b.textContent.includes('Surprise Me') || 
          b.textContent.includes('🎲')
        );
        if (rouletteBtn) rouletteBtn.click();
      });
      
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: '/tmp/test5-roulette.png', fullPage: true });
      
      const test5 = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasAnimation: text.includes('...') || text.includes('shuffle'),
          hasResult: text.includes('Revealed') || text.includes('Found') || text.includes('Check it out'),
          hasSpinAgain: text.includes('Spin Again')
        };
      });
      
      console.log('✓ Roulette clicked');
      console.log('  Animation/loading:', test5.hasAnimation ? 'YES' : 'NO');
      console.log('  Result shown:', test5.hasResult ? 'YES' : 'NO');
      console.log('  Spin Again button:', test5.hasSpinAgain ? 'YES' : 'NO');
    } else {
      console.log('⚠️  Roulette feature not accessible');
    }
    
    // TEST 6 - Road Trip Mode
    console.log('\n\nTEST 6 - ROAD TRIP MODE\n');
    
    console.log('Looking for Road Trip/Plan Stops button...');
    const roadTripFound = await page.evaluate(() => {
      const text = document.body.innerText;
      const buttons = Array.from(document.querySelectorAll('button'));
      const roadTripBtn = buttons.find(b => 
        b.textContent.includes('Plan Stops') || 
        b.textContent.includes('Road Trip') ||
        b.textContent.includes('🛣️')
      );
      return {
        found: roadTripBtn !== undefined,
        isPremium: roadTripBtn && (roadTripBtn.textContent.includes('PRO') || 
                                    roadTripBtn.textContent.includes('🔒')),
        buttonText: roadTripBtn ? roadTripBtn.textContent : null
      };
    });
    
    console.log('Road Trip button found:', roadTripFound.found ? 'YES' : 'NO');
    if (roadTripFound.found) {
      console.log('  Button text:', roadTripFound.buttonText);
      console.log('  Premium gated:', roadTripFound.isPremium ? 'YES' : 'NO');
      
      if (roadTripFound.isPremium) {
        console.log('  (Feature requires premium subscription)');
      }
      
      await page.screenshot({ path: '/tmp/test6-road-trip.png', fullPage: true });
    } else {
      console.log('⚠️  Road Trip button not visible (route may be too short - NYC to Philly is ~1.5 hrs)');
    }
    
    // TEST 7 - Group Gravity (3 locations)
    console.log('\n\nTEST 7 - GROUP GRAVITY (3 LOCATIONS)\n');
    
    console.log('Looking for "+ Add person" button...');
    const addPersonFound = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const addBtn = buttons.find(b => 
        b.textContent.includes('Add person') || 
        b.textContent.includes('+ Add')
      );
      return {
        found: addBtn !== undefined,
        text: addBtn ? addBtn.textContent : null
      };
    });
    
    console.log('Add person button found:', addPersonFound.found ? 'YES' : 'NO');
    if (addPersonFound.found) {
      console.log('  Button text:', addPersonFound.text);
    }
    
    if (addPersonFound.found) {
      console.log('\nClicking "+ Add person"...');
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const addBtn = buttons.find(b => 
          b.textContent.includes('Add person') || 
          b.textContent.includes('+ Add')
        );
        if (addBtn) {
          addBtn.click();
          return true;
        }
        return false;
      });
      
      await new Promise(r => setTimeout(r, 1000));
      
      const modalCheck = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasModal: text.includes('Sign in') || text.includes('Log in'),
          hasThirdInput: document.querySelectorAll('input[type="text"]').length >= 3
        };
      });
      
      if (modalCheck.hasModal) {
        console.log('⚠️  Sign-in modal appeared (feature requires authentication)');
        await page.screenshot({ path: '/tmp/test7-signin-modal.png', fullPage: true });
        
        // Close modal
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const closeBtn = btns.find(b => b.textContent.includes('✕') || b.textContent.includes('Close'));
          if (closeBtn) closeBtn.click();
        });
        await new Promise(r => setTimeout(r, 500));
      } else if (modalCheck.hasThirdInput) {
        console.log('✓ Third input added');
        
        const inputs = await page.$$('input[type="text"]');
        console.log('Input count:', inputs.length);
        
        if (inputs.length >= 3) {
          console.log('Typing "Baltimore, MD" in third input...');
          await inputs[2].click();
          await page.keyboard.type('Baltimore, MD', { delay: 80 });
          await new Promise(r => setTimeout(r, 1500));
          
          const acClicked3 = await page.evaluate(() => {
            const suggestions = Array.from(document.querySelectorAll('[role="option"], li, div'))
              .filter(el => el.textContent.includes('Baltimore'));
            if (suggestions.length > 0) {
              suggestions[0].click();
              return true;
            }
            return false;
          });
          
          if (acClicked3) {
            console.log('  Clicked autocomplete suggestion');
          } else {
            await page.keyboard.press('Enter');
          }
          
          await new Promise(r => setTimeout(r, 500));
          
          console.log('\nClicking "Split The Distance" again...');
          await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button'))
              .find(b => b.textContent.includes('Split The Distance'));
            if (btn) btn.click();
          });
          
          console.log('Waiting 5 seconds for group results...\n');
          await new Promise(r => setTimeout(r, 5000));
          await page.screenshot({ path: '/tmp/test7-group-gravity.png', fullPage: true });
          
          const test7 = await page.evaluate(() => {
            const text = document.body.innerText;
            return {
              hasGroupCard: text.includes('Group Meeting Point'),
              hasThreeLocations: (text.match(/New York/gi) || []).length > 0 &&
                                (text.match(/Philadelphia/gi) || []).length > 0 &&
                                (text.match(/Baltimore/gi) || []).length > 0,
              hasPerPersonTimes: text.includes('Person A') || text.includes('from New York')
            };
          });
          
          console.log('✓ Group calculation complete');
          console.log('  Group Meeting Point card:', test7.hasGroupCard ? 'YES' : 'NO');
          console.log('  Shows all 3 locations:', test7.hasThreeLocations ? 'YES' : 'NO');
          console.log('  Per-person drive times:', test7.hasPerPersonTimes ? 'YES' : 'NO');
        }
      }
    } else {
      console.log('⚠️  Add person button not visible');
    }
    
    // TEST 8 - Drift Radius
    console.log('\n\nTEST 8 - DRIFT RADIUS\n');
    
    console.log('Looking for Drift Radius toggle...');
    const driftFound = await page.evaluate(() => {
      const text = document.body.innerText;
      const elements = Array.from(document.querySelectorAll('button, div, label'));
      const driftEl = elements.find(e => 
        e.textContent.includes('Drift Radius') || 
        e.textContent.includes('🎯')
      );
      return {
        found: driftEl !== undefined,
        isPremium: driftEl && (driftEl.textContent.includes('PRO') || 
                               driftEl.textContent.includes('🔒')),
        text: driftEl ? driftEl.textContent : null
      };
    });
    
    console.log('Drift Radius found:', driftFound.found ? 'YES' : 'NO');
    if (driftFound.found) {
      console.log('  Element text:', driftFound.text);
      console.log('  Premium gated:', driftFound.isPremium ? 'YES' : 'NO');
      
      await page.screenshot({ path: '/tmp/test8-drift-radius.png', fullPage: true });
      
      if (driftFound.isPremium) {
        console.log('  (Feature requires premium subscription)');
      } else {
        console.log('Attempting to toggle Drift Radius...');
        await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('button, div, label'));
          const driftEl = elements.find(e => 
            e.textContent.includes('Drift Radius') || 
            e.textContent.includes('🎯')
          );
          if (driftEl) driftEl.click();
        });
        
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: '/tmp/test8-drift-active.png', fullPage: true });
        console.log('✓ Drift Radius toggled');
      }
    } else {
      console.log('⚠️  Drift Radius not visible in results panel');
    }
    
    // Console Errors Summary
    console.log('\n\n═══ CONSOLE ERRORS ═══');
    if (consoleErrors.length > 0) {
      console.log('Total errors:', consoleErrors.length);
      consoleErrors.slice(0, 10).forEach((err, i) => {
        console.log(`${i + 1}. ${err.substring(0, 200)}`);
      });
    } else {
      console.log('No console errors ✓');
    }
    
  } catch (error) {
    console.log('\n✗ ERROR:', error.message);
    console.log(error.stack);
    await page.screenshot({ path: '/tmp/test-error.png' });
  }

  await browser.close();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TEST SUITE COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
})();
