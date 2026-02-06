# Split The Distance - Technical Documentation

**Version:** 1.0.0  
**Last Updated:** February 6, 2026  
**Author:** Wenee 🦊 (weneeflagg@gmail.com)  
**Owner:** Daryl Flagg (dflagg@gmail.com)

---

## Overview

Split The Distance is a web application that finds the drive-time midpoint between two locations and discovers nearby points of interest (restaurants, cafes, parks, etc.) for people to meet. The app calculates the actual driving midpoint based on time, not geographic distance.

**Live URL:** https://www.splitthedistance.com  
**Backup URL:** https://split-the-distance-sage.vercel.app

---

## Tech Stack

### Frontend
- **Framework:** Next.js 14 (React 18)
- **Styling:** Tailwind CSS
- **Maps:** Google Maps JavaScript API via @react-google-maps/api
- **Font:** Inter (Google Fonts)

### Backend / APIs
- **Hosting:** Vercel (serverless)
- **Geocoding:** Google Geocoding API
- **Routing:** Google Directions API
- **Places:** Google Places API (New) - REST endpoints
- **Analytics Database:** Supabase (PostgreSQL)
- **Web Analytics:** Google Analytics 4 (GA4) + Google Tag Manager (GTM)

### Infrastructure
- **Domain Registrar:** GoDaddy
- **DNS:** GoDaddy (pointing to Vercel)
- **SSL:** Vercel (automatic)
- **CDN:** Vercel Edge Network
- **Source Control:** GitHub (dflaggvt/split-the-distance)

---

## Domain Configuration

### Domains Owned (GoDaddy)
- splitthedistance.com (primary)
- splitthedistance.io
- splitthedistance.net
- splitthedistance.org
- splitthedistance.info
- splitthedistance.xyz
- splitthedistance.store

### DNS Records (splitthedistance.com)
| Type | Name | Value |
|------|------|-------|
| A | @ | 216.198.79.1 (Vercel) |
| CNAME | www | 3e821d2ee272e47c.vercel-dns-017.com |
| CNAME | _domainconnect | _domainconnect.gd.domaincontrol.com |
| TXT | _dmarc | v=DMARC1; p=quarantine; ... |
| TXT | _vercel | (verification - can be removed) |
| TXT | _vercel.www | (verification - can be removed) |
| NS | @ | ns23.domaincontrol.com |
| NS | @ | ns24.domaincontrol.com |

### Vercel Configuration
- **Project:** split-the-distance
- **Production Branch:** main
- **Domains:** 
  - splitthedistance.com → redirects to www
  - www.splitthedistance.com → primary production
  - split-the-distance-sage.vercel.app → backup

---

## Google Cloud Platform

### Project
- **Email:** weneeflagg@gmail.com (Editor access)
- **Owner:** dflagg@gmail.com

### APIs Enabled
1. **Maps JavaScript API** - Map rendering
2. **Geocoding API** - Address to coordinates
3. **Directions API** - Route calculation
4. **Places API (New)** - POI search with ratings, photos, hours

### API Key
- Stored in Vercel environment variable: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Restrictions: HTTP referrers (splitthedistance.com, localhost)

---

## Supabase Configuration

### Project Details
- **Project URL:** https://rwabiyqmhwebxkiyjkcc.supabase.co
- **Region:** us-west-2
- **Database:** PostgreSQL 15

### Connection
- **Pooler:** aws-0-us-west-2.pooler.supabase.com:6543
- **Direct:** db.rwabiyqmhwebxkiyjkcc.supabase.co:5432 (IPv6 only)

### Environment Variables (Vercel)
- `NEXT_PUBLIC_SB_PROJECT_URL` - Supabase project URL
- `NEXT_PUBLIC_SB_PUBLISHABLE_KEY` - Anon/public key for client-side

### Database Schema

#### Table: `searches`
Tracks every search performed on the site.

```sql
CREATE TABLE searches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  from_name TEXT,
  from_lat DOUBLE PRECISION,
  from_lng DOUBLE PRECISION,
  to_name TEXT,
  to_lat DOUBLE PRECISION,
  to_lng DOUBLE PRECISION,
  midpoint_lat DOUBLE PRECISION,
  midpoint_lng DOUBLE PRECISION,
  distance_miles DOUBLE PRECISION,
  duration_seconds INTEGER,
  active_filters TEXT[],
  places_found INTEGER,
  user_agent TEXT,
  referrer TEXT,
  is_internal BOOLEAN DEFAULT false
);
```

#### Table: `place_clicks`
Tracks when users click on POI results.

```sql
CREATE TABLE place_clicks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  place_name TEXT,
  place_category TEXT,
  place_lat DOUBLE PRECISION,
  place_lng DOUBLE PRECISION,
  place_rating DOUBLE PRECISION,
  from_search_route TEXT,
  midpoint_lat DOUBLE PRECISION,
  midpoint_lng DOUBLE PRECISION,
  is_internal BOOLEAN DEFAULT false
);
```

#### Row Level Security (RLS)
- Anonymous users can INSERT (for analytics)
- Anonymous users can SELECT (for future features)
- Policies: "Allow public inserts", "Allow public read"

### Internal User Flag
Visit with `?_internal=1` to mark yourself as internal tester. This:
- Sets `localStorage.std_internal = '1'`
- Marks all searches/clicks with `is_internal: true`
- Shows "INTERNAL" badge in header
- Clear with `?_internal=0`

---

## Analytics

### Google Analytics 4
- **Measurement ID:** G-3DME8BT47D
- **Events tracked:**
  - `search` - route searches with from/to/distance/duration
  - `place_click` - POI clicks with name/category/rating

### Google Tag Manager
- **Container ID:** GTM-W9DCSSKC
- Used for GA4 integration and future event tracking

---

