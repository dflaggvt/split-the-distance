# Map UI Redesign Plan

## Status

Saved future design plan. Do not implement until explicitly prioritized.

Last reviewed against `origin/dev`: June 22, 2026.

## Current Development Baseline

The development branch now has several product and cost-control realities that the redesign must preserve:

- The main app is still a two-column layout: fixed top header, `SearchPanel` on the left, `MapView` filling the rest.
- `SearchPanel` is the stateful workflow surface for inputs, credits, results, saved plan CTA, AI Plan Builder, filters, places, roulette, and road trip stops.
- `MapView` already owns map type toggles, traffic toggle, route rendering, midpoint pins, place markers, drift radius, and road trip stop markers.
- Anonymous or no-credit users can type into basic text fields, but location lookup/autocomplete is disabled until they have search credits or an active legacy subscription.
- The map still loads on page load, so any map-first redesign must keep an eye on Maps JavaScript/Dynamic Maps cost.
- Results are generated after a paid search. Place discovery is category-driven; filters start empty and places load when the user chooses categories.
- AI Plan Builder now lives in the results panel after `SavePlanCTA` and before filters/places.
- Saved AI plans currently live in the account modal, not a side panel.
- Mobile currently uses a collapsed/expanded panel toggle with the map above and panel below, not a true bottom sheet.
- Ads are present in the panel, with mobile/desktop placement logic.

## Product Direction

Create a more map-native Split The Distance experience inspired by the usability patterns in Google Maps:

- A slim planner rail.
- A collapsible work panel.
- Floating route/search controls.
- Horizontal category chips over or near the map.
- A mobile bottom sheet that feels designed for route planning.

This should not become a generic map-search product. The redesign should continue to answer:

> Where is the fair place to meet, and what should we do there?

## Goals

- Make the map feel like the primary workspace without hiding the planning workflow.
- Reduce the visual weight of the current 420px left panel.
- Preserve paid-search gating and avoid new pre-payment Google API costs.
- Keep the product focused on midpoint planning, not generic local search.
- Preserve credits, recent searches, saved plans, AI plans, route options, filters, places, road trip stops, sharing, and ads.
- Improve mobile ergonomics with true bottom-sheet behavior.
- Make AI Plan Builder feel like a natural next step after places are available.

## Non-Goals

- Do not clone Google Maps.
- Do not add generic map search.
- Do not add new Google API calls just for the redesign.
- Do not remove the paid-credit flow.
- Do not bypass the no-autocomplete-before-credits cost control.
- Do not redesign the pricing/paywall flow as part of this work unless explicitly scoped.

## Desktop Layout

### Planner Rail

A narrow vertical rail, roughly 72-88px wide, fixed to the left edge below the header.

Recommended items:

- Plan route
- Recent
- Saved
- AI plans
- Account / credits

Avoid a generic hamburger-first navigation pattern. The rail should expose planner actions, not become broad site navigation.

Behavior:

- The rail remains visible while the map is active.
- Rail items open a work panel in the relevant view.
- Icons should have labels or tooltips.
- The active section should be obvious.
- Account/credits can open the existing account modal at first, then later move into a panel view if useful.

### Collapsible Work Panel

A wider panel opens beside the rail. It replaces the current always-visible 420px `SearchPanel` shell, but should initially reuse the existing content and handlers.

Panel views:

- **Route**: person/location inputs, travel mode, midpoint mode, add person, credits status, split button.
- **Results**: route summary, save plan CTA, AI Plan Builder, road trip itinerary, filters, places, roulette.
- **Recent**: recent searches and rerun actions.
- **Saved**: saved routes/plans.
- **AI Plans**: previously generated AI meetup plans.

Behavior:

- The panel can collapse to rail-only.
- Search/results state should survive panel collapse.
- Route/results content should not disappear unexpectedly after a search.
- Keep current feature gates and credit prompts intact.
- Keep ads in a predictable position that does not interrupt critical route input.

### Floating Route Control

Use a floating route/search-summary control over the map, but keep the language route-specific.

The control should support:

- Person A / start location.
- Person B / destination or second person.
- Add person for group midpoint.
- Swap.
- Travel mode.
- Midpoint mode.
- Split The Distance action.

Recommended states:

- **Empty state**: compact prompt to enter two locations.
- **Editing state**: expanded inputs, matching current `LocationInput` behavior.
- **Results state**: compact route summary such as `Alexandria -> Richmond`, with edit and rerun actions.

Important:

- Before credits, inputs must remain basic text boxes. Do not enable autocomplete/geocoding just because inputs move into a floating control.
- The paid split action remains the first point where route calculation should proceed.

### Floating Category Chips

Add horizontal chips near the top of the map after a midpoint/result exists.

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

- Chips should toggle the same state as `FilterChips`.
- Chips should only appear after a successful paid search.
- Chips should not trigger any new pre-payment Places calls.
- On desktop, chips can float at the top of the map, clear of Google controls.
- On mobile, chips should be inside the bottom sheet or pinned just above it.

### Map Workspace

Keep existing map capabilities:

- Route rendering.
- Alternative route selection.
- Midpoint pin.
- Person/location pins.
- Extra group pins.
- Place markers.
- Active marker/card coordination.
- Drift radius polygon.
- Road trip stop markers.
- Map/satellite toggle.
- Traffic toggle.

Improvements:

