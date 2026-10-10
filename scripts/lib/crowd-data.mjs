import { createHash } from "node:crypto";
import { distanceMeters } from "./noise-data.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
const requiredHeaders = ["Value", "Applicable Date", "Affirmed By", "Annotation"];
const knownCheckpoints = [
  [40.1075212, -88.227231], [40.1124997, -88.2269172],
  [40.109418, -88.227915], [40.111100, -88.227743],
  [40.108808, -88.226757], [40.110380, -88.226476],
  [40.108544, -88.228802], [40.109699, -88.228124], [40.110516, -88.227728],
];

// RFC-style quoting, including multiline annotations and escaped quotes.
export function parseCrowdCSV(input) {
  const rows = [];
  let row = [], field = "", quoted = false, closedQuote = false;
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else field += char;
    } else if (char === '"' && !field && !closedQuote) quoted = true;
    else if (char === "," || char === "\n") {
      row.push(field); field = ""; closedQuote = false;
      if (char === "\n") { if (row.some(value => value !== "")) rows.push(row); row = []; }
    } else {
      if (char === '"' || closedQuote) throw new Error("Malformed CSV quoting");
      field += char;
    }
  }
  if (quoted) throw new Error("Unclosed CSV field");
  if (field || row.length || closedQuote) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  if (!headers || headers.join("|") !== requiredHeaders.join("|")) {
    throw new Error("Expected the official iCAP pedestrian tracking CSV columns");
  }
  if (!rows.length) throw new Error("Empty crowd CSV; existing output has not been replaced");
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2}: wrong column count`);
    // Staff names in "Affirmed By" are deliberately not retained.
    return { sourceRowNumber: index + 2, originalValue: values[0], originalDate: values[1], annotation: values[3] };
  });
}

export function sourceDate(input) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (!match) throw new Error("Unsupported source calendar date");
  const [, monthText, dayText, yearText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Invalid source calendar date");
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function verifyMetricHTML(html, source) {
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map(match => match[1].replace(/<[^>]+>/g, "").trim());
  const heading = headings.find(text => /^Metric:\s*Pedestrian Counts? at /i.test(text));
  if (!heading || !/^Metric:\s*Pedestrian Counts? at /i.test(heading) ||
      !html.includes(`/metric-export/${source.metricId}`) ||
      !html.includes("/metric-topics/pedestrians") || !html.includes("Tracked by Month")) {
    throw new Error(`Metric ${source.metricId}: cannot verify pedestrian/monthly source`);
  }
  return heading;
}

export function publishedCoordinate(html) {
  const matches = [...html.matchAll(/\.setLngLat\(\[\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*\]\)/g)];
  if (matches.length !== 1) throw new Error("Expected exactly one published counter map marker");
  const longitude = Number(matches[0][1]), latitude = Number(matches[0][2]);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error("Invalid map marker");
  return { latitude, longitude };
}

export function normalizeCrowd(snapshot) {
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.sources) || !snapshot.sources.length) {
    throw new Error("Expected a non-empty pedestrian source snapshot");
  }
  if (!Number.isFinite(Date.parse(snapshot.retrievedAt))) throw new Error("Invalid retrieval timestamp");
  const records = snapshot.sources.flatMap(source => {
    if (source.measurementType !== "pedestrian_count" || source.granularity !== "month" ||
        !["single_counter", "multiple_counters"].includes(source.locationScope) ||
        !Array.isArray(source.rows) || !source.rows.length) throw new Error("Invalid pedestrian source");
    const monthFrequency = new Map();
    for (const row of source.rows) {
      const month = sourceDate(row.originalDate).slice(0, 7);
      monthFrequency.set(month, (monthFrequency.get(month) ?? 0) + 1);
    }
    return source.rows.map(row => {
      if (!/^\d+(?:\.0+)?$/.test(row.originalValue)) throw new Error("Count must preserve a nonnegative integer");
      const reportedCount = Number(row.originalValue);
      if (!Number.isSafeInteger(reportedCount)) throw new Error("Count outside safe integer range");
      if (typeof row.annotation !== "string" || !Number.isInteger(row.sourceRowNumber) || row.sourceRowNumber < 2) {
        throw new Error("Invalid source row provenance");
      }
      const applicableDate = sourceDate(row.originalDate), periodMonth = applicableDate.slice(0, 7);
      const lastDay = new Date(Date.UTC(Number(applicableDate.slice(0, 4)), Number(applicableDate.slice(5, 7)), 0)).getUTCDate();
      const qualityFlags = [];
      if (reportedCount === 0) qualityFlags.push("zero_count_requires_review");
      if (row.annotation.trim()) qualityFlags.push("source_annotation_present");
      if (/malfunction|error|battery|non.?operational|repair|out of order|no reliable|not reporting/i.test(row.annotation)) {
        qualityFlags.push("source_reported_equipment_warning");
      }
      if (/only|missing|gap|out of order|non.?operational/i.test(row.annotation)) qualityFlags.push("possible_partial_coverage");
      if (Number(applicableDate.slice(8)) !== lastDay) qualityFlags.push("applicable_date_not_month_end");
      if (monthFrequency.get(periodMonth) > 1) qualityFlags.push("multiple_reports_for_month_do_not_sum");
      if (source.locationScope === "multiple_counters") qualityFlags.push("aggregate_not_a_single_point");
      return {
        id: `icap-${source.metricId}-${hash(JSON.stringify([row.originalDate, row.originalValue, row.annotation])).slice(0, 24)}`,
        locationName: source.name, locationScope: source.locationScope,
        latitude: source.locationScope === "single_counter" ? source.latitude : null,
        longitude: source.locationScope === "single_counter" ? source.longitude : null,
        coordinateBasis: source.locationScope === "single_counter" ? "published_iCAP_map_marker_not_surveyed" : "unresolved_multi_counter_aggregate",
        coordinateSourceUrl: source.locationUrl, reportedCount, measurementType: "pedestrian_count",
        sourceUnit: "# of pedestrians", sourceValueOriginal: row.originalValue,
        granularity: "month", periodMonth, applicableDate, sourceDateOriginal: row.originalDate,
        observedAt: null, periodStart: null, periodEnd: null,
        sourceType: "UIUC iCAP / Eco-Counter", sourceMetricId: source.metricId,
        sourceUrl: source.metricUrl, sourceCsvUrl: source.csvUrl,
        sourceCsvSha256: source.csvSha256, sourceRowNumber: row.sourceRowNumber,
        sourceAnnotation: row.annotation, retrievedAt: snapshot.retrievedAt,
        qualityFlags, usableForLiveCrowdScoring: false,
      };
    });
  });
  validateCrowdRecords(records);
  return records.sort((a, b) => a.sourceMetricId.localeCompare(b.sourceMetricId) ||
    a.applicableDate.localeCompare(b.applicableDate) || a.id.localeCompare(b.id));
}

export function validateCrowdRecords(records) {
  if (!Array.isArray(records) || !records.length) throw new Error("Empty crowd dataset");
  const ids = new Set();
  for (const r of records) {
    if (!r?.id || ids.has(r.id)) throw new Error("Missing or duplicate crowd record ID");
    ids.add(r.id);
    if (!Number.isSafeInteger(r.reportedCount) || r.reportedCount < 0 ||
        !/^\d+(?:\.0+)?$/.test(r.sourceValueOriginal) || Number(r.sourceValueOriginal) !== r.reportedCount) {
      throw new Error("Original pedestrian count changed or invalid");
    }
    if (sourceDate(r.sourceDateOriginal) !== r.applicableDate || r.periodMonth !== r.applicableDate.slice(0, 7) ||
        r.granularity !== "month" || r.measurementType !== "pedestrian_count" || r.sourceUnit !== "# of pedestrians" ||
        r.usableForLiveCrowdScoring !== false || r.observedAt !== null || r.periodStart !== null || r.periodEnd !== null) {
      throw new Error("Monthly observations must not become invented timestamps or live crowd scores");
    }
    if (!["single_counter", "multiple_counters"].includes(r.locationScope)) throw new Error("Invalid location scope");
    if (r.locationScope === "multiple_counters") {
      if (r.latitude !== null || r.longitude !== null) throw new Error("Aggregate counts cannot be assigned to one point");
    } else if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude) ||
        Math.abs(r.latitude) > 90 || Math.abs(r.longitude) > 180) throw new Error("Invalid counter coordinates");
    if (!Array.isArray(r.qualityFlags) ||
        (r.reportedCount === 0 && !r.qualityFlags.includes("zero_count_requires_review"))) throw new Error("Missing quality flags");
    if (!Number.isFinite(Date.parse(r.retrievedAt)) || !/^[a-f0-9]{64}$/.test(r.sourceCsvSha256) ||
        !Number.isInteger(r.sourceRowNumber) || r.sourceRowNumber < 2 || typeof r.sourceAnnotation !== "string" ||
        r.sourceUrl !== `https://icap.sustainability.illinois.edu/metric/${r.sourceUrl?.split("/").pop()}` ||
        r.sourceCsvUrl !== `https://icap.sustainability.illinois.edu/metric-export/${r.sourceMetricId}`) throw new Error("Invalid source provenance");
    if ("crowdCost" in r || "crowdScore" in r) throw new Error("Raw monthly counts cannot contain invented 0–100 scores");
  }
}

