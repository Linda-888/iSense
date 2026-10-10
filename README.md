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
