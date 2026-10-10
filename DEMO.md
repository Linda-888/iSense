# iSense — 3-Minute Demo Script & Pitch

Owner: **Person 4**. Goal: one clean, reliable end-to-end story. Rehearse the
exact tap path below; do not improvise new clicks on stage.

## The one scenario we demo

A student at **Main Quad** needs to get to the **Grainger Engineering Library**.
They are sensitive to crowds and sun. iSense recommends the **Shaded & Quiet
Route** over the fastest one, explains why, shows a live-ish community report
changing the picture, and hands off to Google Maps.

## Minute-by-minute (target 3:00)

| Time      | What happens on screen                                             | Speaker  |
| --------- | ----------------------------------------------------------------- | -------- |
| 0:00–0:30 | **Problem.** Maps optimize for speed, not sensory load. Who this helps: neurodivergent & sensory-sensitive students. | Person 4 |
| 0:30–1:20 | **Live app.** Pick Main Quad → Grainger. Drag *Avoid crowds* and *Prefer shade* up. Route recommendation changes; read the reason text aloud. | Person 1 |
| 1:20–1:50 | **How it works.** Show the weighted scoring idea; same preferences + different weights → different best route. | Person 2 |
| 1:50–2:20 | **Community reports.** Submit a "high crowd" report; refresh; the affected route's score updates. | Person 3 |
| 2:20–2:45 | **Navigation hand-off.** Tap *Navigate with Google Maps* on a phone; show it opens walking directions with the waypoints. | Person 2 |
| 2:45–3:00 | **Equity impact & future.** Accessibility framing, honest limitations, campus expansion. | Person 4 |

## Pre-demo checklist (Person 4 runs this 30 min before)

- [ ] Vercel production URL loads on a real phone (not just laptop).
- [ ] The exact demo tap path works twice in a row.
- [ ] Google Maps hand-off tested on the actual demo phone (iOS **and** Android if possible).
- [ ] A backup screen recording exists in case live network fails.
- [ ] Demo data is seeded so a report visibly changes a route score.
- [ ] No console errors; no secret keys in the deployed bundle.

## Fallback plan

If the Google Maps hand-off misbehaves on the venue network, show the route on
the **in-app Leaflet map** (our source of truth) and play the backup recording
of the Google Maps step.

## Pitch slides (6)

1. **Problem** — existing maps overlook individual sensory needs.
2. **Target users** — neurodivergent & sensory-sensitive students.
3. **Solution** — iSense and its mobile interface.
4. **How it works** — preferences + community reports + route scoring.
5. **Live demo** — route recommendation and Google Maps hand-off.
6. **Impact & future** — accessibility, honest limitations, campus expansion.

Claim only what we actually built: real route scoring + a working Google Maps
hand-off. Don't claim any competitor "lacks" a feature as unverified fact.
