# Attribution Tracking System — Implementation Plan

## Context for New Model (Handoff)

**Project:** Split The Distance — find drive-time midpoints between two locations
**Live URL:** https://www.splitthedistance.com
**Dashboard:** https://www.splitthedistance.com/d4shb0ard-7x9k
**Repo:** github.com/dflaggvt/split-the-distance
**Local path:** /home/ubuntu/.openclaw/workspace/split-the-distance-react

**Stack:**
- Next.js 14 (App Router)
- React + Tailwind CSS
- Supabase (PostgreSQL) — prod ref: `rwabiyqmhwebxkiyjkcc`, dev ref: `yltxrpdgulmfutbmbyqh`
- Vercel hosting
- Google Maps APIs (Directions, Places, Autocomplete)

**Deployment flow:**
1. Always push to `dev` branch first
2. Test on dev preview: `https://split-the-distance-git-dev-daryl-flaggs-projects-ec3dfea5.vercel.app/`
3. Get Daryl's approval
4. Merge to `main` and push — Vercel auto-deploys

**Key files:**
- `lib/analytics.js` — session tracking, event logging
- `lib/routing.js` — Google Directions API calls
- `lib/places.js` — Google Places API calls
- `components/RouteInfo.js` — share button lives here
- `app/d4shb0ard-7x9k/page.js` — analytics dashboard

**Supabase CLI token:** `sbp_71bd24a895969f766b1d6e9204be105500adfc03`
**Run SQL:** 
```bash
curl -X POST "https://api.supabase.com/v1/projects/rwabiyqmhwebxkiyjkcc/database/query" \
  -H "Authorization: Bearer sbp_71bd24a895969f766b1d6e9204be105500adfc03" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR SQL HERE"}'
```

**Existing tables:** `searches`, `place_clicks`, `sessions`, `shares`, `outbound_clicks`, `page_views`

**Current state:** Basic analytics working, dashboard functional with Recharts. This plan adds attribution tracking and share analytics.

---

## Overview

Build a unified attribution system that tracks where every visitor comes from and their complete journey through the site. This enables:
- Understanding which channels drive traffic
- Measuring share virality and conversion
- Optimizing marketing spend
- Identifying power users and referral sources

---

## Phase 1: Database Schema

### 1.1 Modify `sessions` table

Add columns to track attribution:

```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source TEXT;           -- direct|organic|share|social|referral|email|paid
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source_detail TEXT;    -- google|twitter|share_abc123|nytimes.com
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS referrer_url TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS referrer_domain TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS landing_page TEXT;
```

### 1.2 Create `shares` table enhancement

Current `shares` table tracks share events. Enhance it:

```sql
ALTER TABLE shares ADD COLUMN IF NOT EXISTS share_id TEXT UNIQUE;    -- short unique ID (e.g., "x7Kp2")
ALTER TABLE shares ADD COLUMN IF NOT EXISTS share_method TEXT;       -- copy|whatsapp|twitter|facebook|email|sms|native
ALTER TABLE shares ADD COLUMN IF NOT EXISTS route_from_name TEXT;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS route_to_name TEXT;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS route_from_lat DECIMAL;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS route_from_lng DECIMAL;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS route_to_lat DECIMAL;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS route_to_lng DECIMAL;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_shares_share_id ON shares(share_id);
```

### 1.3 Create `share_clicks` table

Track each visit from a shared link:

```sql
CREATE TABLE IF NOT EXISTS share_clicks (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  share_id TEXT REFERENCES shares(share_id),
  visitor_session_id TEXT,
  referrer_url TEXT,
  referrer_domain TEXT,
  device_type TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_share_clicks_share_id ON share_clicks(share_id);
CREATE INDEX IF NOT EXISTS idx_share_clicks_created_at ON share_clicks(created_at);
```

---

## Phase 2: Attribution Detection Logic

### 2.1 Source Detection Priority

