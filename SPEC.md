# SPEC: well-well-well

> Locked-in design contract. Edit only when an in-scope decision changes.
> Sources: feature-grilling session, followed by this document.

## Implementation status

- **Shipped:** map viewer, "Search this area" bounding-box refresh, `mapConfig` localStorage persistence, OSM popup node links, wells / fountains / springs Overpass query (unfiltered).
- **Pending (in scope, not yet built):** Find nearest — one-shot geolocation, Haversine ranking, ranked side list, in-panel disclaimer, fly-to on row select. This is the next implementation; the contract in this document is the source of truth.

## Target user (v1)

- **Urban refillers** carrying reusable bottles, looking for the nearest free tap in a city.
- **Day hikers** in cell-signal range needing to refill mid-route.

**Explicitly out of audience for v1:** multi-day backcountry hikers in signal-dead terrain. If the user is six hours deep in a canyon with no bars and an empty canteen, this app is the wrong tool. That's an offline app, not this app. Re-introducing backcountry is a future revision, gated first on offline PWA work.

## Product scope

- Frontend-only. No backend, no auth, no user accounts.
- Persisted state lives in `localStorage` only (`mapConfig` for center and zoom; new keys inherit the same constraint).
- One screen, one map.
- "Niche serious tool" — polish and reliability over breadth. Not a public-launch startup.

## In-scope decisions

### Wells policy: show all wells unchanged

The Overpass query returns every `man_made=water_well` node, regardless of `access`, `potability`, or property status. We deliberately do not filter on `access=yes` or `drinking_water=yes`.

Reasons:

- OSM tag coverage for those keys is too sparse globally to make a filter honest.
- Filtering empties the map in regions where wells are the dominant water source.
- Future-you may be tempted to "fix" this with a smart rule. Resist unless a curated source of truth is also introduced.

**Known liability:** agricultural wells, capped private pipes, contaminated village wells all surface on the map. The README links each marker back to its OSM node for verification. We accept this rather than hide data we don't understand.

### Find-nearest: Haversine straight-line distance

Rank POIs by great-circle distance from the user's coordinates.

- Free, deterministic, runs entirely client-side.
- Correct in flat cities. Wrong in mountains — a spring could be 800 m linear, 4 km overland.
- Real terrain-aware routing needs OSRM/GraphHopper and paid infra — explicitly rejected for v1.

**Disclaimer is required.** The "as the crow flies — actual trail distance can be longer, especially with elevation" caveat must be visible alongside any ranked list. Not in fine print, not behind a help icon, not in a tooltip. It must be in the same panel the user reads distances in.

### Geolocation: one-shot only

Use the browser Geolocation API as a single `getCurrentPosition` call on user request.

- No `watchPosition`. Battery cost on a long trip would halve phone life.
- No continuous tracking. The user asked "where is water near me right now?" — answer that, then stop.
- Permission prompt must say: why we want the location, what we do with the coordinate, and that we do not store it.

## In-scope feature: v1 top pick — Find nearest

> **Status:** Pending implementation. Contract locked in this section; not yet shipped.

- "Locate me" affordance in the existing overlay UI.
- On activation, request one-shot geolocation.
- Compute Haversine distance from the user's coordinate to every POI in the current Overpass results.
- Side list, ranked nearest-first, with metric readout.
- Disclaimer text in the same panel.
- Selecting a row flies the map to that POI and opens its popup.

Driven by the chosen audience and uses data we already have. This is the most actionable thing v1 can ship.

## Out of scope (deferred)

Considered and explicitly rejected for v1, with reason. Re-introduction passes through the same grill.

| Feature                          | Why deferred                                                                |
| -------------------------------- | --------------------------------------------------------------------------- |
| Polygon support (ways/relations) | No driving feature needs it. Client-side way decoding is heavy.             |
| Offline PWA / tile caching       | Required only if the backcountry audience returns. Safari eviction makes offline a brittle promise today. |
| Treatment-required symbology     | We cannot honestly assert "safe to drink" without verification. Visual cues imply liability we don't have data for. |
| Data freshness / edit-date badges | Edit timestamps correlate poorly with data quality. Risk of misleading users. |
| Trail / overland routing         | Needs OSRM or GraphHopper backend. Breaks "no backend" rule.                |
| User accounts / community features | GDPR, password recovery, moderation. Out of scope for "niche serious tool." |
| Continuous GPS tracking          | Battery. One-shot is sufficient for v1 queries.                              |
| GPX / KML export                 | Garmin / Coros users already pull this from Gaia or CalTopo.                |

## Known risks worth revisiting

- **OSM is good enough.** If major audience regions have missing or stale data, the map looks empty. Data-freshness badges are parked, not cancelled.
- **"Show all wells" never produces a complaint.** Acceptable for a hobby project; reassess if usage grows beyond personal scale.
- **Browser geolocation is reliable enough.** In cities, yes. In canyons, no. The disclaimer should mention this if audience ever expands back toward backcountry.
## Decision log

- **Pivot target away from backcountry hikers for v1.** Backcountry re-entry depends on offline PWA — deferred until that is rescoped.
- **Drop polygon support from v1.** No feature unblocked it; cost was real.
- **Pick find-nearest as v1 top feature.** Most actionable for chosen audience, uses existing Overpass data, no backend required.
- **Keep Haversine with visible disclaimer, not routing.** Free, honest under a clearer UI contract.
- **One-shot GPS, not continuous.** Battery dominates the trade-off for the target audience.
