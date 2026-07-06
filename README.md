# well-well-well

A small React + Vite app that shows an interactive OpenStreetMap and surfaces nearby water-related points of interest (drinking water fountains, natural springs, water wells) by querying the [Overpass API](https://overpass-api.de/) for whatever region is currently visible on the map.

## Stack

- [React 19](https://react.dev) + [Vite 8](https://vite.dev) + TypeScript
- [react-leaflet 5](https://react-leaflet.js.org) on [Leaflet 1.9](https://leafletjs.com)
- [Tailwind CSS 4](https://tailwindcss.com) (via `@tailwindcss/vite`)
- [lucide-react](https://lucide.dev) for icons
- [Vitest](https://vitest.dev) + [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/) for tests

## Getting started

```bash
npm install
npm run dev       # start the dev server (http://localhost:5173)
```

## Scripts

| Script              | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with HMR                 |
| `npm run build`     | Produce a production build into `dist/`            |
| `npm run preview`   | Preview the production build locally               |
| `npm run lint`      | Run ESLint                                          |
| `npm test`          | Run the Vitest test suite (one-shot)               |

## How it works

- `src/components/WellMap.tsx` — the only screen. Renders a Leaflet map, an OSM tile layer, and a GeoJSON overlay for the current results.
- `src/services/overpassService.ts` — builds an Overpass QL query for the current bounding box and converts the response into a GeoJSON `FeatureCollection`.
- A **"Search this area"** button triggers a fresh fetch for the visible bounds. The map's center and zoom are persisted to `localStorage` under the key `mapConfig` and restored on the next load. Clear site data to reset to the default view.
- A **"Center on me"** button triggers a one-shot `navigator.geolocation` request and animates the camera to the user's coordinates, with a small "you are here" marker that auto-clears the moment they pan or zoom away. Permission is re-requested on every click — no grants are remembered and no coordinates are stored beyond the standard `mapConfig` lifecycle. Centering does not auto-fetch wells; the user still clicks "Search this area" afterwards.
- Errors from Overpass are surfaced as `OverpassError`; the UI displays them in an inline banner. Geolocation errors (denied / unavailable / timeout) share the same inline banner via a sibling `GeolocationError`.

## Attribution

Map tiles © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). POI data from OpenStreetMap via the Overpass API.

## Reset

If the map ever lands in a weird state, clear your browser's site data for this app — the only persisted state is the `mapConfig` key in `localStorage`.
