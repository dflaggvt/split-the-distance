# Multi-Location Midpoint Feature Spec

## Overview
Allow 3+ people to find a fair meeting point where no one drives significantly more than others.

---

## User Flow

### Input Phase
```
┌─────────────────────────────────────┐
│  Meet in the Middle                 │
│  Find the fairest spot for everyone │
│                                     │
│  📍 Location A                      │
│  ┌─────────────────────────────┐   │
│  │ New York, NY                │   │
│  └─────────────────────────────┘   │
│                                     │
│  📍 Location B                      │
│  ┌─────────────────────────────┐   │
│  │ Boston, MA                  │   │
│  └─────────────────────────────┘   │
│                                     │
│  📍 Location C                      │
│  ┌─────────────────────────────┐   │
│  │ Philadelphia, PA            │   │
│  └─────────────────────────────┘   │
│                                     │
│  [+ Add Another Person]             │
│                                     │
│  [  Find Meeting Point  ]           │
└─────────────────────────────────────┘
```

**Rules:**
- Minimum: 2 locations (current behavior)
- Maximum: 6 locations (API cost control + UX sanity)
- Can remove any location (except must keep 2 minimum)

---

### Results Phase
```
┌─────────────────────────────────────┐
│  📍 Best Meeting Point              │
│  Hartford, CT                       │
│  [Open in Google Maps →]            │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Drive Times:                │   │
│  │ • From New York:    1h 45m  │   │
│  │ • From Boston:      1h 40m  │   │
│  │ • From Philadelphia: 2h 10m │   │
│  │                             │   │
│  │ Longest drive: 2h 10m       │   │
│  │ Difference: 30 min          │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Filters: 🍽️ ☕ 🌳 ...]            │
│                                     │
│  Places near midpoint...            │
└─────────────────────────────────────┘
```

---

## Algorithm

### Approach: Minimize Maximum Drive Time

**Goal:** Find the point where the person with the longest drive has the shortest possible drive.

**Steps:**
1. Calculate geographic centroid of all input locations
2. Get drive times from each location to centroid
3. Find the location with longest drive time
4. Search for better points by shifting toward that location
5. Iterate until we find the optimal balance (or hit iteration limit)

**Pseudocode:**
```
function findFairMidpoint(locations):
    # Start at geographic center
    candidate = centroid(locations)
    
    for iteration in range(10):
        # Get drive times from all locations
        driveTimes = getDriveTimesTo(candidate, locations)
        
        # Find the "loser" - person with longest drive
        maxTime = max(driveTimes)
        loserLocation = locations[indexOfMax(driveTimes)]
        
        # Check if we're balanced enough (within 15 min spread)
        spread = maxTime - min(driveTimes)
        if spread < 15 minutes:
            break
        
        # Shift candidate toward the loser
        candidate = shiftToward(candidate, loserLocation, factor=0.3)
    
    return candidate
```

### Alternative: Grid Search
- Define bounding box around all locations
- Create grid of candidate points (e.g., 5x5 = 25 points)
- Calculate max drive time to each
- Pick point with lowest max drive time
- Refine with smaller grid around winner

**Trade-offs:**
- Iterative: Fewer API calls, might miss global optimum
- Grid: More API calls, more thorough

**Recommendation:** Start with iterative (cheaper), add grid refinement if results aren't good enough.

---

## API Impact

### Current (2 locations):
- 1 Directions API call (A → B with waypoints)
- ~5 Places API calls (one per category)

### Multi-location (N locations):
- N Directions API calls per iteration (each location → candidate)
- 10 iterations max = 10N Directions calls worst case
- 3 locations × 10 iterations = 30 calls (still reasonable)
- 6 locations × 10 iterations = 60 calls (need to optimize)

**Optimizations:**
- Cache drive times for nearby points
- Reduce iterations if spread is small
- Use Distance Matrix API instead (N origins → 1 destination in single call)

**Distance Matrix API:**
- Single call: all origins → one destination
- Much cheaper for multi-location
- Returns drive times for all locations at once
- **Recommended approach**

---

## Data Model Changes

### searches table additions:
```sql
ALTER TABLE searches ADD COLUMN location_count INTEGER DEFAULT 2;
ALTER TABLE searches ADD COLUMN all_locations JSONB; -- [{name, lat, lng}, ...]
ALTER TABLE searches ADD COLUMN drive_times JSONB;   -- [duration_seconds, ...]
ALTER TABLE searches ADD COLUMN max_drive_seconds INTEGER;
ALTER TABLE searches ADD COLUMN drive_time_spread_seconds INTEGER;
```

---

## Shareable URLs

### Current:
```
splitthedistance.com/?from=NYC&to=Boston
```

### Multi-location:
```
splitthedistance.com/?l=NYC&l=Boston&l=Philadelphia
```
Or:
```
splitthedistance.com/?locations=NYC|Boston|Philadelphia
```

---

## Mobile UX

On mobile, vertical stack of inputs works well:
- Each location has its own row
- "Add" button at bottom
- Remove (X) button on each row (except when only 2 remain)
- Drag to reorder? (nice to have, not MVP)

---

## Implementation Phases

### Phase 2a: Core Multi-Location (MVP)
- [ ] Add "Add Another Person" button
- [ ] Support 3-6 location inputs
- [ ] Implement Distance Matrix API integration
- [ ] Implement iterative midpoint algorithm
- [ ] Show drive times from each location
- [ ] Update analytics to track location_count

### Phase 2b: Polish
- [ ] Shareable URLs for multi-location
- [ ] Better map visualization (multiple route lines)
- [ ] "Fairness score" display
- [ ] Remember last used location count

### Phase 2c: Advanced
- [ ] Named locations ("Alex's place", "Work")
- [ ] Drag to reorder locations
- [ ] Alternative meeting points (show top 3)
- [ ] "Optimize for gas" vs "optimize for time"

---

## Questions for Daryl

1. **Max locations:** Is 6 enough, or do we need more?
2. **Fairness display:** Show difference in drive times prominently?
3. **Alternative points:** Show "2nd best" and "3rd best" options?
4. **Naming:** Let users name locations ("Mom's house") or keep it simple?

---

## Estimated Effort

- **Phase 2a (MVP):** 4-6 hours
- **Phase 2b (Polish):** 2-3 hours  
- **Phase 2c (Advanced):** 4-6 hours

Ready to build on your go-ahead.
