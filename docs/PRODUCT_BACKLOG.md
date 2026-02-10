# Split The Distance — Product Backlog

_Last updated: February 9, 2026_

---

## How This Is Organized

Each feature is categorized by tier (build priority), tagged with effort, revenue potential, and whether it's free or premium.

**Effort:** S (days) | M (1-2 weeks) | L (3-4 weeks) | XL (1-2 months)
**Revenue:** 💰 (indirect/engagement) | 💰💰 (affiliate/ads) | 💰💰💰 (direct paid/enterprise)

---

## TIER 1 — Build Next (High Impact, Achievable Now)

### 1.1 Fair Swap Zones
**Tagline:** "Meeting a stranger from the internet? Find the safest, fairest spot."
**What:** Find a safe, convenient meeting point between buyer and seller for marketplace transactions (Facebook Marketplace, Craigslist, OfferUp, etc.)
**Why:** Massive TAM — millions of marketplace transactions daily. Nobody serves this well. Safety angle is highly marketable.
**How it works:**
- Enter two locations (yours + buyer/seller)
- We find the midpoint (same core logic we have)
- Suggest well-lit, public meeting spots: police station parking lots, bank lobbies, coffee shops, shopping centers
- Show safety ratings or "public place" indicators
- Option to share the meeting spot link with the other party

**Effort:** M
**Revenue:** 💰💰 (affiliate links to marketplace platforms, potential partnerships with OfferUp/Mercari)
**Tier:** Free with premium upgrades (saved swap spots, safety scores)
**Marketing angle:** TikTok/Reddit viral potential — safety content, "life hack" positioning
**Dependencies:** POI data we already have; may want to add "police station" and "public building" categories via Mapbox

---

### 1.2 Drift Radius (Fairness Zone)
**Tagline:** "Not just a point — a zone where it's fair for both of you."
**What:** Instead of a single midpoint, show a shaded area on the map where drive times for both people are within a configurable tolerance (e.g., ±5, 10, or 15 minutes).
**Why:** Genuinely novel — no competitor does this. Solves the real problem: exact midpoints sometimes land in the middle of nowhere. A fairness zone gives users way more options while keeping it equitable.
**How it works:**
- After calculating the midpoint, compute drive times from both origins to a grid of nearby points
- Shade the area on the map where the time difference is within threshold
- All place results filter to within this zone
- User adjusts the tolerance slider (±5 / ±10 / ±15 min)

**Effort:** L (drive time calculations at multiple points, map overlay rendering)
**Revenue:** 💰💰💰 (strong premium differentiator — "unlock Drift Radius for $X/mo")
**Tier:** Premium
**Dependencies:** Multiple Google Routes API calls per search (cost consideration — may need caching strategy)
**Technical notes:** Could use isochrone mapping (Mapbox has an Isochrone API). Overlay two isochrones and show the intersection.

---

### 1.3 Commute Equalizer
**Tagline:** "House hunting? Find neighborhoods fair for both commutes."
**What:** Enter both partners' workplaces → we show neighborhoods/areas where both commutes are balanced (within a tolerance). Overlay on map with housing data or just show the zone.
**Why:** House hunting is high-stakes and emotional. Couples argue about commute fairness. This solves it with data. Real estate agents would share this tool.
**How it works:**
- Enter Workplace A + Workplace B
- Set max commute tolerance (e.g., "neither of us wants more than 40 min")
- Set fairness tolerance (e.g., "within 10 min of each other")
- Display heatmap/zone of neighborhoods that satisfy both constraints
- Bonus: overlay median home prices (Zillow/Redfin API)

**Effort:** XL
**Revenue:** 💰💰💰 (real estate affiliate — Zillow/Redfin/Realtor.com partnerships, premium feature)
**Tier:** Premium
**Marketing angle:** "The app every house-hunting couple needs" — lifestyle blogs, real estate TikTok, wedding/relationship content
**Dependencies:** Isochrone calculations, possibly Zillow API for home price overlay

---

### 1.4 Group Gravity (3+ People)
**Tagline:** "5 friends. 3 states. 1 perfect meeting spot."
**What:** Find the optimal meeting point for 3 or more people, weighted by drive time.
**Why:** Most-requested feature type for midpoint tools. Competitors either don't support it or charge for it (WhatsHalfway's multi-point is paid). Weekend trips, friend groups, family reunions.
**How it works:**
- Enter 3-10 locations
- Algorithm finds the geographic point that minimizes total or max drive time
- Show places near that optimal center
- Display drive time from each person to the meeting point

