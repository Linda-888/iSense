/**
 * Recency-weighted report aggregation — Person 3's module (CONTRACT §6).
 *
 * weight_i = exp(-ageMinutes_i / halfLifeMinutes)
 * cost     = weighted average of the mapped levels, scaled 1–3 -> 0–100.
 *
 * Returns { cost: null, status: "unknown" } when there aren't enough usable
 * reports, so the UI can show "Unknown" instead of a fake number.
 *
 * NOTE: this is a starting implementation for Person 3 to extend (e.g. choosing
 * which level field feeds the cost). It is correct and tested as written.
 */

const LEVEL_TO_COST = { 1: 10, 2: 50, 3: 90 }; // 1–3 -> 0–100

/**
 * @param {Array} reports  Report[] with { noise_level|crowd_level, created_at }
 * @param {Object} opts
 * @param {number} [opts.halfLifeMinutes=20]  recency decay constant
 * @param {string} [opts.field="crowd_level"] which 1–3 field drives the cost
 * @param {number} [opts.now=Date.now()]      current time (ms), for testability
 * @returns {{cost:number|null, status:"ok"|"unknown", lastReportAt:string|null, sampleCount:number}}
 */
export function aggregateReports(reports, opts = {}) {
  const {
    halfLifeMinutes = 20,
    field = "crowd_level",
    now = Date.now(),
  } = opts;

  let weightedSum = 0;
  let weightTotal = 0;
  let lastReportAt = null;
  let sampleCount = 0;

  for (const r of reports) {
    const level = r[field];
    if (level == null || !(level in LEVEL_TO_COST)) continue;

    const t = new Date(r.created_at).getTime();
    if (Number.isNaN(t)) continue;

    const ageMinutes = (now - t) / 60000;
    if (ageMinutes < 0) continue; // ignore future timestamps

    const weight = Math.exp(-ageMinutes / halfLifeMinutes);
    weightedSum += weight * LEVEL_TO_COST[level];
    weightTotal += weight;
    sampleCount += 1;

    if (!lastReportAt || t > new Date(lastReportAt).getTime()) {
      lastReportAt = r.created_at;
    }
  }

  if (weightTotal === 0) {
    return { cost: null, status: "unknown", lastReportAt: null, sampleCount: 0 };
  }

  return {
    cost: Math.round(weightedSum / weightTotal),
    status: "ok",
    lastReportAt,
    sampleCount,
  };
}