When a visitor arrives, detect source in this order:

```
1. Share ID present (?s=xxx or /s/xxx)     → source: "share", detail: share_id
2. UTM params present                       → source: from utm_medium, detail: utm_source
3. Referrer is search engine               → source: "organic", detail: engine name
4. Referrer is social platform             → source: "social", detail: platform name
5. Referrer is other website               → source: "referral", detail: domain
6. No referrer                             → source: "direct", detail: null
```

### 2.2 Referrer Classification

```javascript
const SEARCH_ENGINES = ['google', 'bing', 'duckduckgo', 'yahoo', 'baidu', 'yandex'];
const SOCIAL_PLATFORMS = ['twitter', 't.co', 'facebook', 'fb.com', 'instagram', 'linkedin', 'reddit', 'tiktok', 'pinterest'];

function classifyReferrer(referrerUrl) {
  if (!referrerUrl) return { source: 'direct', detail: null };
  
  const domain = new URL(referrerUrl).hostname.replace('www.', '');
  
  for (const engine of SEARCH_ENGINES) {
    if (domain.includes(engine)) return { source: 'organic', detail: engine };
  }
  
  for (const platform of SOCIAL_PLATFORMS) {
    if (domain.includes(platform)) return { source: 'social', detail: platform };
  }
  
  return { source: 'referral', detail: domain };
}
```

### 2.3 UTM Parameter Handling

```javascript
function parseUTM(searchParams) {
  return {
    utm_source: searchParams.get('utm_source'),
    utm_medium: searchParams.get('utm_medium'),
    utm_campaign: searchParams.get('utm_campaign'),
    utm_content: searchParams.get('utm_content'),
    utm_term: searchParams.get('utm_term'),
  };
}

function sourceFromUTM(utm) {
  if (!utm.utm_medium) return null;
  
  const mediumMap = {
    'cpc': 'paid',
    'ppc': 'paid',
    'paid': 'paid',
    'email': 'email',
    'social': 'social',
    'organic': 'organic',
    'referral': 'referral',
  };
  
  return mediumMap[utm.utm_medium.toLowerCase()] || 'referral';
}
```

---

## Phase 3: Share Link System

### 3.1 Share ID Generation

Generate short, unique, URL-safe IDs:

```javascript
// lib/shareIds.js
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateShareId(length = 6) {
  let id = '';
  for (let i = 0; i < length; i++) {
    id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return id;
}
```

### 3.2 Share Link Format

Two supported formats:
- Query param: `https://splitthedistance.com?s=x7Kp2`
- Short path: `https://splitthedistance.com/s/x7Kp2` (requires route handler)

**Recommendation:** Start with query param (simpler), add short path later if needed.

### 3.3 Share Flow

```
User clicks Share
       ↓
Generate share_id
       ↓
Store in shares table (with route data, session_id, method)
       ↓
Generate link: https://splitthedistance.com?s={share_id}&from={lat,lng}&to={lat,lng}
       ↓
Copy to clipboard / open share dialog
```

### 3.4 Share Link Landing

```
Visitor arrives with ?s=xxx
       ↓
Look up share_id in shares table
       ↓
Log to share_clicks table
       ↓
Increment shares.click_count
       ↓
Create session with source="share", source_detail=share_id
       ↓
Auto-populate route from share data (or URL params as fallback)
```

---

## Phase 4: Frontend Changes

### 4.1 Session Initialization (`lib/analytics.js`)

Update `initSession()` to capture attribution:

