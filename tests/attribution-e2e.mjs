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
  await query("DELETE FROM attribution_logs; DELETE FROM share_clicks; DELETE FROM shares WHERE share_id IS NOT NULL; DELETE FROM sessions;");

  browser = await chromium.launch({ headless: true });

  // ============ TEST 1: Direct Visit ============
  await test('Test 1: Direct visit → source=direct', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Capture console for debugging
    page.on('console', msg => {
      if (msg.text().includes('[ATTR]')) console.log(`   [browser] ${msg.text()}`);
    });

    await page.goto(DEV_URL, { waitUntil: 'networkidle' });
    await sleep(3000);

    const sessions = await query("SELECT source, source_detail, is_internal FROM sessions ORDER BY id DESC LIMIT 1");
    assert(sessions.length > 0, 'No session created');
    assert(sessions[0].source === 'direct', `Expected source=direct, got ${sessions[0].source}`);
    assert(sessions[0].is_internal === false, 'Should not be internal');

    const logs = await query("SELECT event_type FROM attribution_logs ORDER BY id DESC LIMIT 1");
    assert(logs.length > 0, 'No attribution log created');
    assert(logs[0].event_type === 'SESSION_INIT', `Expected SESSION_INIT, got ${logs[0].event_type}`);

    await ctx.close();
  });

  // ============ TEST 2: UTM Campaign Visit ============
  await test('Test 2: UTM params → source from utm_medium, UTM stored', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${DEV_URL}?utm_source=twitter&utm_medium=social&utm_campaign=test_feb`, { waitUntil: 'networkidle' });
    await sleep(3000);

    const sessions = await query("SELECT source, source_detail, utm_source, utm_medium, utm_campaign FROM sessions WHERE utm_campaign = 'test_feb' ORDER BY id DESC LIMIT 1");
    assert(sessions.length > 0, 'No session with UTM created');
    assert(sessions[0].source === 'social', `Expected source=social, got ${sessions[0].source}`);
    assert(sessions[0].utm_source === 'twitter', `Expected utm_source=twitter, got ${sessions[0].utm_source}`);
    assert(sessions[0].utm_medium === 'social', `Expected utm_medium=social, got ${sessions[0].utm_medium}`);
    assert(sessions[0].utm_campaign === 'test_feb', `Expected utm_campaign=test_feb, got ${sessions[0].utm_campaign}`);

    // Verify UTM params cleaned from URL
    const url = page.url();
    assert(!url.includes('utm_source'), `UTM not cleaned from URL: ${url}`);

    const logs = await query("SELECT event_type FROM attribution_logs WHERE session_id = (SELECT session_id FROM sessions WHERE utm_campaign = 'test_feb' ORDER BY id DESC LIMIT 1) ORDER BY id");
    const types = logs.map(l => l.event_type);
    assert(types.includes('SESSION_INIT'), 'Missing SESSION_INIT log');
    assert(types.includes('UTM_DETECTED'), 'Missing UTM_DETECTED log');

    await ctx.close();
  });

  // ============ TEST 3: Share Link Flow ============
  await test('Test 3: Share link → source=share, click tracked', async () => {
    // Create a share record
    await query("INSERT INTO shares (session_id, share_id, share_type, share_method, from_name, to_name, route_from_name, route_to_name, route_from_lat, route_from_lng, route_to_lat, route_to_lng, is_internal, click_count) VALUES ('sess_pw_sharer', 'pWtEsT', 'copy', 'copy', 'New York, NY', 'Boston, MA', 'New York, NY', 'Boston, MA', 40.7128, -74.0060, 42.3601, -71.0589, false, 0)");

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${DEV_URL}?s=pWtEsT&from=40.7128,-74.006&to=42.3601,-71.0589`, { waitUntil: 'networkidle' });
    await sleep(4000);

    const sessions = await query("SELECT source, source_detail FROM sessions WHERE source_detail = 'pWtEsT' ORDER BY id DESC LIMIT 1");
    assert(sessions.length > 0, 'No share session created');
    assert(sessions[0].source === 'share', `Expected source=share, got ${sessions[0].source}`);

    const clicks = await query("SELECT share_id, visitor_session_id, is_internal FROM share_clicks WHERE share_id = 'pWtEsT'");
    assert(clicks.length > 0, 'No share_click created');
    assert(clicks[0].is_internal === false, 'Share click should not be internal');

    const share = await query("SELECT click_count FROM shares WHERE share_id = 'pWtEsT'");
    
    // Debug: check attribution error log
    const errors = await query("SELECT error_message, metadata FROM attribution_logs WHERE event_type = 'ATTRIBUTION_ERROR' ORDER BY id DESC LIMIT 1");
    if (errors.length > 0) console.log(`   Debug error: ${errors[0].error_message} | ${JSON.stringify(errors[0].metadata)}`);
    
    assert(share[0].click_count >= 1, `Expected click_count >= 1, got ${share[0].click_count}`);

    // Verify ?s= cleaned from URL
    const url = page.url();
    assert(!url.includes('s=pWtEsT'), `Share param not cleaned: ${url}`);

    await ctx.close();
  });

  // ============ TEST 4: Internal Flag ============
  await test('Test 4: Internal flag → session marked internal', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${DEV_URL}?_internal=1`, { waitUntil: 'networkidle' });
    await sleep(3000);

    const sessions = await query("SELECT is_internal FROM sessions WHERE is_internal = true ORDER BY id DESC LIMIT 1");
    assert(sessions.length > 0, 'No internal session created');
    assert(sessions[0].is_internal === true, `Expected is_internal=true`);

    await ctx.close();
  });

  // ============ TEST 5: Full Attribution Logs ============
  await test('Test 5: Attribution logs complete and queryable', async () => {
    const logs = await query("SELECT event_type, COUNT(*) as count FROM attribution_logs GROUP BY event_type ORDER BY count DESC");
    assert(logs.length > 0, 'No attribution logs');

    const types = logs.map(l => l.event_type);
    assert(types.includes('SESSION_INIT'), 'Missing SESSION_INIT events');

    const total = logs.reduce((sum, l) => sum + parseInt(l.count), 0);
    assert(total >= 4, `Expected at least 4 log events, got ${total}`);

    console.log(`   Log breakdown: ${logs.map(l => `${l.event_type}=${l.count}`).join(', ')}`);

    // Verify internal sessions excluded from dashboard-style query
    const extSessions = await query("SELECT COUNT(*) as count FROM sessions WHERE is_internal = false");
    const allSessions = await query("SELECT COUNT(*) as count FROM sessions");
    assert(parseInt(extSessions[0].count) < parseInt(allSessions[0].count), 'Internal sessions should exist but be filtered');

    console.log(`   Dashboard view: ${extSessions[0].count} external of ${allSessions[0].count} total sessions`);
  });

} catch (err) {
  console.error('Fatal error:', err.message);
} finally {
  if (browser) await browser.close();

  console.log('\n🧹 Cleaning up test data...');
  await query("DELETE FROM attribution_logs; DELETE FROM share_clicks; DELETE FROM shares WHERE share_id = 'pWtEsT'; DELETE FROM sessions;");
  console.log('   Done — dev DB clean');

  console.log(`\n📋 Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  process.exit(failed > 0 ? 1 : 0);
}
