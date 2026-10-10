import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeCrowd, summarizeCrowd } from "./lib/crowd-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function json(name) { return JSON.parse(await readFile(resolve(root, "data", name), "utf8")); }
try {
  const [records, snapshot, summary, catalog] = await Promise.all([
    json("crowd.json"), json("crowd-source-snapshot.json"), json("crowd-coverage.json"), json("crowd-sources.json"),
  ]);
  assert.equal(snapshot.sources.length, catalog.sources.length, "Source catalog incomplete");
  assert.deepEqual(snapshot.sources.map(s => s.metricId).sort(), catalog.sources.map(s => s.metricId).sort(),
    "Source metrics are duplicated or missing");
  for (const source of snapshot.sources) {
    const configured = catalog.sources.find(s => s.metricId === source.metricId);
    assert.ok(configured, "Unexpected source metric");
    for (const key of ["name", "metricUrl", "csvUrl", "locationUrl", "locationScope"]) {
      assert.equal(source[key], configured[key], "Source catalog mismatch");
    }
    assert.match(source.metricTitle, /^Metric:\s*Pedestrian Counts? at /i, "Not a pedestrian metric");
  }
  assert.deepEqual(records, normalizeCrowd(snapshot), "Records differ from retained source rows/provenance/quality flags");
  assert.deepEqual(summary, summarizeCrowd(records), "Coverage summary is stale or altered");
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(`Crowd validation failed: ${error.message}`);
  process.exitCode = 1;
}
