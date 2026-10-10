// Raw acoustic observations, deliberately separate from route costs (0–100).
// Exact min/max of points.geojson in the verified local ZIP (inclusive).
// This is a dataset-specific import window, not the campus extent.
export const NOISE_IMPORT_BOUNDS = {
  south: 40.115688874, west: -88.221318189,
  north: 40.115738467, east: -88.221248583,
};

// Existing iSense location pins and team-researched candidate waypoints.
// These are checkpoints only: never connect them to invent route geometry.
const CHECKPOINTS = [
  [40.1075212, -88.227231], [40.1124997, -88.2269172],
  [40.109418, -88.227915], [40.111100, -88.227743],
  [40.108808, -88.226757], [40.110380, -88.226476],
  [40.108544, -88.228802], [40.109699, -88.228124],
  [40.110516, -88.227728],
];

export function isIndividualNoisePoint(feature, memberName = "") {
  const coordinates = feature?.geometry?.coordinates;
  const properties = feature?.properties ?? {};
  return feature?.geometry?.type === "Point" && Array.isArray(coordinates) &&
    Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]) &&
    !/(?:^|\/)(?:tracks|areas)\.geojson$/i.test(memberName) &&
    !Object.hasOwn(properties, "time_length") &&
    !Object.hasOwn(properties, "measure_count");
}

export function distanceMeters(a, b) {
  const rad = Math.PI / 180;
  const h = Math.sin((b[0] - a[0]) * rad / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) *
    Math.sin((b[1] - a[1]) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function validateNoiseRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Expected non-empty raw noise observations; existing output has not been replaced.");
  }
  const ids = new Set();
  for (const [index, record] of records.entries()) {
    const fail = (message) => { throw new Error(`Noise record ${index}: ${message}`); };
    if (!record || typeof record !== "object") fail("expected an object");
    if (typeof record.id !== "string" || !record.id || ids.has(record.id)) fail("missing or duplicate ID");
    ids.add(record.id);
    if (!Number.isFinite(record.latitude) || record.latitude < -90 || record.latitude > 90 ||
        !Number.isFinite(record.longitude) || record.longitude < -180 || record.longitude > 180) {
      fail("invalid latitude/longitude");
    }
    if (record.latitude < NOISE_IMPORT_BOUNDS.south || record.latitude > NOISE_IMPORT_BOUNDS.north ||
        record.longitude < NOISE_IMPORT_BOUNDS.west || record.longitude > NOISE_IMPORT_BOUNDS.east) fail("outside import bounds");
    if (!Number.isFinite(record.noiseDb)) fail("noiseDb must retain a finite original dB(A) measurement");
    if (!["LAeq", "LA50"].includes(record.noiseMetric)) fail("unknown acoustic metric");
    for (const field of ["observedAt", "retrievedAt"]) {
      if (typeof record[field] !== "string" ||
          !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(record[field]) ||
          !Number.isFinite(Date.parse(record[field]))) fail(`invalid timezone-aware ${field}`);
    }
    if (record.sourceType !== "NoiseCapture" || typeof record.sourceUrl !== "string" ||
        !/^https:\/\//.test(record.sourceUrl)) fail("missing NoiseCapture source");
    for (const field of ["sourceId", "sourceTrackId", "observedAtOriginal"]) {
      if (record[field] != null && typeof record[field] !== "string") fail(`invalid ${field}`);
    }
    if (record.accuracyMeters != null &&
        (!Number.isFinite(record.accuracyMeters) || record.accuracyMeters < 0)) fail("invalid GPS accuracy");
  }
}

function localTime(iso) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

export function summarizeNoise(records) {
  validateNoiseRecords(records);
  const latitudes = records.map(r => r.latitude), longitudes = records.map(r => r.longitude);
  const times = records.map(r => new Date(r.observedAt).toISOString()).sort();
  const bounds = {
    south: Math.min(...latitudes), west: Math.min(...longitudes),
    north: Math.max(...latitudes), east: Math.max(...longitudes),
  };
  const centerLat = (bounds.south + bounds.north) / 2;
  const distances = records.map(r =>
    Math.min(...CHECKPOINTS.map(p => distanceMeters([r.latitude, r.longitude], p))));
  return {
    version: 1,
    sourceType: "NoiseCapture",
    recordCount: records.length,
    uniqueCoordinateCount: new Set(records.map(r => `${r.latitude},${r.longitude}`)).size,
    trackCount: new Set(records.map(r => r.sourceTrackId).filter(Boolean)).size,
    importBounds: NOISE_IMPORT_BOUNDS,
    geographicBounds: bounds,
    footprintMeters: {
      width: Number(distanceMeters([centerLat, bounds.west], [centerLat, bounds.east]).toFixed(2)),
      height: Number(distanceMeters([bounds.south, bounds.west], [bounds.north, bounds.west]).toFixed(2)),
    },
    timeRange: {
      start: times[0], end: times.at(-1), localTimeZone: "America/Chicago",
      startLocal: localTime(times[0]), endLocal: localTime(times.at(-1)),
    },
    measurement: {
      unit: "dB(A)", metrics: [...new Set(records.map(r => r.noiseMetric))],
      minimum: Math.min(...records.map(r => r.noiseDb)),
      maximum: Math.max(...records.map(r => r.noiseDb)),
    },
    targetRoute: {
      name: "UIUC Main Quad → Grainger Engineering Library",
      proximityThresholdMeters: 50,
      pointCountNearKnownCheckpoints: distances.filter(d => d <= 50).length,
      anyPointsNearKnownCheckpoints: distances.some(d => d <= 50),
      minimumDistanceToKnownCheckpointsMeters: Number(Math.min(...distances).toFixed(2)),
      proximityBasis: "Known endpoint pins and team-researched candidate waypoints only",
      verifiedRouteGeometryAvailable: false,
      fullRouteCoverage: null,
      sufficientForFullRouteScoring: false,
    },
    limitations: [
      "Historical phone measurements; not current conditions or campus-wide evidence.",
      "One-second observations are not independent sampling sites; footprint is only the coordinate bounding box.",
      "Nearby-checkpoint tests are not distance-to-path tests; full route coverage is unknown without verified geometry.",
      "Do not extrapolate to unmeasured locations or convert dB(A) arbitrarily to a 0–100 route cost.",
      "No calibration or GPS accuracy guarantee; the source calibration is already applied.",
    ],
  };
}