```javascript
export async function initSession() {
  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer;
  
  // Detect share
  const shareId = params.get('s');
  
  // Parse UTM
  const utm = parseUTM(params);
  
  // Classify source
  let source, sourceDetail;
  if (shareId) {
    source = 'share';
    sourceDetail = shareId;
    await logShareClick(shareId);
  } else if (utm.utm_medium) {
    source = sourceFromUTM(utm);
    sourceDetail = utm.utm_source;
  } else {
    const classified = classifyReferrer(referrer);
    source = classified.source;
    sourceDetail = classified.detail;
  }
  
  // Create session with attribution
  const session = await supabase.from('sessions').insert({
    // ... existing fields ...
    source,
    source_detail: sourceDetail,
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_content: utm.utm_content,
    utm_term: utm.utm_term,
    referrer_url: referrer || null,
    referrer_domain: referrer ? new URL(referrer).hostname : null,
    landing_page: window.location.pathname,
  });
  
  return session;
}
```

### 4.2 Share Button Enhancement (`components/RouteInfo.js`)

```javascript
async function handleShare(method = 'copy') {
  // Generate share ID
  const shareId = generateShareId();
  
  // Build share URL
  const shareUrl = new URL(window.location.origin);
  shareUrl.searchParams.set('s', shareId);
  shareUrl.searchParams.set('from', `${fromLat},${fromLng}`);
  shareUrl.searchParams.set('to', `${toLat},${toLng}`);
  
  // Log share event
  await supabase.from('shares').insert({
    share_id: shareId,
    session_id: currentSessionId,
    share_method: method,
    route_from_name: fromName,
    route_to_name: toName,
    route_from_lat: fromLat,
    route_from_lng: fromLng,
    route_to_lat: toLat,
    route_to_lng: toLng,
  });
  
  // Execute share based on method
  switch (method) {
    case 'copy':
      await navigator.clipboard.writeText(shareUrl.toString());
      break;
    case 'native':
      await navigator.share({ url: shareUrl.toString(), title: 'Meet in the middle!' });
      break;
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl.toString())}`);
      break;
    // ... other methods
  }
}
```

### 4.3 Share UI Options

Add share method selector (implement after core tracking works):

```
┌─────────────────────────────┐
│  Share This Route           │
├─────────────────────────────┤
│  📋 Copy Link               │
│  💬 WhatsApp                │
│  🐦 Twitter                 │
│  📘 Facebook                │
│  ✉️  Email                  │
│  💬 iMessage/SMS            │
└─────────────────────────────┘
```

---

## Phase 5: Verbose Logging

### 5.1 Console Logging (Development)

All attribution events logged with `[ATTR]` prefix for easy filtering:

```javascript
const logAttr = (event, data) => {
  if (process.env.NODE_ENV === 'development' || localStorage.getItem('debug_attr')) {
    console.log(`[ATTR] ${event}`, data);
  }
};

// Usage examples:
logAttr('SESSION_INIT', { source, sourceDetail, referrer, utm });
logAttr('SHARE_CREATED', { shareId, method, route });
logAttr('SHARE_CLICK', { shareId, visitorSessionId });
logAttr('UTM_DETECTED', { utm_source, utm_medium, utm_campaign });
logAttr('REFERRER_CLASSIFIED', { referrer, source, detail });
```

### 5.2 Production Logging Table

Create `attribution_logs` table for production debugging:

```sql
CREATE TABLE IF NOT EXISTS attribution_logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT NOT NULL,          -- SESSION_INIT|SHARE_CREATED|SHARE_CLICK|UTM_DETECTED|REFERRER_CLASSIFIED|ERROR
  session_id TEXT,
  share_id TEXT,
  source TEXT,
  source_detail TEXT,
  referrer_url TEXT,
  utm_params JSONB,                  -- {source, medium, campaign, content, term}
  metadata JSONB,                    -- Additional context
  error_message TEXT                 -- For error events
);

CREATE INDEX IF NOT EXISTS idx_attr_logs_created ON attribution_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_attr_logs_event ON attribution_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_attr_logs_session ON attribution_logs(session_id);

