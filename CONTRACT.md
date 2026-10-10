# CONTRACT.md — iSense Shared Interfaces

> **iSense** — making campus navigation more inclusive by giving students with
> different sensory needs equal access to environmental information and
> personalized routes.

**This file is the single source of truth for data shapes and function signatures.**
Everyone codes against these. Do **not** rename shared fields or change a
function's inputs/outputs without announcing it to the team and updating this
file in the same PR. If a field name here and in code disagree, the code is wrong.

Owner of this file: **Person 4 (Integration & QA)**. Last updated: 2026-10-10.

---

## 0. Conventions

- **Language:** JavaScript (ES modules). No TypeScript, no Python for the MVP.
- **Cost scale:** all environmental costs (`noiseCost`, `crowdCost`, `sunCost`)
  are numbers **0–100**. **Higher = worse** (more noise / more crowds / more sun exposure).
- **Preference sliders:** all are **0–100**. Higher = "I care about avoiding this more."
- **Report levels:** `noise_level`, `crowd_level`, `seat_availability` are integers **1–3**
  (1 = low, 3 = high). Aggregation maps these to the 0–100 cost scale.
- **Coordinates:** `{ lat: number, lng: number }`. Polylines for drawing are
  `[[lat, lng], ...]`. Always real, verified road coordinates in committed data —
  never random placeholders (placeholders are only allowed inside `*.example` notes).
- **Data honesty:** every route/location carries a `dataSource` tag so we never
  present simulated numbers as real measurements. Allowed values:
  `"verified"` (real geo/official data), `"demo"` (simulated cost for the hackathon),
  `"community"` (derived from user reports).

---

## 1. Preferences object  — owned by Person 1, consumed by Person 2

```js
{
  noise: 80,          // 0–100, higher = avoid noise more
  crowd: 70,          // 0–100, higher = avoid crowds more
  shade: 90,          // 0–100, higher = prefer shade / avoid sun more
  speed: 30,          // 0–100, higher = prioritize shorter time
  maxExtraMinutes: 5  // hard cap: routes slower than (fastest + this) are dropped
}
```

---

## 2. Route object  — owned by Person 2, drawn by Person 1

```js
{
  id: "route-a",
  name: "Shaded Route",
  originId: "main-quad",          // -> Location.id
  destinationId: "grainger",      // -> Location.id

  durationMinutes: 8,

  // Environmental costs, 0–100, higher = worse. "demo" values until real.
  noiseCost: 20,
  crowdCost: 35,
  sunCost: 15,

  // Polyline for drawing on the in-app Leaflet map: [[lat, lng], ...]
  coordinates: [
    [40.1072, -88.2272],
    [40.1049, -88.2272]
  ],

  // Coordinate objects used to hand off to Google Maps.
  origin:      { lat: 40.1072, lng: -88.2272 },
  destination: { lat: 40.1049, lng: -88.2272 },
  waypoints: [                    // 1–3 verified points that steer Google Maps
    { lat: 40.1060, lng: -88.2272 }
  ],

  // Outdoor segment IDs this route uses. Community reports on these segments
  // update the route's effective cost. Indoor reports never touch these.
  outdoorSegmentIds: ["segment-1", "segment-2"],

  dataSource: "demo"              // "verified" | "demo" | "community"
}
```

A route returned by `recommendRoutes()` additionally gets a computed
`score` (number, lower = better fit) merged in.

---

## 3. Location object  — owned by Person 3 (Supabase `locations` table)

```js
{
  id: "grainger",            // text, stable slug
  name: "Grainger Engineering Library",
  latitude: 40.1125,
  longitude: -88.2268,
  type: "indoor",            // "indoor" | "outdoor"
  source_url: "https://..."  // official data source for this location
}
```

## 4. Report object  — owned by Person 3 (Supabase `reports` table)

Submitted shape (camelCase in app code; `submitReport` maps to snake_case columns):

```js
{
  locationId: "grainger",    // required -> Location.id
  segmentId: "segment-1",    // optional -> outdoor segment; null for indoor
  type: "outdoor",           // "indoor" | "outdoor"
  noise: 2,                  // 1–3
  crowd: 3,                  // 1–3
  seats: 1                   // 1–3, indoor only; null otherwise
}
```

Stored columns: `id (uuid)`, `location_id`, `segment_id`, `report_type`,
`noise_level`, `crowd_level`, `seat_availability`, `created_at (timestamp)`.
**No names, no diagnoses, no personal data is ever collected.**

## 5. Segment object  — owned by Person 2 / Person 3 (`src/data/segments.json`)

```js
{
  id: "segment-1",
  name: "Wright St sidewalk (Green to Springfield)",
  coordinates: [[40.1101, -88.2272], [40.1125, -88.2272]],
  baseNoiseCost: 30,   // 0–100 fallback used when no recent reports exist
  baseCrowdCost: 40,
  baseSunCost: 55,
  dataSource: "demo"
}
```

---

## 6. Function signatures (the integration contract)

> These names and shapes are frozen. Implement the body; don't change the door.

### Person 2 — `src/algorithms/routeScoring.js`
```js
// Returns routes that pass the maxExtraMinutes filter, each with a numeric
// `score` (lower = better), sorted best-first.
export function recommendRoutes(routes /* Route[] */, preferences /* Preferences */) /* Route[] */

// Human-readable reason string for why a route was recommended, based on the
// actual dominant preferences and this route's actual costs.
export function explainRoute(route /* scored Route */, preferences /* Preferences */) /* string */
```

### Person 2 — `src/utils/googleMaps.js`
```js
// Builds a Google Maps URL (no API key) with origin, destination, walking mode,
// and up to 3 waypoints. Caller passes a Route (needs .origin/.destination/.waypoints).
export function buildGoogleMapsURL(route /* Route */) /* string */
```

### Person 3 — `src/services/reports.js`
```js
export async function getLocations(supabase) /* Promise<Location[]> */
export async function getReports(supabase, locationId /* optional */) /* Promise<Report[]> */
export async function submitReport(supabase, report /* Report */) /* Promise<void> */
```

### Person 3 — `src/algorithms/reportAggregation.js`
```js
// Recency-weighted average of report levels for one location/segment.
// weight_i = exp(-ageMinutes_i / halfLifeMinutes). Returns a 0–100 cost plus
// metadata, or { cost: null, status: "unknown" } when there is not enough data.
export function aggregateReports(reports /* Report[] */, { halfLifeMinutes = 20 } = {})
/* { cost: number|null, status: "ok"|"unknown", lastReportAt, sampleCount } */
```

---

## 7. Git branch map

| Branch                 | Owner    | Touches                          |
| ---------------------- | -------- | -------------------------------- |
| `main`                 | Person 4 | stable, always runnable          |
| `feature/mobile-ui`    | Person 1 | `components/`, CSS, PWA UI        |
| `feature/routing`      | Person 2 | `algorithms/routeScoring`, `utils/googleMaps` |
| `feature/backend`      | Person 3 | `services/`, `algorithms/reportAggregation`, Supabase |
| `feature/integration`  | Person 4 | tests, wiring, deploy             |

**Flow:** branch from latest `main` → build → PR → one teammate reviews → merge →
run `npm test` → everyone pulls. Integrate at least every ~2 hours; never wait
until hour 12 for the first merge.
