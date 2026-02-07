import { chromium } from 'playwright';

const DEV_URL = 'http://localhost:3000';
const SUPABASE_API = 'https://api.supabase.com/v1/projects/yltxrpdgulmfutbmbyqh/database/query';
const SUPABASE_TOKEN = 'sbp_71bd24a895969f766b1d6e9204be105500adfc03';

async function query(sql) {
  const res = await fetch(SUPABASE_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const data = await res.json();
  if (data.message) throw new Error(`SQL error: ${data.message}`);
  return data;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let browser, passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

try {
  // Clean slate
  await query("DELETE FROM attribution_logs; DELETE FROM share_clicks; DELETE FROM shares WHERE share_id IS NOT NULL; DELETE FROM sessions; DELETE FROM page_views;");

  browser = await chromium.launch({ headless: true });

  // ============ TEST 6: Organic Search Referrer ============
  await test('Test 6: Google referrer → source=organic, detail=google', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Set referrer by navigating from a fake Google page
    await page.goto('about:blank');
    await page.evaluate((url) => {
      // Override document.referrer
      Object.defineProperty(document, 'referrer', { value: 'https://www.google.com/search?q=split+the+distance', configurable: true });
      window.location.href = url;
    }, DEV_URL);
    await sleep(4000);

    // Fallback: the referrer override may not persist through navigation.
    // Instead, test via a context with a forced referrer header.
    await ctx.close();

    // Use a context that sets referer header
    const ctx2 = await browser.newContext({
      extraHTTPHeaders: { 'Referer': 'https://www.google.com/search?q=split+the+distance' }
    });
    const page2 = await ctx2.newPage();
    await page2.goto(DEV_URL, { waitUntil: 'networkidle' });
    await sleep(3000);

    const sessions = await query("SELECT source, source_detail FROM sessions WHERE source = 'organic' ORDER BY id DESC LIMIT 1");
    assert(sessions.length > 0, 'No organic session created');
    assert(sessions[0].source === 'organic', `Expected source=organic, got ${sessions[0].source}`);
    assert(sessions[0].source_detail === 'google', `Expected detail=google, got ${sessions[0].source_detail}`);

    await ctx2.close();
  });

  // ============ TEST 7: Returning Visitor (same tab reload) ============
  await test('Test 7: Page reload → same session ID, no duplicate session row', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(DEV_URL, { waitUntil: 'networkidle' });
    await sleep(2000);

    // Get the session ID from sessionStorage
    const sessionId = await page.evaluate(() => sessionStorage.getItem('std_session_id'));
    assert(sessionId, 'No session ID in sessionStorage');

    // Reload the page
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(2000);

    // Session ID should be the same
    const sessionIdAfter = await page.evaluate(() => sessionStorage.getItem('std_session_id'));
    assert(sessionIdAfter === sessionId, `Session ID changed after reload: ${sessionId} → ${sessionIdAfter}`);

    // Should only be 1 session row for this session_id
    const sessions = await query(`SELECT COUNT(*) as count FROM sessions WHERE session_id = '${sessionId}'`);
    assert(parseInt(sessions[0].count) === 1, `Expected 1 session row, got ${sessions[0].count}`);

    await ctx.close();
  });

  // ============ TEST 8: Multiple UTM params with same campaign don't create duplicate sessions ============
  await test('Test 8: New browser context → new session (session isolation)', async () => {
    // Two separate contexts should create two separate sessions
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.goto(DEV_URL, { waitUntil: 'networkidle' });
    await sleep(2000);
    const sid1 = await page1.evaluate(() => sessionStorage.getItem('std_session_id'));

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(DEV_URL, { waitUntil: 'networkidle' });
    await sleep(2000);
    const sid2 = await page2.evaluate(() => sessionStorage.getItem('std_session_id'));

    assert(sid1, 'No session ID in context 1');
    assert(sid2, 'No session ID in context 2');
    assert(sid1 !== sid2, `Both contexts got same session: ${sid1}`);

    // Both should exist in DB
    const sessions = await query(`SELECT session_id FROM sessions WHERE session_id IN ('${sid1}', '${sid2}')`);
    assert(sessions.length === 2, `Expected 2 session rows, got ${sessions.length}`);

    await ctx1.close();
    await ctx2.close();
  });

  // ============ TEST 9: Email UTM medium → source=email ============
  await test('Test 9: UTM medium=email → source=email', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${DEV_URL}?utm_source=newsletter&utm_medium=email&utm_campaign=weekly_feb`, { waitUntil: 'networkidle' });
    await sleep(3000);

    const sessions = await query("SELECT source, source_detail, utm_medium FROM sessions WHERE utm_campaign = 'weekly_feb' ORDER BY id DESC LIMIT 1");
    assert(sessions.length > 0, 'No email session created');
    assert(sessions[0].source === 'email', `Expected source=email, got ${sessions[0].source}`);
    assert(sessions[0].source_detail === 'newsletter', `Expected detail=newsletter, got ${sessions[0].source_detail}`);

    await ctx.close();
  });

  // ============ TEST 10: Paid CPC medium → source=paid ============
  await test('Test 10: UTM medium=cpc → source=paid', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${DEV_URL}?utm_source=google&utm_medium=cpc&utm_campaign=brand_search&utm_content=headline1&utm_term=midpoint+finder`, { waitUntil: 'networkidle' });
    await sleep(3000);

    const sessions = await query("SELECT source, source_detail, utm_source, utm_medium, utm_campaign, utm_content, utm_term FROM sessions WHERE utm_campaign = 'brand_search' ORDER BY id DESC LIMIT 1");
    assert(sessions.length > 0, 'No paid session created');
    assert(sessions[0].source === 'paid', `Expected source=paid, got ${sessions[0].source}`);
    assert(sessions[0].utm_content === 'headline1', `Expected utm_content=headline1, got ${sessions[0].utm_content}`);
    assert(sessions[0].utm_term === 'midpoint finder', `Expected utm_term='midpoint finder', got ${sessions[0].utm_term}`);

    // All 5 UTM fields should be populated
    assert(sessions[0].utm_source === 'google', `Wrong utm_source: ${sessions[0].utm_source}`);
    assert(sessions[0].utm_medium === 'cpc', `Wrong utm_medium: ${sessions[0].utm_medium}`);

    await ctx.close();
  });

} catch (err) {
  console.error('Fatal error:', err.message);
} finally {
  if (browser) await browser.close();

  console.log('\n🧹 Cleaning up test data...');
  await query("DELETE FROM attribution_logs; DELETE FROM share_clicks; DELETE FROM shares WHERE share_id IS NOT NULL; DELETE FROM sessions; DELETE FROM page_views;");
  console.log('   Done — dev DB clean');

  console.log(`\n📋 Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  process.exit(failed > 0 ? 1 : 0);
}
