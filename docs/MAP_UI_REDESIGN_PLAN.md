# Map UI Redesign Plan

## Summary

Create a more map-native Split The Distance experience inspired by the usability patterns in Google Maps: a slim left rail, a collapsible work panel, floating search controls, and horizontal category chips over the map.

This is a saved future plan only. Do not implement it until we explicitly prioritize the redesign.

## Goals

- Make the map feel like the primary workspace.
- Reduce the visual weight of the current left panel.
- Keep the product focused on midpoint planning, not generic map search.
- Preserve the existing paid-search, credits, recent searches, saved plans, AI plans, route options, filters, places, and sharing flows.
- Improve mobile ergonomics with bottom-sheet behavior instead of forcing a desktop panel into a phone layout.

## Desktop Layout

### Left Rail

A narrow vertical rail, roughly 72-96px wide, fixed to the left edge.

Recommended items:

- Menu button
- New search / planner
- Recent searches
- Saved plans
- AI plans
- Account / credits

Behavior:

- The left rail remains visible while the map is active.
- Icons should have labels or tooltips.
- Recent/saved/AI plan items open the side panel in the relevant view.
- Avoid turning this into broad navigation. Keep it planner-focused.

### Collapsible Side Panel

A wider panel opens beside the rail when needed.

Panel states:

- Search mode: route inputs, travel mode, midpoint mode, credits status, split button.
- Results mode: route summary, save plan, AI Plan Builder, category filters, places, route options.
- Recent mode: recent searches and rerun actions.
- Saved mode: saved routes/plans.
- AI plans mode: previously generated AI meetup plans.

Behavior:

- The panel can collapse to reveal more map.
- Route/results content should not disappear unexpectedly after a search.
- Keep current feature gates and credit prompts intact.

### Floating Search Bar

Use a floating search/search-summary control over the top-left of the map.

For Split The Distance, this should not become a generic place search. It should support:

- Start location
- Destination / second person
- Add person for group midpoint
- Swap
- Travel mode
- Split The Distance action

Possible approach:

- Compact state: "Alexandria -> Richmond" with edit button.
- Expanded state: full route input panel.

### Floating Category Chips

Add horizontal chips above the map after a midpoint exists.

Initial chips should mirror current functionality:

- Food
- Coffee
- Parks
- Gas
- Hotels
- Activities
- Local Only

Future chips:

- Kid-friendly
- Safe public meetup
- Quiet place
- Dinner + activity
- Road trip break

Behavior:

- Chips should toggle the same filters as the current `FilterChips`.
- Chips should not trigger new pre-payment API costs.
- On desktop, chips can float at the top of the map.
- On mobile, chips should become a horizontal scroll row inside the bottom sheet or pinned just above it.

### Map Markers

Keep the existing midpoint, route, place marker, and active place behavior.

Improvements:

- Make active place marker/card coordination more obvious.
- Keep route options visible without overcrowding the map.
- Preserve Google Maps attribution and controls.

## Mobile Layout

Mobile should not copy the desktop left rail literally.

Recommended mobile behavior:

- Full-width map as the background workspace.
- Bottom sheet for search/results.
- Bottom sheet snap points:
  - Collapsed: route summary or "enter locations"
  - Half: inputs/results preview
  - Full: full results list and AI Plan Builder
- Horizontal chip row inside or above the bottom sheet.
- Sticky primary action inside the sheet when inputs are complete.

Mobile navigation:

- Menu/account/recent/saved can live in a compact top-left or bottom-sheet header menu.
- Avoid persistent vertical rail on phones.

## Feature Mapping

Current feature | New UI location
--- | ---
Location inputs | Floating search / side panel / mobile bottom sheet
Split The Distance button | Search panel primary action
Credits card | Side panel near action; compact account/credits rail item
Recent searches | Rail item + side panel view
Save plan | Results panel near route summary
AI Plan Builder | Results panel after save plan CTA
Filter chips | Floating map chips + results panel
Places list | Results side panel / bottom sheet
Route options | Results side panel, collapsible
Road trip stops | Results side panel and map overlays
Account | Rail/account menu

## Implementation Phases

### Phase 1: Shell Only

- Add the left rail and collapsible side panel shell.
- Keep existing `SearchPanel` content inside the side panel.
- Do not move business logic yet.
- Verify desktop and mobile layout do not overlap.

### Phase 2: Floating Controls

- Extract route input controls from `SearchPanel` into reusable components.
- Add floating route/search control on desktop.
- Keep the old panel fallback until stable.

### Phase 3: Map Chips

- Move category filters into floating chips on desktop.
- Keep mobile chips in bottom sheet.
- Reuse existing filter state and event tracking.

### Phase 4: Recent, Saved, AI Panels

- Add rail-driven panel views:
  - Recent
  - Saved
  - AI plans
- Reuse existing account/modal data flows where possible.

### Phase 5: Polish and Measurement

- Track rail clicks, panel opens, chip usage, panel collapse, and mobile sheet snap usage.
- Compare search completion, place clicks, paid conversion, and API costs before/after.

## Risks

- Moving controls over the map can make the UI feel more complex if not restrained.
- Floating controls can overlap Google Maps controls or ads on small screens.
- A generic search bar could confuse the product purpose; the copy must stay route/midpoint-specific.
- Any redesign must preserve the current cost-control work: no autocomplete, geocoding, directions, or places calls before the user has credits.

## Non-Goals

- Do not clone Google Maps.
- Do not add generic map search.
- Do not add new Google API calls just for the redesign.
- Do not remove the paid-credit flow.
- Do not implement this plan until explicitly requested.