-- RLS
ALTER TABLE attribution_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON attribution_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous reads" ON attribution_logs FOR SELECT USING (true);
```

### 5.3 Log Helper Function

```javascript
// lib/attributionLogger.js
export async function logAttribution(eventType, data) {
  // Always console log in dev
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ATTR] ${eventType}`, data);
  }
  
  // Always write to Supabase for production visibility
  try {
    await supabase.from('attribution_logs').insert({
      event_type: eventType,
      session_id: data.sessionId || null,
      share_id: data.shareId || null,
      source: data.source || null,
      source_detail: data.sourceDetail || null,
      referrer_url: data.referrer || null,
      utm_params: data.utm || null,
      metadata: data.metadata || null,
      error_message: data.error || null,
    });
  } catch (err) {
    console.error('[ATTR] Failed to log:', err);
  }
}
```

### 5.4 Events to Log

| Event | When | Data |
|-------|------|------|
| `SESSION_INIT` | New session created | source, sourceDetail, referrer, utm, landingPage |
| `SHARE_CREATED` | User clicks share | shareId, method, route coords, sharer sessionId |
| `SHARE_CLICK` | Visitor lands from share | shareId, visitor sessionId, referrer |
| `SHARE_LOOKUP_FAILED` | Share ID not found | shareId, fallback used |
| `UTM_DETECTED` | UTM params found | all utm values |
| `REFERRER_CLASSIFIED` | Referrer parsed | referrer URL, classified source/detail |
| `ATTRIBUTION_ERROR` | Any error | error message, context |

---

## Phase 6: Dashboard Redesign (Tabbed Layout)

### 6.1 Tab Structure

```
┌──────────────────────────────────────────────────────────────┐
│  📊 Overview    │    🔗 Attribution    │    📤 Shares        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    (tab content)                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Tab 1: Overview (Existing Content)

Current dashboard content, reorganized:
- KPI cards (searches, sessions, clicks, shares)
- Conversion funnel
- Hourly activity chart
- Daily trend chart
- Top routes
- Top places clicked
- Device breakdown
- Category breakdown
- Cache efficiency

### 6.3 Tab 2: Attribution

**Traffic Sources Section:**
- Pie chart: Sessions by source (direct/organic/social/referral/share/paid)
- Area chart: Source trend over time (stacked)
- Bar chart: Top 10 referrer domains

**UTM Campaign Performance:**
- Table: Campaigns by sessions, searches, conversion rate
- Filter by utm_source, utm_medium

**Source Quality Metrics:**
- Searches per session by source
- Avg session duration by source
- Place click rate by source

### 6.4 Tab 3: Shares

**Share Funnel:**
- Total shares created
- Total share clicks (visits from shares)
- Conversion rate (clicks / shares)
- Searches from share visitors
- Re-shares (viral coefficient)

**Share Method Breakdown:**
- Pie chart: copy vs WhatsApp vs Twitter vs etc.

**Top Shared Routes:**
- Bar chart: Most shared routes (by unique share count)

**Share Performance:**
- Table: Individual shares with click counts
- Sortable by clicks, date

### 6.5 Tab Implementation

```javascript
// Dashboard state
const [activeTab, setActiveTab] = useState('overview');

// Tab component
<div className="flex border-b mb-6">
  {['overview', 'attribution', 'shares'].map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-6 py-3 font-medium ${
        activeTab === tab 
          ? 'border-b-2 border-blue-500 text-blue-600' 
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {tab === 'overview' && '📊 Overview'}
      {tab === 'attribution' && '🔗 Attribution'}
      {tab === 'shares' && '📤 Shares'}
    </button>
  ))}
</div>

// Conditional render based on activeTab
{activeTab === 'overview' && <OverviewTab {...data} />}
{activeTab === 'attribution' && <AttributionTab {...data} />}
{activeTab === 'shares' && <SharesTab {...data} />}
```

---

## Phase 7: Dashboard Queries

### 7.1 Attribution Tab Queries

```javascript
// Traffic by source
const { data: sourceData } = await supabase
  .from('sessions')
  .select('source')
  .gte('created_at', since)
  .eq('is_internal', false);

