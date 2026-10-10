import test from "node:test";
import assert from "node:assert/strict";
import { summarizeNoise, validateNoiseRecords, isIndividualNoisePoint, NOISE_IMPORT_BOUNDS } from "../scripts/lib/noise-data.mjs";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const point = {
  id: "sample-1", latitude: 40.115738467, longitude: -88.221248583,
  noiseDb: 39.224182, noiseMetric: "LAeq",
  observedAt: "2026-03-14T03:48:09.000Z",
  observedAtOriginal: "2026-03-13T22:48:09-05:00",
  retrievedAt: "2026-10-10T20:00:00.000Z",
  sourceType: "NoiseCapture", sourceUrl: "https://noise-planet.org/map_noisecapture/",
  sourceId: null, sourceTrackId: "699208", accuracyMeters: 0.5886118,
};

test("exact dataset bounds retain boundary points without changing raw units", () => {
  validateNoiseRecords([point]);
  for (const latitude of [NOISE_IMPORT_BOUNDS.south, NOISE_IMPORT_BOUNDS.north]) {
    for (const longitude of [NOISE_IMPORT_BOUNDS.west, NOISE_IMPORT_BOUNDS.east]) {
      validateNoiseRecords([{ ...point, latitude, longitude }]);
    }
  }
  const result = summarizeNoise([point]);
  assert.equal(result.measurement.minimum, 39.224182);
  assert.equal(result.measurement.unit, "dB(A)");
  assert.equal(result.timeRange.startLocal, "2026-03-13T22:48:09");
  assert.equal(point.observedAtOriginal, "2026-03-13T22:48:09-05:00");
});

test("footprint, times, track count and checkpoint limitation are explicit", () => {
  const result = summarizeNoise([point, {
    ...point, id: "sample-2", latitude: 40.115688874, longitude: -88.221318189,
    observedAt: "2026-03-14T04:05:31.000Z", sourceTrackId: "699209", noiseDb: 71.38826,
  }]);
  assert.equal(result.recordCount, 2);
  assert.equal(result.trackCount, 2);
  assert.ok(result.footprintMeters.width > 5 && result.footprintMeters.width < 7);
  assert.ok(result.footprintMeters.height > 5 && result.footprintMeters.height < 7);
  assert.equal(result.timeRange.endLocal, "2026-03-13T23:05:31");
  assert.equal(result.targetRoute.anyPointsNearKnownCheckpoints, false);
  assert.ok(result.targetRoute.minimumDistanceToKnownCheckpointsMeters > 500);
  assert.equal(result.targetRoute.fullRouteCoverage, null);
  assert.equal(result.targetRoute.sufficientForFullRouteScoring, false);
});

test("dataset window is not widened to encompass route endpoints or nearby unmeasured locations", () => {
  for (const patch of [
    { latitude: 40.1124997, longitude: -88.2269172 },
    { latitude: NOISE_IMPORT_BOUNDS.south - 0.000000001 },
    { latitude: NOISE_IMPORT_BOUNDS.north + 0.000000001 },
    { longitude: NOISE_IMPORT_BOUNDS.west - 0.000000001 },
    { longitude: NOISE_IMPORT_BOUNDS.east + 0.000000001 },
  ]) assert.throws(() => validateNoiseRecords([{ ...point, ...patch }]), /outside import bounds/);
});

test("invalid raw observations fail validation", () => {
  for (const patch of [
    { latitude: 90.1 }, { longitude: -100 }, { noiseDb: NaN },
    { observedAt: "not-a-date" }, { observedAt: "2026-03-14T03:48:09" },
    { sourceType: "demo" }, { sourceUrl: "" }, { accuracyMeters: -1 },
  ]) assert.throws(() => validateNoiseRecords([{ ...point, ...patch }]));
  assert.throws(() => validateNoiseRecords([point, point]), /duplicate ID/);
  assert.throws(() => validateNoiseRecords([]), /non-empty/);
});

test("stationary Point tracks and aggregate regions are not individual measurements", () => {
  const feature = {
    type: "Feature", geometry: { type: "Point", coordinates: [-88.22125, 40.11573, 198] },
    properties: { noise_level: 39.2, time_ISO8601: point.observedAtOriginal },
  };
  assert.equal(isIndividualNoisePoint(feature, "points.geojson"), true);
  assert.equal(isIndividualNoisePoint(feature, "tracks.geojson"), false);
  assert.equal(isIndividualNoisePoint(feature, "export/areas.geojson"), false);
  assert.equal(isIndividualNoisePoint({
    ...feature, properties: { ...feature.properties, time_length: 1, track_uuid: "stationary" },
  }), false);
  assert.equal(isIndividualNoisePoint({
    ...feature, properties: { ...feature.properties, measure_count: 97 },
  }), false);
});

test("empty and truncated imports fail without erasing the saved data", async () => {
  const importer = fileURLToPath(new URL("../scripts/import-noise.mjs", import.meta.url));
  const data = fileURLToPath(new URL("../data/noise.json", import.meta.url));
  const coverage = fileURLToPath(new URL("../data/noise-coverage.json", import.meta.url));
  const before = await readFile(data);
  const beforeCoverage = await readFile(coverage);
  const directory = await mkdtemp(resolve(tmpdir(), "noise-import-test-"));
  try {
    for (const text of [
      '{"type":"FeatureCollection","features":[]}',
      '{"type":"FeatureCollection","features":[{"type":"Feature"',
    ]) {
      const input = resolve(directory, "invalid.geojson");
      await writeFile(input, text);
      const result = spawnSync(process.execPath, [importer, input], { encoding: "utf8" });
      assert.equal(result.status, 1);
      assert.deepEqual(await readFile(data), before);
      assert.deepEqual(await readFile(coverage), beforeCoverage);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
