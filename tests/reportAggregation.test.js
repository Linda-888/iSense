import { describe, it, expect } from "vitest";
import { aggregateReports } from "../src/algorithms/reportAggregation.js";

const NOW = new Date("2026-10-10T12:00:00Z").getTime();
const minsAgo = (m) => new Date(NOW - m * 60000).toISOString();

describe("aggregateReports", () => {
  it("returns unknown when there are no reports", () => {
    const r = aggregateReports([], { now: NOW });
    expect(r.status).toBe("unknown");
    expect(r.cost).toBeNull();
  });

  it("weights recent reports more than old ones", () => {
    const recentHigh = aggregateReports(
      [
        { crowd_level: 3, created_at: minsAgo(1) },
        { crowd_level: 1, created_at: minsAgo(120) },
      ],
      { now: NOW }
    );
    // Recent "high" should dominate -> cost closer to 90 than 10.
    expect(recentHigh.cost).toBeGreaterThan(60);
  });

  it("ignores future timestamps", () => {
    const r = aggregateReports(
      [{ crowd_level: 3, created_at: new Date(NOW + 60000).toISOString() }],
      { now: NOW }
    );
    expect(r.status).toBe("unknown");
  });

  it("reports sampleCount and lastReportAt", () => {
    const r = aggregateReports(
      [
        { crowd_level: 2, created_at: minsAgo(5) },
        { crowd_level: 3, created_at: minsAgo(2) },
      ],
      { now: NOW }
    );
    expect(r.sampleCount).toBe(2);
    expect(r.lastReportAt).toBe(minsAgo(2));
  });
});