## Search Engine Optimization

### Files
- `/robots.txt` - Allows all crawlers, references sitemap
- `/sitemap.xml` - Lists all pages for indexing
- `/google36cee22873c0c47f.html` - Google Search Console verification
- `/BingSiteAuth.xml` - Bing Webmaster Tools verification
- `/767573cf868e6963e32a4e47f43f1305.txt` - IndexNow key

### Search Console Access
- **Google Search Console:** dflagg@gmail.com (owner), weneeflagg@gmail.com (owner)
- **Bing Webmaster Tools:** dflagg@gmail.com

### Meta Tags
```html
<title>Split The Distance — Meet in the Middle</title>
<meta name="description" content="Find the perfect meeting point between two locations based on actual drive time. Discover restaurants, cafes, parks, and more at the midpoint.">
<meta property="og:title" content="Split The Distance — Meet in the Middle">
<meta property="og:description" content="...">
<meta property="og:site_name" content="Split The Distance">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
```

---

## Project Structure

```
split-the-distance-react/
├── app/
│   ├── layout.js          # Root layout with metadata, fonts, GTM
│   └── page.js            # Main page (wraps AppClient in Suspense)
├── components/
│   ├── AppClient.js       # Main app component (client-side)
│   ├── SearchPanel.js     # Left sidebar with inputs and results
│   ├── MapView.js         # Google Maps component
│   ├── HowItWorks.js      # How it works section
│   └── ...
├── lib/
│   ├── analytics.js       # Supabase + GA4 logging
│   ├── geocoding.js       # Google Geocoding API wrapper
│   ├── routing.js         # Google Directions API + midpoint calc
│   ├── places.js          # Google Places API (New) wrapper
│   └── supabase.js        # Supabase client initialization
├── public/
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── google36cee22873c0c47f.html
│   ├── BingSiteAuth.xml
│   ├── 767573cf868e6963e32a4e47f43f1305.txt
│   └── favicon.ico
├── supabase/
│   └── schema.sql         # Database schema
├── .env.local             # Local environment variables
├── package.json
├── tailwind.config.js
└── next.config.js
```

---

## Key Algorithms

### Drive-Time Midpoint Calculation
1. Get route polyline from Google Directions API
2. Calculate total duration in seconds
3. Walk along the polyline, accumulating time for each segment
4. Find the point where accumulated time = 50% of total
5. Interpolate between waypoints if needed

```javascript
// Simplified logic from lib/routing.js
const targetTime = totalDuration / 2;
let accumulatedTime = 0;

for (let i = 0; i < segments.length; i++) {
  if (accumulatedTime + segmentTime >= targetTime) {
    // Interpolate within this segment
    const ratio = (targetTime - accumulatedTime) / segmentTime;
    return interpolatePoint(segment.start, segment.end, ratio);
  }
  accumulatedTime += segmentTime;
}
```

### POI Search
1. Use midpoint coordinates
2. Call Places API (New) Nearby Search
3. Filter by selected categories (restaurant, cafe, park, etc.)
4. Return up to 20 results with name, rating, photos, hours

---

## Environment Variables

### Required for Vercel
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
NEXT_PUBLIC_SB_PROJECT_URL=https://rwabiyqmhwebxkiyjkcc.supabase.co
NEXT_PUBLIC_SB_PUBLISHABLE_KEY=sb_publishable_...
```

### Local Development (.env.local)
Same as above, copy from Vercel dashboard or use test keys.

---

## Deployment

### Automatic (Recommended)
Push to `main` branch → Vercel auto-deploys in ~60 seconds

### Manual
```bash
cd split-the-distance-react
vercel --prod
```

### Preview Deployments
Push to any branch → Vercel creates preview URL

---

## Development

### Setup
```bash
git clone git@github.com:dflaggvt/split-the-distance.git
cd split-the-distance
npm install
cp .env.example .env.local  # Add your API keys
npm run dev
```

### Local URL
http://localhost:3000

### Testing Internal Flag
http://localhost:3000?_internal=1

---

## Credentials & Access

### GitHub
- **Repo:** github.com/dflaggvt/split-the-distance
- **Access:** dflagg (owner), weneeflagg@gmail.com (collaborator via SSH key)

### Vercel
- **Account:** dflagg@gmail.com
- **Project:** split-the-distance

### Supabase
- **Account:** dflagg@gmail.com
- **Project:** rwabiyqmhwebxkiyjkcc

### Google Cloud
- **Project Owner:** dflagg@gmail.com
- **Editor:** weneeflagg@gmail.com

### Domain (GoDaddy)
- **Account:** dflagg@gmail.com

---

## Future Enhancements (Phase 2+)

1. **Multi-location support** - Find midpoint for 3+ people
2. **Interval stops** - Suggest stops along the route at intervals
3. **User accounts** - Save favorite routes and places
4. **Sharing** - Shareable links with route pre-filled (partially done)
5. **Mobile app** - React Native version
6. **Monetization** - Google AdSense integration (ad spaces reserved)
7. **API** - Public API for third-party integrations

---

## Troubleshooting

### "Places not loading"
- Check Google Cloud Console for API quota/errors
- Verify API key restrictions allow the domain
- Check browser console for CORS errors

### "Supabase not logging"
- Verify environment variables in Vercel
- Check Supabase dashboard for RLS policy issues
- Test with `?_internal=1` and check `is_internal` column

### "Map not showing"
- Google Maps API key issue
- Check if billing is enabled on Google Cloud

### "DNS not working"
- Allow 1-24 hours for propagation
- Verify records with `dig splitthedistance.com`

---

## Contact

- **Developer:** Wenee 🦊 (weneeflagg@gmail.com)
- **Owner:** Daryl Flagg (dflagg@gmail.com)

---

*Documentation generated February 6, 2026*