export function summarizeCrowd(records) {
  validateCrowdRecords(records);
  const located = records.filter(r => r.latitude !== null);
  const sites = [...new Set(records.map(r => r.sourceMetricId))].sort().map(id => {
    const rows = records.filter(r => r.sourceMetricId === id);
    return { sourceMetricId: id, name: rows[0].locationName, recordCount: rows.length,
      locationScope: rows[0].locationScope, latitude: rows[0].latitude, longitude: rows[0].longitude,
      firstPeriodMonth: rows[0].periodMonth, lastPeriodMonth: rows.at(-1).periodMonth,
      warningRecordCount: rows.filter(r => r.qualityFlags.length > 0).length };
  });
  const months = records.map(r => r.periodMonth).sort();
  const distances = located.map(r => Math.min(...knownCheckpoints.map(p => distanceMeters([r.latitude, r.longitude], p))));
  return {
    version: 1, recordCount: records.length, sourceMetricCount: sites.length,
    locatedRecordCount: located.length, unlocatedAggregateRecordCount: records.length - located.length,
    singleCounterLocationCount: sites.filter(s => s.locationScope === "single_counter").length,
    periodMonthRange: { start: months[0], end: months.at(-1) },
    unit: "# of pedestrians", granularity: "month",
    reportedCountRange: { minimum: Math.min(...records.map(r => r.reportedCount)), maximum: Math.max(...records.map(r => r.reportedCount)) },
    zeroCountRecords: records.filter(r => r.reportedCount === 0).length,
    equipmentWarningRecords: records.filter(r => r.qualityFlags.includes("source_reported_equipment_warning")).length,
    multipleReportsForMonthRecords: records.filter(r => r.qualityFlags.includes("multiple_reports_for_month_do_not_sum")).length,
    sites,
    targetRoute: {
      name: "UIUC Main Quad → Grainger Engineering Library", proximityThresholdMeters: 50,
      pointCountNearKnownCheckpoints: sites.filter(s => s.latitude !== null &&
        Math.min(...knownCheckpoints.map(p => distanceMeters([s.latitude, s.longitude], p))) <= 50).length,
      minimumDistanceToKnownCheckpointsMeters: distances.length ? Math.round(Math.min(...distances) * 100) / 100 : null,
      proximityBasis: "Single-counter published markers vs existing endpoint pins and candidate waypoints only",
      verifiedRouteGeometryAvailable: false, fullRouteCoverage: null, sufficientForLiveRouteScoring: false,
    },
    limitations: [
      "Historical monthly reported pedestrian counts, not current occupancy, crowd density, or hourly conditions.",
      "Do not divide monthly totals into invented instantaneous observations or convert directly into 0–100 crowd scores.",
      "Zero values may reflect counter failures; original values and source equipment annotations are retained.",
      "A warning may affect later rows without repeated annotations; absence of a row annotation does not prove equipment was fixed.",
      "Source applicable dates can fall inside a month; exact measurement start/end instants and complete-month coverage are unknown.",
      "Multiple reports for one site/month are retained separately and must not be added together.",
      "Combined north/south Illini Union counts have no invented single-point coordinate.",
      "Published map markers are not surveyed coordinates; checkpoint proximity is not distance to the full route.",
      "Only the four explicitly selected official pedestrian metrics are imported; no campus-wide extrapolation.",
      "Affirming staff names are intentionally omitted; attribution is to the institution and source metric.",
      "Public availability is not an explicit redistribution license; retain attribution and confirm terms before broader redistribution.",
    ],
  };
}