// Group and count by source
const sourceCounts = sourceData.reduce((acc, s) => {
  acc[s.source || 'unknown'] = (acc[s.source || 'unknown'] || 0) + 1;
  return acc;
}, {});

// Top referrers
const { data: referrerData } = await supabase
  .from('sessions')
  .select('referrer_domain')
  .gte('created_at', since)
  .eq('is_internal', false)
  .not('referrer_domain', 'is', null);

// UTM campaign performance
const { data: utmData } = await supabase
  .from('sessions')
  .select('utm_source, utm_medium, utm_campaign, id')
  .gte('created_at', since)
  .eq('is_internal', false)
  .not('utm_campaign', 'is', null);
```

### 7.2 Shares Tab Queries

```javascript
// Share funnel
const { count: totalShares } = await supabase
  .from('shares')
  .select('*', { count: 'exact', head: true })
  .gte('created_at', since)
  .eq('is_internal', false);

const { count: totalShareClicks } = await supabase
  .from('share_clicks')
  .select('*', { count: 'exact', head: true })
  .gte('created_at', since);

// Share method breakdown
const { data: methodData } = await supabase
  .from('shares')
  .select('share_method')
  .gte('created_at', since)
  .eq('is_internal', false);

// Top shared routes
const { data: sharedRoutes } = await supabase
  .from('shares')
  .select('route_from_name, route_to_name, share_id')
  .gte('created_at', since)
  .eq('is_internal', false);
