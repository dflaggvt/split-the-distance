# Split The Distance — Meet in the Middle

Find the perfect meeting point between two locations based on actual drive time. Discover restaurants, cafes, parks, and more at the midpoint.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS v4** for styling
- **Leaflet** via `react-leaflet` for interactive maps
- **Free APIs**: OSRM (routing), Nominatim (geocoding), Overpass (POI search)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **Drive-time midpoint**: Calculates the true halfway point along the actual driving route (not just geographic center)
- **Place discovery**: Restaurants, cafes, parks, activities, gas stations, hotels, and kid-friendly spots near the midpoint
- **Category filters**: Toggle what types of places you want to see
- **Shareable links**: Share your split with `?from=CityA&to=CityB` URL params
- **Autocomplete**: Real-time location search powered by Nominatim
- **Responsive**: Full mobile support with stacked layout
- **SEO optimized**: Server-side metadata with Open Graph tags

## Architecture

```
app/
├── layout.js          Root layout with Inter font + metadata
├── page.js            Server component → renders AppClient
├── globals.css        Tailwind v4 + custom styles

components/
├── AppClient.js       Main client component (state management)
├── SearchPanel.js     Left sidebar with inputs & results
├── LocationInput.js   Autocomplete input component
├── MapView.js         Leaflet map (dynamic import, ssr:false)
├── RouteInfo.js       Route summary + share button
├── FilterChips.js     Category filter pills
├── PlaceCard.js       Individual POI result card
├── PlacesList.js      Scrollable results list
└── HowItWorks.js      How It Works section

lib/
├── geocoding.js       Nominatim API with rate limiting
├── routing.js         OSRM routing + drive-time midpoint
├── places.js          Overpass API POI search
└── utils.js           Shared utilities
```

## Build

```bash
npm run build
npm run start
```
