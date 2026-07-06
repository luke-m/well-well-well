# well-well-well — SPEC

## Audience
Urban walkers who want to refill a bottle or find drinkable water nearby. **North-star outcome:** *"I can find safe water near me."*

This shapes the rest of the doc. Where a decision helps urban refill, do it. Where it doesn't, defer.

## Wells policy
The canonical list of POI tags lives in `src/services/overpassService.ts` (single source of truth), not here on purpose: the catalog is loose and we want it to evolve as we discover which tags the urban-refill audience actually benefits from. SPEC.md just points at the code so changes don't drift.

Current query (see `fetchWells`):
- `amenity=drinking_water`
- `natural=spring`
- `man_made=water_well`

Extension is cheap — add lines, re-test — so we don't enumerate future tags here.

## Geometry
**Nodes only.** Ways / relations / multipolygons (lakes, reservoirs, rivers) are out of scope by decision, not by TODO. Fresh call today; if urban users start asking about lakes, revisit.

## Fetching
- Manual **"Search this area"** button. No auto-fetch on moveend.
- One fresh Overpass request per click. No in-memory cache. No IndexedDB.
- The basemap behaves like any normal OSM viewer (browser / HTTP cache only).
- Errors surface as an inline banner via `OverpassError`.

## Persistence
The only persisted state is `mapConfig` in `localStorage` = `{ center, zoom }`. No auth, no favorites, no history, no per-feature state, no analytics. Geolocation does NOT introduce any new persisted state — it only acts on the existing mapConfig lifecycle.

## Geolocation
- A "Center on me" pill sits above the "Search this area" pill in the top-center column.
- Opt-in per click: every click calls `navigator.geolocation.getCurrentPosition` afresh; the browser is allowed to re-prompt and we do not cache or remember the user's choice.
- No background tracking. No `watchPosition`. No polling.
- On success: a "you are here" marker (custom `divIcon`, deliberately distinct from the default Leaflet pin used by data markers) is rendered, the map is animated via `flyTo` to the user's coordinates at zoom 15, and `localStorage.mapConfig` is updated through the same `moveend` path as any other pan.
- Centering does NOT auto-fetch wells. The user still has to click "Search this area" to populate the map.
- The user marker auto-clears on user-initiated pan (`dragstart`) or zoom (`zoomstart`). The `zoomstart` event that the centering `flyTo` itself emits is suppressed so the marker doesn't disappear before the camera arrives.
- Failure modes (`PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, `TIMEOUT`, plus an `UNSUPPORTED` error when the API is missing) are surfaced as a typed `GeolocationError` (sibling to `OverpassError` in `src/utils/errors.ts`) and rendered through the existing inline error pill UI.

## UX
- One screen. Loader pill on top, error pill on top, action pills (Center on me, Search this area) below — all in a single top-center flex column so they never overlap.
- Popups show `name`, `man_made`, and a link back to `openstreetmap.org/node/{id}`.
- Mobile is a first-class viewport (responsive container, touch panning via Leaflet defaults).

## Stack (locked)
React 19 · Vite 8 · TypeScript · react-leaflet 5 · Leaflet 1.9 · Tailwind 4 · lucide-react · Vitest + @testing-library + jsdom.

## Out of scope (today)
- Offline tiles / service worker
- Routing to the nearest source
- Alternative tile providers
- Polygon water bodies
- Any caching layer
- Accounts, favorites, history

## Possible next steps (open — not commitments)
- **POP-catalog growth:** fold in `amenity=water_point`, `amenity=bottle_refill`, and `natural=water` (point-only) if urban data justifies them.
- **"Safe" cues in popups:** show `drinking_water:legal`, `drinking_water:bottle`, `seasonal`, and `access` tags so users can self-filter before we attempt anything like real verification.
- **Tile-provider escape hatch:** document (don't yet build) how we'd swap to e.g. Stadia or a self-hosted tile server if the OSM CDN becomes a concern.
