# iSense

> Making campus navigation more inclusive by giving students with different
> sensory needs equal access to environmental information and personalized routes.

**Code Ada 2026 · Tech for Equity · 24-hour hackathon**

iSense is a mobile-first React PWA. A student picks a start and destination,
adjusts sliders for what matters to them (noise, crowds, shade, speed), and
iSense recommends a walking route — explaining *why* — then hands the key
waypoints to Google Maps for turn-by-turn navigation. Community reports update
environmental conditions so routes reflect what campus is actually like now.

## Core loop

Pick origin & destination → adjust sensory preferences → iSense recommends a
route and explains the trade-offs → community reports adjust route scores →
open the route in Google Maps via waypoints.

## Tech stack

| Area        | Tool                                   |
| ----------- | -------------------------------------- |
| UI          | React + Vite, mobile-first CSS         |
| PWA         | `vite-plugin-pwa`                      |
| Map         | Leaflet + OpenStreetMap                |
| Navigation  | Google Maps URLs (waypoints, no API key) |
| Backend     | Supabase (Postgres + RLS)              |
| Tests       | Vitest                                 |
| Deploy      | Vercel                                 |

Single language: **JavaScript**. No API keys required for the Google Maps hand-off.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment (for the Supabase features)
cp .env.example .env.local
#    then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Run the dev server
npm run dev

# 4. Run the tests
npm test
```

The app runs **without** Supabase configured — it falls back to the local demo
data in `src/data/`, so everyone can start immediately.

## Project structure

```
src/
  components/     UI (Person 1)      sliders, selectors, cards, map, report form
  algorithms/     Logic (Person 2/3) routeScoring.js, reportAggregation.js
  services/       Backend (Person 3) supabase.js, reports.js
  utils/          googleMaps.js      Google Maps URL builder (Person 2)
  data/           demo locations / routes / segments (clearly labeled)
