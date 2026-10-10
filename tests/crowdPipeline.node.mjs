import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  parseCrowdCSV, sourceDate, verifyMetricHTML, publishedCoordinate,
  normalizeCrowd, validateCrowdRecords, summarizeCrowd,
} from "../scripts/lib/crowd-data.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = {
  version: 1, retrievedAt: "2026-10-10T20:00:00.000Z",
  sources: [{
    metricId: "9712", name: "Fixture", metricUrl: "https://icap.sustainability.illinois.edu/metric/pedestrian-counts-main-quad-gregory-hall",
    csvUrl: "https://icap.sustainability.illinois.edu/metric-export/9712", locationUrl: "https://icap.sustainability.illinois.edu/place/fixture",
    locationScope: "single_counter", latitude: 40.10534, longitude: -88.2282,
    measurementType: "pedestrian_count", granularity: "month", csvSha256: "a".repeat(64),
    rows: [{ sourceRowNumber: 2, originalValue: "0.00", originalDate: "3/31/2026", annotation: "Counter malfunctioning" }],
  }],
};

test("CSV preserves values/dates/multiline annotations while excluding staff names", () => {
  const rows = parseCrowdCSV('"Value","Applicable Date","Affirmed By","Annotation"\r\n"123.00","2/26/2025","Staff fixture","Counter ""offline""\r\nNeeds repair"\r\n');
  assert.deepEqual(rows, [{ sourceRowNumber: 2, originalValue: "123.00", originalDate: "2/26/2025", annotation: 'Counter "offline"\nNeeds repair' }]);
  assert.ok(!JSON.stringify(rows).includes("Staff fixture"));
  assert.throws(() => parseCrowdCSV('"Value","Applicable Date","Affirmed By","Annotation"\n'));
  assert.throws(() => parseCrowdCSV('"Value","Applicable Date","Affirmed By","Annotation"\n"123'));
  assert.throws(() => parseCrowdCSV('Value,Date\n1,2026-01'));
});

test("dates remain calendar dates and invalid dates fail without timezone invention", () => {
  assert.equal(sourceDate("2/29/2024"), "2024-02-29");
  assert.throws(() => sourceDate("2/29/2025"));
  const [r] = normalizeCrowd(fixture);
  assert.equal(r.reportedCount, 0);
  assert.equal(r.sourceDateOriginal, "3/31/2026");
  assert.equal(r.observedAt, null);
  assert.equal(r.usableForLiveCrowdScoring, false);
  assert.ok(r.qualityFlags.includes("zero_count_requires_review"));
  assert.ok(r.qualityFlags.includes("source_reported_equipment_warning"));
});

test("source checks reject bicycle metrics and retain marker coordinate order", () => {
  const html = '<h1>iCAP Portal</h1><h1>Metric: Pedestrian Counts at Fixture</h1>/metric-export/9712 /metric-topics/pedestrians Tracked by Month';
  assert.match(verifyMetricHTML(html, { metricId: "9712" }), /Pedestrian/);
  assert.throws(() => verifyMetricHTML(html.replace("Pedestrian", "Bicycle"), { metricId: "9712" }));
  assert.deepEqual(publishedCoordinate(".setLngLat([-88.228200, 40.105340])"), { latitude: 40.10534, longitude: -88.2282 });
  assert.throws(() => publishedCoordinate("center: [-88.2,40.1]"));
});

test("aggregate counts are never assigned to an individual marker or treated as a live score", () => {
  const input = structuredClone(fixture);
  input.sources[0].locationScope = "multiple_counters";
  input.sources[0].locationUrl = null;
  const records = normalizeCrowd(input);
  assert.equal(records[0].latitude, null);
  assert.equal(records[0].longitude, null);
  assert.equal(summarizeCrowd(records).locatedRecordCount, 0);
  assert.equal(summarizeCrowd(records).targetRoute.fullRouteCoverage, null);
  assert.throws(() => validateCrowdRecords([{ ...records[0], latitude: 40.1 }]));
  assert.throws(() => validateCrowdRecords([{ ...records[0], crowdScore: 0 }]));
});

test("multiple reports within a month retain their different values and cannot be summed as separate months", () => {
  const input = structuredClone(fixture);
  input.sources[0].rows = [
    { sourceRowNumber: 2, originalValue: "44018.00", originalDate: "2/26/2025", annotation: "" },
    { sourceRowNumber: 3, originalValue: "51306.00", originalDate: "2/28/2025", annotation: "" },
  ];
  const rows = normalizeCrowd(input);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id);
  assert.ok(rows.every(r => r.qualityFlags.includes("multiple_reports_for_month_do_not_sum")));
  assert.ok(rows[0].qualityFlags.includes("applicable_date_not_month_end"));
});

test("real source snapshot matches every normalized record and coverage summary offline", async () => {
  const load = async name => JSON.parse(await readFile(resolve(root, "data", name), "utf8"));
  const [snapshot, records, summary] = await Promise.all([
    load("crowd-source-snapshot.json"), load("crowd.json"), load("crowd-coverage.json"),
  ]);
  assert.deepEqual(records, normalizeCrowd(snapshot));
  assert.deepEqual(summary, summarizeCrowd(records));
  assert.equal(records.length, snapshot.sources.reduce((sum, source) => sum + source.rows.length, 0));
  assert.ok(records.every(r => r.measurementType === "pedestrian_count"));
});

test("offline replay is exact; invalid/empty import and tampering are detected without damaging saved data", async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), "isense-crowd-test-"));
  try {
    await cp(resolve(root, "scripts"), resolve(temporary, "scripts"), { recursive: true });
    await cp(resolve(root, "data"), resolve(temporary, "data"), { recursive: true });
    const file = resolve(temporary, "data/crowd.json"), before = await readFile(file);
    const run = (...args) => spawnSync(process.execPath, args, { cwd: temporary, encoding: "utf8" });
    assert.equal(run("scripts/import-crowd.mjs", "--offline", "data/crowd-source-snapshot.json").status, 0);
    assert.deepEqual(await readFile(file), before);
    await writeFile(resolve(temporary, "empty.json"), '{"version":1,"sources":[]}');
    assert.notEqual(run("scripts/import-crowd.mjs", "--offline", "empty.json").status, 0);
    assert.deepEqual(await readFile(file), before);
    const altered = JSON.parse(before);
    altered[0].reportedCount++;
    await writeFile(file, JSON.stringify(altered));
    assert.notEqual(run("scripts/validate-crowd.mjs").status, 0);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
