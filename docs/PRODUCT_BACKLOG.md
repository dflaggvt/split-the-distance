# Split The Distance — Product Backlog

_Last updated: February 10, 2026_

---

## How This Is Organized

Each feature is categorized by tier (build priority), tagged with effort, revenue potential, and whether it's free or premium.

**Effort:** S (days) | M (1-2 weeks) | L (3-4 weeks) | XL (1-2 months)
**Revenue:** 💰 (indirect/engagement) | 💰💰 (affiliate/ads) | 💰💰💰 (direct paid/enterprise)

---

## FEATURE TIERS (Free / Account / Premium)

### Free (No Account)
- Core midpoint by drive time
- Distance-based midpoint toggle (default: drive time)
- Place discovery (all 6 categories, 25 results each)
- Local Only filter (hide chains)
- Sharing via link
- Midpoint Roulette ("🎲 Surprise Me")
- Travel modes: Drive, Bike, Walk

### Free with Account
- Reservation history (reservations made via our site)
- Place photos from affiliate partners (OpenTable restaurant photos, etc.) — free because they cost us nothing
- Trip history (view-only, last 5 routes)

### Paid Premium ($4.99/mo or $29.99/yr)
- Unlimited saved routes with pinned stops
- Drop pins along routes + travel notes ("remember this spot")
- Drift Radius (fairness zone)
- Group Gravity (4+ people)
- Incremental Stops (road trip mode)
- Plan an Outing (curated multi-stop itineraries)
- Full trip history (unlimited)
- Recurring Midpoints (fresh suggestions on a schedule)
- Place photos from paid APIs (non-restaurant/non-affiliate categories)

---

## TIER 1 — Build Next (High Impact, Achievable Now)

### 1.1 Drift Radius (Fairness Zone) ⭐ _Theresa priority_
**Tagline:** "Not just a point — a zone where it's fair for both of you."
**What:** Instead of a single midpoint, show a shaded area on the map where drive times for both people are within a configurable tolerance (e.g., ±5, 10, or 15 minutes).
**Why:** Genuinely novel — no competitor does this. Solves the real problem: exact midpoints sometimes land in the middle of nowhere. A fairness zone gives users way more options while keeping it equitable.
**How it works:**
- After calculating the midpoint, compute drive times from both origins to a grid of nearby points
- Shade the area on the map where the time difference is within threshold
- All place results filter to within this zone
- User adjusts the tolerance slider (±5 / ±10 / ±15 min)

**Effort:** L (drive time calculations at multiple points, map overlay rendering)
**Revenue:** 💰💰💰 (strong premium differentiator)
**Tier:** Premium
**Dependencies:** Multiple Google Routes API calls per search (cost consideration — may need caching strategy)
**Technical notes:** Could use isochrone mapping (Mapbox has an Isochrone API). Overlay two isochrones and show the intersection.

---

### 1.2 Saved Routes & Pinned Stops (Travel Journal) ⭐ _Theresa priority_
**Tagline:** "A bookmark for the real world."
**What:** Save routes you've searched, pin favorite stops along them, and add travel notes. Build a personal guide for routes you drive regularly.
**Why:** Turns a one-time tool into something people return to. Two use cases:
1. **Retrospective:** "I stopped at this amazing bakery on I-95 — pin it so I remember next time."
2. **In-the-moment discovery:** "I see something interesting from the road — pin these coordinates to look more closely later." Like a bookmark for the real world.
The second use case implies a quick, low-friction interaction — one-tap "📌 Drop Pin" that grabs current GPS coordinates with an optional quick note. You're driving, you see something, you tap once. Look it up later.
**How it works:**
- Save any route with one tap
- Drop pins at places you've visited or want to remember
- Add notes to pins ("amazing croissants, closed Mondays, park in back")
- See all your saved routes + pins on a personal map
- Revisit saved routes and see what's new nearby

**Effort:** M
**Revenue:** 💰💰💰 (premium feature, high retention)
**Tier:** Premium
**Dependencies:** User accounts, Supabase storage for saved data

