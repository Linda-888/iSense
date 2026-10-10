import { readFile } from "node:fs/promises";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { summarizeNoise, isIndividualNoisePoint, NOISE_IMPORT_BOUNDS } from "./lib/noise-data.mjs";

const execFileAsync = promisify(execFile);

// Optional source audit for the verified small export. Never downloads data.
async function auditSource(records, zipPath) {
  const { stdout } = await execFileAsync("unzip", ["-p", zipPath, "points.geojson"], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  });
  const source = JSON.parse(stdout);
  if (source.type !== "FeatureCollection" || !Array.isArray(source.features)) {
    throw new Error("ZIP points.geojson must be a FeatureCollection.");
  }
  const expectedIds = new Set();
  const actual = new Map(records.map(r => [r.id, r]));
  let validPoints = 0, outsideBounds = 0;
  for (const feature of source.features) {
    if (!isIndividualNoisePoint(feature, "points.geojson")) continue;
    const p = feature.properties;
    if (!Number.isFinite(p?.noise_level) || typeof p.time_ISO8601 !== "string" ||
        !Number.isFinite(Date.parse(p.time_ISO8601))) continue;
    validPoints += 1;
    const [longitude, latitude] = feature.geometry.coordinates;
    if (latitude < NOISE_IMPORT_BOUNDS.south || latitude > NOISE_IMPORT_BOUNDS.north ||
        longitude < NOISE_IMPORT_BOUNDS.west || longitude > NOISE_IMPORT_BOUNDS.east) outsideBounds += 1;
    const sourceId = feature.id != null ? String(feature.id) :
      p.leq_id != null ? String(p.leq_id) : null;
    const id = sourceId ?? createHash("sha256")
      .update(`points.geojson\0${JSON.stringify(feature)}`).digest("hex");
    if (expectedIds.has(id)) throw new Error("Duplicate measurement IDs in source ZIP.");
    expectedIds.add(id);
    const r = actual.get(id);
    if (!r || r.sourceId !== sourceId || r.latitude !== latitude || r.longitude !== longitude ||
        r.noiseDb !== p.noise_level || r.noiseMetric !== "LAeq" ||
        r.observedAt !== new Date(p.time_ISO8601).toISOString() ||
        r.observedAtOriginal !== p.time_ISO8601 ||
        r.sourceTrackId !== (p.pk_track == null ? null : String(p.pk_track)) ||
        r.accuracyMeters !== (Number.isFinite(p.accuracy) ? p.accuracy : null) ||
        r.sourceFile !== "points.geojson" || r.sourceArchive !== basename(zipPath)) {
      throw new Error(`Missing or altered original source observation: ${id}`);
    }
  }
  if (!validPoints || outsideBounds || records.length !== validPoints) {
    throw new Error(`Source/output mismatch: ${validPoints} valid source points, ${outsideBounds} outside bounds, ${records.length} imported.`);
  }
  return {
    archive: basename(zipPath), validSourcePointCount: validPoints,
    importedPointCount: records.length, validPointsFilteredByBounds: outsideBounds,
    originalMeasurementsCoordinatesTimestampsIdsAndProvenancePreserved: true,
  };
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const input = resolve(process.cwd(), process.argv[2] ?? resolve(root, "data/noise.json"));
  const records = JSON.parse(await readFile(input, "utf8"));
  const summary = summarizeNoise(records);
  if (input === resolve(root, "data/noise.json")) {
    const stored = JSON.parse(await readFile(resolve(root, "data/noise-coverage.json"), "utf8"));
    if (JSON.stringify(stored) !== JSON.stringify(summary)) {
      throw new Error("Stored coverage summary is stale; rerun the importer.");
    }
  }
  const sourceValidation = process.argv[3] ?
    await auditSource(records, resolve(process.cwd(), process.argv[3])) : null;
  console.log(JSON.stringify({ ...summary, ...(sourceValidation ? { sourceValidation } : {}) }, null, 2));
} catch (error) {
  console.error(`Noise validation failed: ${error.message}`);
  process.exitCode = 1;
}
