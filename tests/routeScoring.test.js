import { describe, it, expect } from "vitest";
import { recommendRoutes, explainRoute } from "../src/algorithms/routeScoring.js";

const routes = [
  {
    id: "fast",
    name: "Fast",
    durationMinutes: 7,
    noiseCost: 45,
    crowdCost: 55,
    sunCost: 65,
  },
  {
    id: "shaded",
    name: "Shaded",
    durationMinutes: 9,
    noiseCost: 25,
    crowdCost: 20,
    sunCost: 15,
  },
];

describe("recommendRoutes", () => {
  it("returns [] for no routes", () => {
    expect(recommendRoutes([], { noise: 50, crowd: 50, shade: 50, speed: 50, maxExtraMinutes: 5 })).toEqual([]);
  });

  it("drops routes beyond fastest + maxExtraMinutes", () => {
    const prefs = { noise: 50, crowd: 50, shade: 50, speed: 50, maxExtraMinutes: 1 };
    const result = recommendRoutes(routes, prefs);
    // fastest is 7, +1 = 8, so the 9-min shaded route is excluded.
    expect(result.map((r) => r.id)).toEqual(["fast"]);
  });

  it("prefers the shaded route when shade is weighted highly", () => {
    const prefs = { noise: 10, crowd: 10, shade: 100, speed: 10, maxExtraMinutes: 5 };
    const result = recommendRoutes(routes, prefs);
    expect(result[0].id).toBe("shaded");
  });

  it("prefers the fast route when speed dominates", () => {
    const prefs = { noise: 10, crowd: 10, shade: 10, speed: 100, maxExtraMinutes: 5 };
    const result = recommendRoutes(routes, prefs);
    expect(result[0].id).toBe("fast");
  });

  it("merges a numeric score into every returned route", () => {
    const prefs = { noise: 50, crowd: 50, shade: 50, speed: 50, maxExtraMinutes: 5 };
    for (const r of recommendRoutes(routes, prefs)) {
      expect(typeof r.score).toBe("number");
    }
  });
});

describe("explainRoute", () => {
  it("mentions the dominant preference", () => {
    const prefs = { noise: 10, crowd: 10, shade: 90, speed: 10, maxExtraMinutes: 5 };
    expect(explainRoute(routes[1], prefs).toLowerCase()).toContain("shade");
  });

  it("falls back to time when no preference is strong", () => {
    const prefs = { noise: 10, crowd: 10, shade: 10, speed: 10, maxExtraMinutes: 5 };
    expect(explainRoute(routes[0], prefs)).toMatch(/walking time/i);
  });
});