---

### 1.3 Fair Swap Zones
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

### 1.4 Group Gravity (3+ People) ⭐ _Theresa priority_
**Tagline:** "5 friends. 3 states. 1 perfect meeting spot."
**What:** Find the optimal meeting point for 3 or more people, weighted by drive time. Perfect for family reunions, college friend weekends, group hangs.
**Why:** Most-requested feature type for midpoint tools. Competitors either don't support it or charge for it (WhatsHalfway's multi-point is paid). Weekend trips, friend groups, family reunions.
**How it works:**
- Enter 3-10 locations
- Algorithm finds the geographic point that minimizes total or max drive time
- Show places near that optimal center
- Display drive time from each person to the meeting point

**Effort:** L
**Revenue:** 💰💰 (premium feature, group planning affiliate potential — Airbnb, VRBO, restaurant group booking)
**Tier:** Free with account for 3 people, premium for 4+
**Technical notes:** Weighted centroid calculation → iterative refinement using drive time queries. More API calls = higher cost per search.
**Dependencies:** UI for multiple location inputs, optimization algorithm

---

### 1.5 Incremental Stops (Road Trip Mode) 🆕
**Tagline:** "Long drive? Plan stops along the way."
**What:** For longer trips, plan multiple stops along the route rather than just the halfway point. Stop every 90 minutes, every 100 miles, or at set intervals.
**Why:** Natural extension of what we do. Long road trips need multiple break points, not just one midpoint. Nobody combines drive-time-based intervals with place discovery well.
**How it works:**
- After searching a route, tap "Plan Stops" or "Road Trip Mode"
- Choose interval: every 60/90/120 min or every 50/100 miles
- We calculate stop points along the actual route at those intervals
- Show places near each stop point (same category chips)
- Full itinerary view: Stop 1 (1.5h in) → Stop 2 (3h in) → Destination

**Effort:** M
**Revenue:** 💰💰💰 (premium feature, high affiliate potential — gas stations, restaurants, hotels along route)
**Tier:** Premium
**Dependencies:** Route geometry parsing to find interval points, multiple Mapbox place queries per stop

---

### 1.6 Distance-Based Midpoint Toggle 🆕
**Tagline:** "Split by time or distance — your choice."
**What:** Toggle between drive-time midpoint (default) and simple distance-based midpoint.
**Why:** Some users just want the geographic middle. Costs us nothing (pure math, no API call). Makes the tool more complete.
**How it works:**
- Toggle in search panel: ⏱ Drive Time (default) | 📏 Distance
- Distance mode calculates geographic midpoint along the route
- No Routes API call needed for the midpoint calc itself

**Effort:** S
**Revenue:** 💰 (completeness, broader appeal)
**Tier:** Free
**Dependencies:** None — pure client-side math

---

## TIER 2 — Build After Core Premium (High Value, More Effort)