**Effort:** L
**Revenue:** 💰💰 (premium feature, group planning affiliate potential — Airbnb, VRBO, restaurant group booking)
**Tier:** Free for 3 people, premium for 4+
**Technical notes:** Weighted centroid calculation → iterative refinement using drive time queries. More API calls = higher cost per search.
**Dependencies:** UI for multiple location inputs, optimization algorithm

---

## TIER 2 — Build After Core Premium (High Value, More Effort)

### 2.1 Midpoint Date Night
**Tagline:** "Not just a restaurant. A whole evening."
**What:** Curated multi-stop itineraries at your midpoint — dinner → dessert → activity → walk. Auto-generated based on what's actually there.
**Why:** Nobody does this. Elevates us from "utility tool" to "experience planner." Perfect for couples, date nights, friend hangouts.
**How it works:**
- After finding midpoint, tap "Plan a Date Night" (or "Plan an Outing")
- We auto-generate 2-3 itinerary options:
  - 🍽 Dinner at [restaurant] → 🍦 Dessert at [cafe] → 🌳 Walk at [park]
  - 🎯 Activity at [attraction] → 🍕 Late dinner at [restaurant]
- Each itinerary shows total time, distance between stops, and links to each place
- One-tap share the full plan with your person

**Effort:** L
**Revenue:** 💰💰💰 (OpenTable reservations, activity booking affiliate, premium feature)
**Tier:** Premium (1 free itinerary per search, unlimited with subscription)
**Dependencies:** OpenTable integration (for restaurant quality/booking), enough POI data density

---

### 2.2 Recurring Midpoints
**Tagline:** "Every other Friday — fresh ideas at your midpoint."
**What:** For co-parents, long-distance couples, regular meetup groups. Save a midpoint and get periodic suggestions for new places to try there.
**Why:** Retention loop. Keeps users coming back. Co-parents alone are a huge niche (estimated 15M+ in the US). Long-distance couples another massive segment.
**How it works:**
- Save a midpoint pair (e.g., "Me ↔ Sarah")
- Set a schedule (weekly, biweekly, monthly)
- We send a notification/email: "This week at your midpoint: new Thai restaurant opened, park is hosting a market"
- Track what you've already visited so suggestions stay fresh

**Effort:** L
**Revenue:** 💰💰 (retention → more affiliate clicks, premium feature)
**Tier:** Premium
**Dependencies:** User accounts, notification system (email or push), place change detection

---

### 2.3 Midpoint Roulette
**Tagline:** "Feeling adventurous? Just go."
**What:** Random spot selection at your midpoint. No filters, no choosing. We pick, you go.
**Why:** Fun, shareable, great for couples in a decision rut. Low effort to build, high marketing value.
**How it works:**
- Calculate midpoint as usual
- Tap "🎲 Surprise Me"
- We pick a random place near the midpoint — could be anything
- Show it with a fun reveal animation
- Option to "spin again" (limited on free tier)

**Effort:** S
**Revenue:** 💰 (engagement, viral sharing)
**Tier:** Free (great for marketing/virality)
**Marketing angle:** TikTok content — "we let an app pick our date spot" trending format

---

## TIER 3 — Future Vision (Longer Play)

### 3.1 Midpoint Memories
**Tagline:** "Every place you've met. On a map. Over time."
**What:** After meeting up, snap a photo and tag the location. Build a visual timeline of all places you've met someone — a relationship map.
**Why:** Emotionally sticky. Creates a reason to keep using the app and brings a social/personal element. Great for couples, friends, family.
**How it works:**
- After a meetup, prompt: "How was it? Add a photo!"
- Photo + location + date saved to your map
- Over time, see all your midpoint memories on a visual timeline
- Share your "midpoint journey" with someone

**Effort:** XL
**Revenue:** 💰 (engagement/retention, potential photo printing partnership)
**Tier:** Premium
**Dependencies:** User accounts, photo upload/storage, social features

---

### 3.2 The Midpoint Game (Gamification)
**Tagline:** "You've explored 3 midpoints this month. Discover 2 more to unlock a badge."
**What:** Gamify exploration. Badges, streaks, leaderboards, challenges.
**Why:** Proven retention mechanic. Works especially well once we have user accounts.
**Features:**
- "Explorer" badges (visited 5, 10, 25 midpoints)
- Monthly challenges ("Try a midpoint in a new state")
- Streak tracking ("3 meetups this month!")
- Social leaderboard among friends

