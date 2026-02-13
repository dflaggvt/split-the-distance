const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TESTING MIDPOINT ROULETTE - WITH WORKING API');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Step 1: Navigate to http://localhost:3000 (fresh load)\n');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Step 2: Entering locations...\n');
  await page.click('input[placeholder*="Starting"]');
  await page.keyboard.type('New York', { delay: 80 });
  await new Promise(r => setTimeout(r, 1500));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 500));
  
  await page.click('input[placeholder*="Destination"]');
  await page.keyboard.type('Philadelphia', { delay: 80 });
  await new Promise(r => setTimeout(r, 1500));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 500));
  
  console.log('Step 3: Clicking search button...\n');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.trim() === 'Split The Distance');
    if (btn) btn.click();
  });
  
  console.log('Step 4: Waiting for route results...\n');
  await new Promise(r => setTimeout(r, 8000));
  
  console.log('Step 5: Taking snapshot - looking for Surprise Me button\n');
  await page.screenshot({ path: '/tmp/roulette-step5-before-click.png' });
  
  const beforeClick = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.includes('🎲') && b.textContent.includes('Surprise Me'));
    return {
      buttonFound: !!btn,
      buttonText: btn ? btn.textContent.trim() : null
    };
  });
  
  console.log('═══ STEP 5 RESULTS ═══');
  console.log('"Surprise Me" button found:', beforeClick.buttonFound ? '✓ YES' : '✗ NO');
  if (beforeClick.buttonFound) {
    console.log('Button text:', beforeClick.buttonText);
  }
  
  if (!beforeClick.buttonFound) {
    console.log('\n⚠️  Cannot continue - button not found');
    await browser.close();
    return;
  }
  
  console.log('\nStep 6: Clicking "Surprise Me" button...\n');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.includes('🎲') && b.textContent.includes('Surprise Me'));
    if (btn) btn.click();
  });
  
  // Check immediately for shuffle animation
  await new Promise(r => setTimeout(r, 300));
  
  const duringAnimation = await page.evaluate(() => {
    const categoryEmojis = ['🍕', '☕', '🏞️', '🎭', '🍺', '🏨'];
    const hasEmoji = categoryEmojis.some(emoji => 
      document.body.innerText.includes(emoji)
    );
    
    return {
      hasShuffleEmojis: hasEmoji,
      bodySnippet: document.body.innerText.substring(1000, 1500)
    };
  });
  
  console.log('Shuffle animation check (300ms):');
  console.log('  Category emojis cycling:', duringAnimation.hasShuffleEmojis ? 'YES' : 'NO');
  
  console.log('\nStep 7: Waiting 3 seconds for animation to complete...\n');
  await new Promise(r => setTimeout(r, 2700));
  
  console.log('Step 8: Taking snapshot - checking for revealed place\n');
  await page.screenshot({ path: '/tmp/roulette-step8-revealed.png' });
  
  const afterReveal = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    
    // Check for revealed place indicators
    const hasParty = bodyText.includes('🎉');
    const hasSpinAgain = bodyText.includes('Spin Again');
    
    // Try to find place details
    const hasDirections = bodyText.includes('Get Directions') || 
                         bodyText.includes('Directions');
    const hasMiAway = bodyText.includes('mi away') || 
                      bodyText.includes('mi ');
    
    // Look for category emojis in revealed state
    const categoryEmojis = ['🍕', '☕', '🏞️', '🎭', '🍺', '🏨', '⛽', '🍽️'];
    const hasCategory = categoryEmojis.some(e => bodyText.includes(e));
    
    // Try to extract place name (text before "mi away")
    const miAwayIndex = bodyText.indexOf('mi away');
    let placeName = null;
    if (miAwayIndex > 0) {
      const beforeMi = bodyText.substring(Math.max(0, miAwayIndex - 100), miAwayIndex);
      const lines = beforeMi.split('\n');
      placeName = lines[lines.length - 2] || lines[lines.length - 1];
    }
    
    // Check for rolls remaining
    const rollsMatch = bodyText.match(/(\d+)\s*(?:roll|spin)s?\s*(?:left|remaining)/i);
    const rollsLeft = rollsMatch ? rollsMatch[1] : null;
    
    // Check for error
    const hasError = bodyText.toLowerCase().includes('error') ||
                    bodyText.toLowerCase().includes('no places found');
    
    return {
      hasParty,
      hasSpinAgain,
      hasDirections,
      hasMiAway,
      hasCategory,
      placeName,
      rollsLeft,
      hasError
    };
  });
  
  console.log('═══ STEP 8 RESULTS ═══\n');
  console.log('Party emoji (🎉):', afterReveal.hasParty ? '✓ YES' : '✗ NO');
  console.log('Place revealed:', afterReveal.hasMiAway ? '✓ YES' : '✗ NO');
  console.log('Place name:', afterReveal.placeName || 'Not found');
  console.log('Category emoji visible:', afterReveal.hasCategory ? '✓ YES' : '✗ NO');
  console.log('Distance shown:', afterReveal.hasMiAway ? '✓ YES (mi away)' : '✗ NO');
  console.log('Directions button:', afterReveal.hasDirections ? '✓ YES' : '✗ NO');
  console.log('Spin Again button:', afterReveal.hasSpinAgain ? '✓ YES' : '✗ NO');
  console.log('Rolls left:', afterReveal.rollsLeft || 'Not shown');
  console.log('Error message:', afterReveal.hasError ? '⚠️  YES' : '✓ NO');
  
  if (afterReveal.hasSpinAgain) {
    console.log('\nStep 9: Clicking "Spin Again" button...\n');
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('Spin Again'));
      if (btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Step 10: Taking final snapshot after second roll\n');
    await page.screenshot({ path: '/tmp/roulette-step10-second-roll.png' });
    
    const afterSecondRoll = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasMiAway = bodyText.includes('mi away');
      const hasSpinAgain = bodyText.includes('Spin Again');
      
      const rollsMatch = bodyText.match(/(\d+)\s*(?:roll|spin)s?\s*(?:left|remaining)/i);
      const rollsLeft = rollsMatch ? rollsMatch[1] : null;
      
      return {
        placeRevealed: hasMiAway,
        spinAgainVisible: hasSpinAgain,
        rollsLeft
      };
    });
    
    console.log('═══ STEP 10 RESULTS ═══\n');
    console.log('Second place revealed:', afterSecondRoll.placeRevealed ? '✓ YES' : '✗ NO');
    console.log('Spin Again still visible:', afterSecondRoll.spinAgainVisible ? '✓ YES' : '✗ NO');
    console.log('Rolls left:', afterSecondRoll.rollsLeft || 'Not shown');
    
  } else {
    console.log('\n⚠️  Cannot test Spin Again - button not visible');
  }

  await browser.close();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\nScreenshots saved:');
  console.log('  - /tmp/roulette-step5-before-click.png');
  console.log('  - /tmp/roulette-step8-revealed.png');
  if (afterReveal.hasSpinAgain) {
    console.log('  - /tmp/roulette-step10-second-roll.png');
  }
})();
