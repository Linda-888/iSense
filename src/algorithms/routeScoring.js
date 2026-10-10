/**
 * Route scoring — Person 2's module (CONTRACT §6).
 *
 * Score(r) is the preference-weighted average of a route's normalized costs.
 * Lower score = better fit for the user's current sliders. Routes slower than
 * (fastest + maxExtraMinutes) are dropped before scoring.
 */

/**
 * @param {Array} routes        Route[] (see CONTRACT §2)
 * @param {Object} preferences  Preferences (see CONTRACT §1)
 * @returns {Array} routes that pass the time filter, each with a numeric
 *                  `score` merged in, sorted best-first.
 */
export function recommendRoutes(routes, preferences) {
  if (!routes.length) return [];

  const fastest = Math.min(...routes.map((r) => r.durationMinutes));

  const weights = {
    noise: preferences.noise,
    crowd: preferences.crowd,
    shade: preferences.shade,
    time: preferences.speed,
  };

  const sum = Object.values(weights).reduce((a, b) => a + b, 0);

  return routes
    .filter(
      (r) => r.durationMinutes <= fastest + preferences.maxExtraMinutes
    )
    .map((r) => {
      // Time cost relative to the fastest candidate (MVP heuristic, 0–100).
      const timeCost = Math.min(100, (r.durationMinutes / fastest) * 50);

      const score =
        sum === 0
          ? timeCost
          : (weights.noise * r.noiseCost +
              weights.crowd * r.crowdCost +
              weights.shade * r.sunCost +
              weights.time * timeCost) /
            sum;

      return { ...r, score };
    })
    .sort(
      (a, b) => a.score - b.score || a.durationMinutes - b.durationMinutes
    );
}

/**
 * Builds a reason string from the route's actual dominant preferences and
 * costs — never a fixed canned compliment.
 * @param {Object} route        a scored Route
 * @param {Object} preferences  Preferences
 * @returns {string}
 */
export function explainRoute(route, preferences) {
  const factors = [
    { key: "shade", label: "shade", cost: route.sunCost, weight: preferences.shade },
    { key: "crowd", label: "avoiding crowds", cost: route.crowdCost, weight: preferences.crowd },
    { key: "noise", label: "a quieter path", cost: route.noiseCost, weight: preferences.noise },
  ];

  const top = factors
    .filter((f) => f.weight >= 50)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((f) => f.label);

  if (top.length === 0) {
    return `Recommended mainly for its ${route.durationMinutes}-minute walking time.`;
  }

  return `Recommended because you prioritize ${top.join(
    " and "
  )}. About ${route.durationMinutes} min walking.`;
}