**Effort:** L
**Revenue:** 💰 (engagement/retention)
**Tier:** Free (drives usage) with premium badges/features
**Dependencies:** User accounts, usage tracking

---

### 3.3 Midpoint for Remote Teams (Enterprise)
**Tagline:** "Quarterly offsite? Find the fairest city for everyone."
**What:** For distributed teams planning in-person meetups. Enter all team members' locations → find the optimal city where total travel (flights + drives) is minimized and fair.
**Why:** Enterprise play. Remote work is permanent. Companies spend $thousands on offsites and pick locations arbitrarily.
**How it works:**
- Enter 5-50 team member locations
- We calculate optimal meeting cities considering:
  - Flight availability and cost estimates
  - Drive times for those within driving distance
  - Hotel costs in candidate cities
  - Venue availability
- Output: ranked list of cities with fairness score and estimated total travel cost

**Effort:** XL
**Revenue:** 💰💰💰 (enterprise SaaS pricing — $50-200/mo per team)
**Tier:** Separate enterprise product
**Dependencies:** Flight data API (Skyscanner/Google Flights), hotel pricing API, totally different sales motion

---

### 3.4 The Commute Equalizer Pro — Relocation Edition
**What:** Extension of Commute Equalizer for job changes. "I just got a new job at X. We currently live at Y. My partner works at Z. Where should we move?"
**Effort:** M (builds on Commute Equalizer)
**Revenue:** 💰💰💰 (real estate affiliate)
**Tier:** Premium

---

## CURRENT FEATURES (Shipped)

For reference — what's live today:

- ✅ Drive-time midpoint calculation with live traffic
- ✅ Multiple route options with time comparisons
- ✅ Travel modes: Drive, Bike, Walk (with auto-recalculation)
- ✅ 6 place categories: Food, Coffee, Parks, Activities, Gas, Hotels (25 results each)
- ✅ ⭐ Local Only filter (hide chains)
- ✅ Place details: name, distance, open/closed, address, phone, website, directions
- ✅ Share route via link
- ✅ Open midpoint in Google Maps
- ✅ Route caching per travel mode
- ✅ Mobile-first responsive design
- ✅ Zero signup required
- ✅ 100% free

---

## MONETIZATION ROADMAP

| Phase | Feature | Revenue Model | Timeline |
|-------|---------|---------------|----------|
| 1 | OpenTable integration | Affiliate commission on reservations | Now (application pending) |
| 2 | Fair Swap Zones | Free feature → user growth → affiliate | Q2 2026 |
| 3 | Drift Radius | Premium subscription ($5/mo) | Q2 2026 |
| 4 | Group Gravity | Free for 3, premium for 4+ | Q3 2026 |
| 5 | Commute Equalizer | Premium ($5/mo or $10/mo bundle) | Q3 2026 |
| 6 | Date Night itineraries | Premium + OpenTable/Viator affiliate | Q3 2026 |
| 7 | Recurring Midpoints | Premium (requires accounts) | Q4 2026 |
| 8 | Enterprise/Remote Teams | SaaS ($50-200/mo) | 2027 |

**Target premium pricing:** $4.99/mo or $29.99/yr — unlocks Drift Radius, Group Gravity 4+, Commute Equalizer, Date Night, Recurring Midpoints, unlimited Roulette spins.

---

## MARKETING PRIORITIES

| Feature | Marketing Channel | Why |
|---------|-------------------|-----|
| Fair Swap Zones | TikTok, Reddit (r/FacebookMarketplace, r/Flipping) | Safety angle is viral |
| Midpoint Roulette | TikTok, Instagram Reels | "Let an app pick our date" content |
| Commute Equalizer | Real estate blogs, couple lifestyle content | High-intent audience |
| Core product | Reddit (r/LongDistance, r/coparenting), Product Hunt | Direct need |
| Date Night | Lifestyle blogs, couple influencers | Aspirational content |

---

## NOTES

- All premium features assume eventual user account system (OAuth — Google/Apple sign-in, no passwords)
- Free tier should always be genuinely useful — premium adds depth, not gates core value
- Fair Swap Zones and Midpoint Roulette are the strongest viral/marketing features
- Commute Equalizer and Drift Radius are the strongest "worth paying for" features
- Enterprise (Remote Teams) is a completely different product motion — don't distract from consumer growth