### 2.1 Collaborative Group Trips (Social Trip Planning) 🆕 ⭐ _Theresa concept_
**Tagline:** "Plan the meetup together — not in a group chat."
**What:** A full group coordination layer for planning trips by car/bike/walk. One user creates a trip and invites others. The group collaborates on dates, locations, and stops — with voting, auto-distance calculations, and real-time coordination during the trip.
**Why:** The alternative is 47 messages in a group chat trying to pick a date and a place. This replaces chaotic group texts with structured, distance-aware collaboration. NOT a Roadtrippers competitor — the angle is consensus/social/collaborative, not "plan your solo road trip."
**Target persona:** Family reunions, college friend weekends, group meetups — multiple origins converging on a shared destination.
**How it works:**
- **Create a trip** → invite others (invitees get free limited access, don't need to pay)
- **Date voting** → suggest date ranges, everyone marks 🟢 yes / 🟡 maybe / 🔴 no, best dates surface
- **Location voting** → suggest meetup spots, auto-calculate distance from each person's origin, vote up/down
- **Origin per person** → each invitee sets their starting point (default: home, can change)
- **Trip chat/log** → running conversation + organized vote-ups, keeps ideas in one place
- **Multi-stop itinerary** → plan one or many stops, build a full day or multi-day agenda
- **Live trip mode** → once underway, add stops on the fly, push notifications to the group, share ETAs
- **Multi-day support** → breakfast spots, attractions, evening plans — a living itinerary built by the group

**Effort:** XL
**Revenue:** 💰💰💰 (premium feature, high retention, group affiliate potential — Airbnb, restaurants, activities)
**Tier:** Premium (creator pays, invitees get free limited access)
**Dependencies:** Group Gravity (3+ people) ships first as foundation, then this layers coordination on top. Requires user accounts, real-time updates (websockets or polling), push notifications.
**Build sequence:**
1. Group Gravity (Tier 1) → 3+ people midpoint
2. Date/calendar voting (M effort) → first collab feature, standalone useful
3. Location voting + auto-distance per person
4. Trip chat/log + live trip mode + push notifications
**Key differentiator from Roadtrippers:** Roadtrippers = "I plan MY road trip." This = "WE plan OUR meetup." Multiple origins converging, not one origin with stops.

---

### 2.2 Plan an Outing (Curated Itineraries) — _working title, considering: Split Adventure, Midpoint Mission, Split Expedition, Split Day, Go the Distance, Get Split_
**Tagline:** "Not just a restaurant. A whole experience."
**What:** Curated multi-stop itineraries at your midpoint — dinner → dessert → activity → walk. Auto-generated based on what's actually there. Framed for ANY group: couples, friend weekends, family reunions, college meetups.
**Why:** Elevates us from "utility tool" to "experience planner." Most people using this aren't in commuter relationships — they're planning group hangs, reunions, friend weekends.
**How it works:**
- After finding midpoint, tap "Plan an Outing"
- We auto-generate 2-3 itinerary options:
  - 🍽 Dinner at [restaurant] → 🍦 Dessert at [cafe] → 🌳 Walk at [park]
  - 🎯 Activity at [attraction] → 🍕 Late dinner at [restaurant]
  - 🏨 Hotel + full day itinerary for overnight trips
- Each itinerary shows total time, distance between stops, and links to each place
- One-tap share the full plan with your group

**Effort:** L
**Revenue:** 💰💰💰 (OpenTable reservations, activity booking affiliate, premium feature)
**Tier:** Premium (1 free itinerary per search, unlimited with subscription)
**Dependencies:** OpenTable integration (for restaurant quality/booking), enough POI data density
**Theresa's note:** Frame for groups/reunions/friend weekends, not just couples

---

### 2.2 Recurring Midpoints ⭐ _Theresa priority_
**Tagline:** "Every other Friday — fresh ideas at your midpoint."
**What:** For co-parents, long-distance couples, regular meetup groups, or anyone who drives the same route regularly. Save a midpoint and get periodic suggestions for new places to try there.
**Why:** Retention loop. Keeps users coming back. Co-parents alone are a huge niche (estimated 15M+ in the US). Also great for regular commuters who want to discover what's new along their usual route.
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
**What:** Random spot selection at your midpoint. No filters, no choosing. We pick a random place — could be a restaurant, a park, an attraction — you just go.
**Why:** Fun, shareable, great for groups who can't decide or want spontaneity. Low effort to build, high marketing value.
**Target persona:** People with natural distance between them — family members in different states, college friends spread across the country, business associates meeting up. NOT couples who live near each other (they don't need a midpoint tool).
**How it works:**
- Calculate midpoint as usual
- Tap "🎲 Surprise Me"
- We pick a random place near the midpoint
- Show it with a fun reveal animation
- Option to "spin again"

**Effort:** S
**Revenue:** 💰 (engagement, viral sharing)
**Tier:** Free (great for marketing/virality)
**Marketing angle:** TikTok content — "we let an app pick where our friend group meets" / "siblings in different states let an app decide" trending format

---

### 2.4 Reservation History & Place Photos
**What:** Show users what reservations they've made through our site. Display place photos in search results.
**Why:** Photos make place cards significantly more useful. Reservation history builds loyalty and shows platform value.
**How it works:**
- Reservation tracking: log when users click through to OpenTable/booking partners, show history in their account
- Place photos: pull from OpenTable (restaurants) and future partners (hotels, activities)

**Effort:** M
**Revenue:** 💰💰 (drives more affiliate clicks, builds account stickiness)
**Tier:** Free with account
**Dependencies:** OpenTable integration, user accounts

---

## TIER 3 — Future Vision (Longer Play)

### 3.1 Commute Equalizer
**Tagline:** "House hunting? Find neighborhoods fair for both commutes."
**What:** Enter both partners' workplaces → show neighborhoods where both commutes are balanced.
**Why:** High-stakes, emotional decision. Real estate agents would share this.
**Current concern:** Without public transportation data (buses, trains, subway), this won't work well in major metro areas (NYC, Chicago, Boston, DC) where transit is the primary commute. **Need to integrate transit APIs before launching this.**
**How it works:**
- Enter Workplace A + Workplace B
- Set max commute tolerance and fairness tolerance
- Display heatmap/zone of neighborhoods satisfying both constraints
- Overlay median home prices (Zillow/Redfin API)
- **Must include:** driving, transit, biking, walking commute options

**Effort:** XL
**Revenue:** 💰💰💰 (real estate affiliate — Zillow/Redfin/Realtor.com partnerships)
**Tier:** Premium
**Dependencies:** Google Transit Directions API, isochrone calculations, Zillow API
**Status:** Deprioritized until transit integration is feasible
**Theresa's note:** Skeptical without public transit — won't be applicable in major metro areas

---

### 3.2 Midpoint Memories
**Tagline:** "Every place you've met. On a map. Over time."
**What:** After meeting up, snap a photo and tag the location. Build a visual timeline of all places you've met someone — a relationship map.
**Why:** Emotionally sticky. Creates a reason to keep using the app and brings a social/personal element.
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

### 3.3 The Midpoint Game (Gamification)
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

### 3.4 Midpoint for Remote Teams (Enterprise)
**Tagline:** "Quarterly offsite? Find the fairest city for everyone."
**What:** For distributed teams planning in-person meetups. Enter all team members' locations → find optimal city minimizing total travel.
**Why:** Enterprise play. Remote work is permanent.
**How it works:**
- Enter 5-50 team member locations
- Calculate optimal cities considering flights, drives, hotel costs, venue availability
- Output: ranked list of cities with fairness score and estimated total travel cost

**Effort:** XL
**Revenue:** 💰💰💰 (enterprise SaaS pricing — $50-200/mo per team)
**Tier:** Separate enterprise product
**Dependencies:** Flight data API, hotel pricing API, totally different sales motion

---

## CURRENT FEATURES (Shipped)

- ✅ Drive-time midpoint calculation with live traffic
- ✅ Multiple route options with time comparisons
- ✅ Travel modes: Drive, Bike, Walk (with auto-recalculation + caching)
- ✅ 6 place categories: Food, Coffee, Parks, Activities, Gas, Hotels (25 results each)
- ✅ ⭐ Local Only filter (hide chains via Mapbox brand field)
- ✅ Place details: name, distance, open/closed, address, phone, website, directions
- ✅ Share route via link
- ✅ Open midpoint in Google Maps
- ✅ Mobile-first responsive design
- ✅ Zero signup required
- ✅ 100% free

---

## MONETIZATION ROADMAP

| Phase | Feature | Revenue Model | Timeline |
|-------|---------|---------------|----------|
| 1 | OpenTable integration | Affiliate commission on reservations | Now (application pending) |
| 2 | Distance toggle | Free — drives broader usage | Q1 2026 |
| 3 | Midpoint Roulette | Free — viral marketing feature | Q1 2026 |
| 4 | Fair Swap Zones | Free → user growth → affiliate | Q2 2026 |
| 5 | Drift Radius | Premium subscription ($4.99/mo) | Q2 2026 |
| 6 | Saved Routes + Travel Journal | Premium ($4.99/mo) | Q2 2026 |
| 7 | Group Gravity | Free for 3, premium for 4+ | Q3 2026 |
| 8 | Incremental Stops | Premium ($4.99/mo) | Q3 2026 |
| 9 | Plan an Outing | Premium + affiliate | Q3 2026 |
| 10 | Recurring Midpoints | Premium (requires accounts) | Q4 2026 |
| 11 | Commute Equalizer | Premium (after transit integration) | 2027 |
| 12 | Enterprise/Remote Teams | SaaS ($50-200/mo) | 2027+ |

**Target premium pricing:** $4.99/mo or $29.99/yr — unlocks Drift Radius, Saved Routes + Travel Journal, Group Gravity 4+, Incremental Stops, Plan an Outing, Recurring Midpoints, unlimited everything.

---

## MARKETING PRIORITIES

| Feature | Marketing Channel | Why |
|---------|-------------------|-----|
| Fair Swap Zones | TikTok, Reddit (r/FacebookMarketplace, r/Flipping) | Safety angle is viral |
| Midpoint Roulette | TikTok, Instagram Reels | "Let an app pick our spot" content |
| Group Gravity | Reddit (r/roadtrip, r/travel), friend group content | "Plan a reunion" angle |
| Core product | Reddit (r/LongDistance, r/coparenting), Product Hunt | Direct need |
| Incremental Stops | Road trip bloggers, travel TikTok | "Plan your road trip stops" |
| Plan an Outing | Lifestyle blogs, couple/friend influencers | Aspirational content |

---

## DECISION LOG

| Date | Decision | Rationale | Who |
|------|----------|-----------|-----|
| Feb 10 | Distance toggle = free | Costs nothing (pure math), broadens appeal | Theresa |
| Feb 10 | Saved routes + trip history = paid | High value, retention driver, worth paying for | Theresa |
| Feb 10 | Pinned stops with travel notes = paid | "Travel journal" concept — sticky, personal | Theresa |
| Feb 10 | Renamed "Date Night" → "Plan an Outing" | Most users aren't in commuter relationships — frame for groups, reunions, friend weekends | Theresa |
| Feb 10 | Commute Equalizer → Tier 3 | Without public transit data, won't work in major metros | Theresa |
| Feb 10 | Group Gravity = free w/ account for 3, paid for 4+ | Core use case (3 friends) should be accessible | Theresa |
| Feb 10 | Roulette persona = family/friends/business, NOT couples | Couples live close — midpoint tool is for people with distance between them | Theresa |
| Feb 10 | "Plan an Outing" name TBD | Exploring names aligned with "Split The Distance" brand (adventure, expedition, mission) | Theresa |
| Feb 10 | Collaborative Group Trips — Tier 2 | Social trip planning with date/location voting, live coordination, multi-day support. Builds on Group Gravity. | Theresa |
| Feb 10 | Added Incremental Stops to Tier 1 | Natural extension — longer trips need multiple stops, not just midpoint | Theresa |
| Feb 10 | Reservation history = free with account | Shows platform value, builds loyalty | Theresa |
| Feb 9 | Mapbox for place discovery | 20-35x cheaper than Google NearbySearch | Daryl/Wenee |
| Feb 9 | No Google Ads / AdSense | Affiliate + premium model instead | Daryl |

---

## NOTES

- All premium features assume eventual user account system (OAuth — Google/Apple sign-in, no passwords)
- Free tier should always be genuinely useful — premium adds depth, not gates core value
- Fair Swap Zones and Midpoint Roulette are the strongest viral/marketing features
- Drift Radius and Saved Routes are the strongest "worth paying for" features
- Enterprise (Remote Teams) is a completely different product motion — don't distract from consumer growth
- Commute Equalizer needs transit API integration before it's viable in metro areas
- "Plan an Outing" framed for ALL groups (reunions, friend weekends, family trips) not just couples