```

---

## Updated Phase 8: Implementation Order

### Sprint 1: Core Attribution + Logging (Day 1-2)
1. Run database migrations:
   - Add columns to sessions table
   - Create attribution_logs table
   - Add indexes
2. Create `lib/attributionLogger.js`
3. Update `initSession()` with attribution detection + logging
4. Backfill existing sessions with source='unknown'
5. Test with manual UTM params and referrers
6. Deploy to dev, verify logs in Supabase

### Sprint 2: Share Tracking (Day 2-3)
1. Add share_id column and index to shares table
2. Create share_clicks table with RLS
3. Generate share IDs on share button click + log
4. Detect and log share link arrivals
5. Auto-load shared route on landing
6. Deploy to dev, test full share → click flow

### Sprint 3: Tabbed Dashboard (Day 3-4)
1. Refactor dashboard into tab components
2. Build Attribution tab (sources, referrers, UTM)
3. Build Shares tab (funnel, methods, top routes)
4. Test all tabs with real data
5. Deploy to production

### Sprint 4: Social Share Buttons (Day 4-5)
1. Design share method UI (modal or dropdown)
2. Implement platform-specific share links
3. Add native share API support (mobile)
4. Pre-fill share messages
5. Log share method for each share
6. Deploy to production

---

## Phase 6: Implementation Order

### Sprint 1: Core Attribution (Day 1-2)
1. ✅ Run database migrations (add columns to sessions)
2. ✅ Update `initSession()` with attribution detection
3. ✅ Test with manual UTM params and referrers
4. ✅ Deploy to dev, verify data collection

### Sprint 2: Share Tracking (Day 2-3)
1. ✅ Add share_id column and index to shares table
2. ✅ Create share_clicks table
3. ✅ Generate share IDs on share button click
4. ✅ Detect and log share link arrivals
5. ✅ Auto-load shared route on landing
6. ✅ Deploy to dev, test full share → click flow

### Sprint 3: Dashboard (Day 3-4)
1. ✅ Add Traffic Sources section to dashboard
2. ✅ Add Share Analytics section
3. ✅ Add conversion metrics
4. ✅ Deploy to production

### Sprint 4: Social Share Buttons (Day 4-5)
1. ✅ Design share method UI
2. ✅ Implement platform-specific share links
3. ✅ Add native share API support (mobile)
4. ✅ Pre-fill share messages
5. ✅ Deploy to production

---

## Phase 7: Testing Checklist

### Attribution Detection
- [ ] Direct visit (no referrer) → source: direct
- [ ] Google search referrer → source: organic, detail: google
- [ ] Twitter referrer → source: social, detail: twitter
- [ ] UTM params override referrer → source from utm_medium
- [ ] Share link → source: share, detail: share_id

### Share Flow
- [ ] Share button generates unique share_id
- [ ] Share logged to shares table with route data
- [ ] Copied link contains ?s=xxx and route params
- [ ] Visiting share link logs to share_clicks
- [ ] Visitor session has source=share
- [ ] Route auto-populates from share data

### Dashboard
- [ ] Traffic by source shows accurate breakdown
- [ ] Share metrics calculate correctly
- [ ] Time filters work with new data

---

## Open Questions

1. **Short URLs (/s/xxx):** Worth the added complexity of a route handler, or stick with query params?
   - Recommendation: Start with query params, revisit if links feel too long

2. **Share message customization:** Let users edit the share text?
   - Recommendation: Pre-fill but allow edit for native share

3. **Route auto-load:** When visiting a share link, auto-search or show preview first?
   - Recommendation: Auto-search and show results immediately

4. **Historical data:** Backfill source=direct for existing sessions?
   - Recommendation: Yes, run UPDATE for clean data

---

## Success Metrics

After 2 weeks of data:
- Know what % of traffic is direct vs organic vs referral vs share
- Track share conversion rate (target: >10% of shares get clicked)
- Identify if any referral sources are driving quality traffic
- Measure viral coefficient (target: >0.1 for organic growth)

---

## Files to Modify

1. `lib/analytics.js` — attribution detection, session init
2. `lib/shareIds.js` — new file for ID generation
3. `components/RouteInfo.js` — share button enhancement
4. `components/ShareModal.js` — new file for share UI
5. `app/d4shb0ard-7x9k/page.js` — new dashboard sections
6. Database migrations (Supabase SQL)

---

## Design Review — Issues & Mitigations

### 🔴 Critical Issues

**1. Share ID Collision**
- Problem: `generateShareId()` could produce duplicate IDs (1 in 56B, but still possible)
- Fix: Add retry logic with DB uniqueness check before returning ID
```javascript
async function generateUniqueShareId() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = generateShareId();
    const { data } = await supabase.from('shares').select('share_id').eq('share_id', id);
    if (!data || data.length === 0) return id;
  }
  throw new Error('Failed to generate unique share ID');
}
```

**2. Foreign Key Constraint on share_clicks**
- Problem: `share_clicks.share_id REFERENCES shares(share_id)` will fail if old shares don't have share_id
- Fix: Don't use FK constraint. Use soft reference instead:
```sql
CREATE TABLE share_clicks (
  ...
  share_id TEXT,  -- No FK constraint, just indexed
  ...
);
```

**3. Race Condition: Share Click vs Session**
- Problem: `logShareClick()` called before session exists → visitor_session_id is null
- Fix: Reorder in `initSession()`: create session first, then log share click with session ID

### 🟡 Moderate Issues

**4. Missing Index on sessions.source**
- Problem: Dashboard queries by source will be slow at scale
- Fix: Add index
```sql
CREATE INDEX IF NOT EXISTS idx_sessions_source ON sessions(source);
CREATE INDEX IF NOT EXISTS idx_sessions_created_source ON sessions(created_at, source);
```

**5. Referrer Stripped by Privacy Settings**
- Problem: Safari ITP, Brave, Firefox strict mode strip referrers → inflated "direct" count
- Mitigation: Accept this limitation. Document that "direct" includes privacy-stripped referrals. Can't fix without server-side tracking (which we don't have for the landing).

**6. Instagram In-App Browser**
- Problem: Instagram's in-app browser doesn't pass referrer → shows as "direct"
- Mitigation: If `utm_source=instagram` is set in shared links, we catch it. Otherwise, accept the limitation.

**7. Twitter t.co Referrer**
- Problem: Shares via Twitter show referrer as `t.co`, which we classify as "social/twitter" — but a share link clicked from Twitter should be "share", not "social"
- Fix: Check for share ID BEFORE classifying referrer (already in the priority order, but good to note)

**8. Share Link + UTM Params Together**
- Problem: If someone shares with UTM params, we capture share but lose UTM data
- Fix: Always capture UTM params regardless of share detection:
```javascript
// Even for share links, still store UTM for campaign tracking
utm_source: utm.utm_source,  // Could be set by sharing platform
utm_medium: utm.utm_medium,
// etc.
```

### 🟢 Minor Issues

**9. Long Share URLs**
- Problem: Full lat/lng coords make URLs long: `?s=x7Kp2&from=41.0534,-73.7264&to=38.9072,-77.0369`
- Fix: Truncate coords to 4 decimal places (~11m precision, plenty for routing):
```javascript
const truncate = (n) => Math.round(n * 10000) / 10000;
```

**10. URL Cleanup After Capture**
- Problem: Share params stay in URL bar after landing (ugly, can cause re-shares of same ID)
- Fix: Clean URL after capturing:
```javascript
window.history.replaceState({}, '', window.location.pathname);
```

**11. Native Share Rejection**
- Problem: `navigator.share()` rejects if user cancels — could cause unhandled promise rejection
- Fix: Wrap in try/catch, don't show error if user simply cancelled

**12. Existing User Has Route**
- Problem: Visitor lands on share link but already entered their own addresses
- Fix: Share link only auto-loads if no route is currently set. If route exists, show prompt: "Load shared route?"

**13. Deleted Share Record**
- Problem: Someone clicks old share link after share record deleted
- Fix: Graceful fallback — if share_id not found, still use URL coords (`from`/`to` params), just log source as "share-expired"

**14. OG Meta Tags for Link Previews**
- Problem: Social shares need good previews (image, title, description)
- Fix: Add dynamic OG tags based on share route. Requires server-side rendering for share pages, or use a preview image service.
- Recommendation: Phase 2 enhancement. For now, use static OG tags.

### 🔵 Data Integrity

**15. Backfill Existing Sessions**
- Need: Set source='unknown' for existing sessions (not 'direct' — we don't actually know)
```sql
UPDATE sessions SET source = 'unknown' WHERE source IS NULL;
```

**16. RLS Policies for New Tables**
- Need: Add INSERT policies for share_clicks table
```sql
ALTER TABLE share_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON share_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous reads" ON share_clicks FOR SELECT USING (true);
```

### 🔵 Security Considerations

**17. Share ID Enumeration**
- Risk: Someone could brute-force share IDs to scrape popular routes
- Assessment: Low risk — route data isn't sensitive, and 62^6 is large enough
- Mitigation: Rate limiting on share lookups if needed (not for MVP)

**18. UTM Spoofing**
- Risk: Anyone can add fake UTM params to inflate campaign numbers
- Assessment: Low risk — analytics only, not security-critical
- Mitigation: None needed for MVP

---

## Updated Implementation Notes

Based on review, add these to Sprint 1:
- [ ] Add index on sessions(source)
- [ ] Add index on sessions(created_at, source)
- [ ] Backfill existing sessions with source='unknown'
- [ ] RLS policies for share_clicks

Add these to Sprint 2:
- [ ] Retry logic for share ID generation
- [ ] Truncate coords in share URLs
- [ ] Clean URL after capturing params
- [ ] Handle native share cancellation
- [ ] Graceful fallback for expired/deleted shares
- [ ] Prompt if user already has route loaded

Add these to Sprint 4 (or later):
- [ ] Dynamic OG meta tags for share previews

---

*Plan created: 2026-02-07*
*Reviewed: 2026-02-07*
*Status: Awaiting approval*