- Make active place marker/card coordination more obvious.
- Keep route options visible without overcrowding the map.
- Make the midpoint pin more informative, especially before places are selected.
- Preserve Google Maps attribution and controls.
- Avoid placing floating UI over map zoom, attribution, or traffic controls.

## Mobile Layout

Mobile should not copy the desktop rail literally.

Recommended mobile behavior:

- Full-width map as the background workspace.
- True bottom sheet for route input and results.
- Bottom sheet snap points:
  - **Collapsed**: route summary or "Enter two locations".
  - **Half**: inputs/results preview.
  - **Full**: full results list, filters, AI Plan Builder, and places.
- Horizontal chips inside the sheet or pinned just above it.
- Sticky primary action inside the sheet when inputs are complete.
- Keep the existing mobile map toggle behavior until the bottom sheet is stable.

Mobile navigation:

- Recent, saved, AI plans, and account can live in a compact sheet header menu.
- Avoid persistent vertical rail on phones.
- Ads must not block the split button, route summary, AI Plan Builder, or category chips.

## Feature Mapping

Current feature | New UI location
--- | ---
Location inputs | Floating route control / work panel / mobile bottom sheet
Split The Distance button | Route view primary action
Credits card | Route view near primary action; compact rail/account affordance
Recent searches | Planner rail + Recent panel view
Save plan | Results view near route summary
Saved routes/plans | Planner rail + Saved panel view
AI Plan Builder | Results view after save plan CTA and before places
Saved AI plans | Planner rail + AI Plans panel view
Filter chips | Floating map chips + Results view
Places list | Results panel / mobile bottom sheet
Route options | Results panel, collapsible
Drift radius | Results panel + map overlay
Road trip stops | Results panel + map overlays
Map/satellite/traffic | Stay as map controls
Account | Rail/account menu or existing account modal
Ads | Panel/sheet placement that avoids critical controls

## Suggested Component Strategy

Keep the first implementation conservative. The current app has a lot of state in `AppClient` and `SearchPanel`, so avoid a big-bang rewrite.

Recommended refactors before visual redesign:

- Extract route input controls from `SearchPanel` into a reusable `RoutePlannerControls` component.
- Extract credits summary into a reusable `CreditsSummaryCard`.
- Extract results sections into a reusable `ResultsPanelContent`.
- Extract filter chips into a presentation component that can render in-panel or floating.
- Keep `AppClient` as the state owner until the UI shell is stable.
- Keep `MapView` focused on map rendering and marker interactions, not panel state.

## Implementation Phases

### Phase 1: Prepare Components

- Extract reusable route controls from `SearchPanel`.
- Extract results content sections without changing behavior.
- Preserve existing analytics events.
- Verify paid gating and no-credit location lookup behavior still works.

### Phase 2: Planner Rail and Work Panel Shell

- Add the planner rail.
- Wrap the existing route/results content in a collapsible work panel.
- Keep all existing search/result behavior intact.
- Add panel open/collapse analytics.
- Do not add floating controls yet.

### Phase 3: Floating Route Control

- Add desktop floating route summary/edit control.
- Use extracted route controls.
- Keep the work panel as the expanded editing/results surface.
- Verify no autocomplete/geocoding runs before credits.

### Phase 4: Floating Category Chips

- Move or mirror category chips into a floating desktop row after paid results.
- Keep mobile chips inside the bottom sheet/work panel.
- Reuse existing filter state, place loading, and session event tracking.

### Phase 5: Recent, Saved, and AI Panel Views

- Add rail-driven panel views:
  - Recent
  - Saved
  - AI plans
- Reuse existing search history and AI plan APIs.
- Keep account modal for account deletion, billing, and credits unless moving those is explicitly scoped.

### Phase 6: Mobile Bottom Sheet

- Replace the current mobile collapse toggle with a true bottom sheet.
- Add snap points.
- Keep route inputs, results, filters, AI Plan Builder, places, and ads readable at each snap point.
- Test on small mobile heights.

### Phase 7: Polish and Measurement

- Track rail clicks, panel opens, panel collapses, chip usage, route edit opens, bottom-sheet snap usage, and AI plan interactions.
- Compare search completion, place clicks, AI plan generation, paid conversion, ad viewability, and API costs before/after.

## Measurement Plan

Track before and after:

- Visit to search attempt.
- Search attempt to paywall/pricing.
- Paid search completion.
- Places category selection rate.
- Place click rate.
- AI Plan Builder view to generation.
- AI plan generation to copy/share.
- Saved plan usage.
- Mobile split completion.
- Ad viewability and RPM.
- Google Maps, Geocoding, Places, Directions, and OpenAI costs per session.

## Risks

- Floating controls can overlap Google Maps controls, ads, or route markers.
- Moving inputs over the map can make the product feel less focused if the copy becomes generic.
- A rail can add complexity if too many destinations are exposed.
- Bottom sheets are easy to make awkward on short mobile screens.
- Any accidental autocomplete/geocoding before credits reopens the cost leak.
- AI Plan Builder can increase OpenAI spend if it becomes too prominent without usage controls.

## Open Decisions

- Should the planner rail be visible only after first interaction, or immediately on load?
- Should saved AI plans live in the work panel, account modal, or both?
- Should the floating route control replace the left panel route inputs on desktop, or simply summarize/edit them?
- Should ads remain in the panel, or should there be a separate map-safe ad placement?
- Should AI Plan Builder appear before or after category chips if no places are loaded yet?

