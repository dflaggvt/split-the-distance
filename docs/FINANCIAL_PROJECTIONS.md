# Split The Distance — Financial Projections
*Created: February 7, 2026*

## Current Traffic Baseline

| Metric | Value |
|--------|-------|
| Total Sessions (2 days) | 451 |
| Total Searches (2 days) | 1,411 |
| Searches per Session | 3.1 |
| Daily Average | ~700 searches/day |

*Note: Day 1 had a Reddit spike. Organic baseline is likely ~200-400 searches/day without marketing.*

---

## Cost Per Search (API Breakdown)

Each search triggers these API calls:

| API | Cost per 1,000 | Calls per Search | Cost per Search |
|-----|----------------|------------------|-----------------|
| Routes API | $5.00 | 1 | $0.005 |
| Places Nearby Search (New) | $32.00 | 6 categories | $0.192 |
| **Total** | | | **$0.197** |

**Rounded: ~$0.20 per search**

---

## Traffic Milestones & Costs

### Milestone 1: 1,000 Users/Day
| Metric | Value |
|--------|-------|
| Daily Sessions | 1,000 |
| Daily Searches (3.1x) | 3,100 |
| **Daily API Cost** | **$620** |
| **Monthly API Cost** | **$18,600** |

### Milestone 2: 10,000 Users/Day
| Metric | Value |
|--------|-------|
| Daily Sessions | 10,000 |
| Daily Searches (3.1x) | 31,000 |
| **Daily API Cost** | **$6,200** |
| **Monthly API Cost** | **$186,000** |

---

## Other Costs

| Service | Free Tier | When We Pay |
|---------|-----------|-------------|
| **Vercel** | 100GB bandwidth, 100 hrs compute | ~50K+ visitors/month |
| **Supabase** | 500MB DB, 2GB bandwidth | ~100K+ rows or heavy traffic |
| **Domain** | — | ~$50/year (we own 6 TLDs) |
| **Total Fixed** | | **~$50/year currently** |

**Key insight:** Google APIs are 99% of our costs.

---

## Revenue Projections

### At 1,000 Users/Day
Assuming 10% click a restaurant → 5% book via affiliate link:
- 1,000 users × 10% click × 5% book = **5 bookings/day**
- At $1/booking = **$5/day = $150/month**

**Gap: -$18,450/month** ❌

### At 10,000 Users/Day
- 10,000 × 10% × 5% = **50 bookings/day**
- At $1/booking = **$50/day = $1,500/month**
- Add sponsored placements (~$5K/month realistic)

**Gap: -$179,500/month** ❌

---

## The Problem

**API costs scale linearly with traffic. Affiliate revenue doesn't cover it.**

At current pricing:
- Breakeven requires **$0.20 revenue per search**
- That's 20 bookings per 100 searches (20% conversion to paid booking)
- Industry average is <1%

---

## Solutions to Explore

### 1. Reduce API Costs
- **Cache routes:** Same city pairs = same midpoint. Cache for 24hrs.
- **Lazy-load places:** Only fetch places when user scrolls to list (not on every search)
- **Reduce categories:** Default to 3 categories instead of 6
- **Potential savings:** 50-70% reduction → **$0.06-0.10/search**

### 2. Increase Revenue Per User
- **Sponsored placements:** Charge restaurants $50-200/month to be featured
- **Lead gen for restaurants:** Charge per click ($0.50-2.00)
- **Premium features:** $5/month for saved routes, trip history
- **Local business partnerships:** Direct deals with regional chains

### 3. Alternative Growth Path
- **B2B pivot:** License to wedding planners, event coordinators, real estate agents
- **White-label:** Offer to food delivery apps, dating apps
- **API as a service:** Charge developers to use our midpoint logic

### 4. Funding
If we want to grow fast without revenue pressure:
- **Pre-seed:** $50-100K for 12-18 months runway at 10K users/day
- **Seed:** $500K-1M for product expansion + team

---

## When Do We Hit Milestones?

### Without Marketing (Organic Only)
| Milestone | Timeline | Assumption |
|-----------|----------|------------|
| 1K users/day | 6-12 months | 10% monthly organic growth |
| 10K users/day | 18-24 months | Viral moments + SEO |

### With Active Marketing
| Milestone | Timeline | Assumption |
|-----------|----------|------------|
| 1K users/day | 1-2 months | Reddit, TikTok, Product Hunt |
| 10K users/day | 4-6 months | Press coverage, influencer partnerships |

---

## Recommendation

**Short-term (Now):**
1. Implement route caching → save 30-50% on Routes API
2. Lazy-load places → save 50% on Places API  
3. Target **$0.08/search** cost

**Medium-term (1K users):**
1. Launch affiliate integration (OpenTable)
2. Approach 5-10 local restaurant chains for sponsored placements
3. Target **$500-1K/month revenue**

**Long-term (10K users):**
1. Seek seed funding OR
2. Pivot to B2B licensing model
3. Target **$50K+/month revenue** to cover costs

---

## Summary

| Scenario | Monthly Cost | Monthly Revenue | Gap |
|----------|--------------|-----------------|-----|
| Current (700 searches/day) | ~$4,200 | $0 | -$4,200 |
| 1K users/day | $18,600 | $150 (affiliate) | -$18,450 |
| 1K users + optimizations | $5,600 | $1,000 (affiliate + sponsors) | -$4,600 |
| 10K users + optimizations | $56,000 | $10,000 (affiliate + sponsors + premium) | -$46,000 |

**Bottom line:** We need to either (a) dramatically reduce API costs, (b) find high-margin revenue streams, or (c) raise funding to cover the gap while we grow.