tests/            Vitest unit tests
CONTRACT.md       shared data shapes & function signatures — READ THIS FIRST
DEMO.md           3-minute demo script & pitch outline
```

## Team & branches

| Person | Role                                   | Branch                |
| ------ | -------------------------------------- | --------------------- |
| 1      | Frontend & Mobile UI                   | `feature/mobile-ui`   |
| 2      | Routing algorithm & Google Maps        | `feature/routing`     |
| 3      | Data & backend (Supabase)              | `feature/backend`     |
| 4      | Integration, QA & presentation         | `feature/integration` |

`main` stays runnable at all times. Branch from latest `main`, open a PR, get
one review, merge, run `npm test`, everyone pulls. Integrate every ~2 hours.
See **[CONTRACT.md](./CONTRACT.md)** before writing any shared code.

## Data honesty

Environmental cost values in `src/data/` are **simulated demo values**, labeled
`"dataSource": "demo"`. We never present simulated numbers as real-time
measurements. Reports collect **no names and no diagnoses**.

## NoiseCapture raw observations (feature branch only)

Source: [NoiseCapture map](https://noise-planet.org/map_noisecapture/).
The verified local ZIP contains 97 one-second point measurements, 3 tracks and
1 aggregate area. Only Point features are imported; tracks and hexagons are not
turned into additional measurements. No national archive, paid API or network
request is needed. Use the existing importer from this branch's working directory:

```bash
npm run import:noise -- /absolute/path/to/extract_3682690c650446c38645ce98f8f3fb26_1791663251975.zip
npm run validate:noise
npm run validate:noise -- data/noise.json /absolute/path/to/extract_3682690c650446c38645ce98f8f3fb26_1791663251975.zip
npm run test:noise
```

These scripts use Node built-ins; ZIP import also requires `unzip`.
`data/noise.json` keeps the existing array schema: `id`, `latitude`, `longitude`,
`noiseDb` (original dB(A)), `noiseMetric`, `observedAt` (same instant in UTC),
`retrievedAt`, `sourceUrl`, and `sourceType`. Additional provenance fields are
`sourceId`, `sourceTrackId`, `observedAtOriginal`, `accuracyMeters`, `sourceArchive`
and `sourceFile`. See CONTRACT.md for the raw-data contract. The ZIP has no
per-point IDs, so the importer retains its stable SHA-256 fallback IDs while
preserving the original `pk_track` separately.

`data/noise-coverage.json` reports counts, time range, coordinate bounds, bounding
box dimensions, raw measurement range, and proximity to known route checkpoints.
Validation recomputes this summary and rejects stale summaries, empty data,
duplicate IDs, invalid coordinates, timestamps or measurements. Empty imports
fail before replacing existing data. Noise bounds are exactly the inclusive
point dataset bounds: south `40.115688874`, north `40.115738467`,
west `-88.221318189`, east `-88.221248583`. This is not a campus-wide bounding box.
The importer reports valid observations before and excluded by bounds; this
ZIP has 97 valid points and zero boundary exclusions. Optional ZIP validation
checks every original value, coordinate, timestamp, source ID, track ID, accuracy
and archive/member provenance against `points.geojson`, rejecting missing,
altered or additional records. The tree importer and tree data remain unchanged.

This dataset covers only approximately 5.9 × 5.5 meters, collected on March 13,
2026, 22:48–23:05 America/Chicago time. It is historical phone data, not current
conditions, not 97 independent locations, and insufficient for full-route scoring.
No points are within 50 meters of the known Main Quad/Grainger pins or candidate
waypoints. This is a checkpoint test, not a full path test: verified route geometry
is unavailable and full-route coverage remains unknown. No interpolation,
campus-wide assignment, dB(A)-to-0–100 conversion, or frontend integration is made.
NoiseCapture distributes this data under ODbL, with individual contents under
the Database Contents License; retain source attribution when redistributing.

## Historical pedestrian counts (feature branch only)

The official [UIUC iCAP pedestrian and bicycle project](https://icap.sustainability.illinois.edu/project/pedestrian-and-bicycle-counts)
publishes separate pedestrian metrics and CSV exports. This importer uses only
the four **pedestrian** metrics listed in `data/crowd-sources.json`: Main Quad
Gregory Hall, Main Quad Bevier Hall, Noyes Lab, and Illini Union. It never mixes
bicycle counts into pedestrian counts.

```bash
# Download the configured official monthly CSVs and published location markers.
npm run import:crowd
# Replay the retained, privacy-minimized source rows without any network calls.
npm run import:crowd -- --offline data/crowd-source-snapshot.json
npm run validate:crowd
npm run test:crowd
```

Node.js 18+ is required; the crowd scripts use built-in modules, so no package
installation or API key is needed. Import errors occur before existing outputs
are replaced. `data/crowd-source-snapshot.json` retains original value strings,
applicable date strings, annotations, source metric IDs, CSV hashes, row numbers,
retrieval time, and published marker coordinates. Affirming staff names are
intentionally omitted. The normalized `data/crowd.json` preserves these values
and provenance; `data/crowd-coverage.json` reports record/metric/location counts,
period range, raw count range, quality warnings, and target-checkpoint proximity.
Offline validation recomputes both records and coverage from the snapshot and
rejects altered values, provenance, coordinates, quality flags or stale summaries.

**These are monthly historical traffic counts, not live crowd density.** The
initial import contains 142 reports: 22 Gregory Hall, 23 Bevier Hall, 21 Noyes
Lab, and 76 Illini Union reports. Months run from March 2020 through July 2026.
Applicable dates are kept as dates, not invented timezone-aware instants or exact
measurement intervals. Some source dates are inside a month, and Bevier Hall has
two distinct February 2025 reports; both remain separate and must not be summed.
Missing months are not filled with zeros or interpolated.

Source annotations report counter malfunctions, battery problems, repairs, and
partial counter availability. Zero values are retained but flagged for review:
they do **not** prove a quiet or empty location. Equipment warnings can affect
later reports without repeated annotations; absence of an annotation does not
prove a repair or complete coverage.

Three single-counter sources have coordinates from official iCAP map markers,
not surveyed accuracy claims. Illini Union combines north/south counters, so its
76 reports intentionally have null single-point coordinates rather than being
assigned to one counter or an invented midpoint. The 50-meter checkpoint test
uses existing researched route pins/waypoints only, not an invented path.
Full-route coverage remains unknown. Every report is explicitly unsuitable for
live crowd scoring. No 0–100 crowd score, current occupancy estimate, frontend
integration, tree-pipeline change, or routing-algorithm change is made.

Keep university/source attribution. Public download availability alone does not
establish an open redistribution license; confirm the publisher's terms before
broader redistribution. No paid Maps, Routes, or Eco-Visio APIs are requested.
