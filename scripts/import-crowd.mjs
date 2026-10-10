import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseCrowdCSV, verifyMetricHTML, publishedCoordinate, normalizeCrowd, summarizeCrowd } from "./lib/crowd-data.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(resolve(ROOT, "data/crowd-sources.json"), "utf8"));

async function publicText(url, csv = false) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "icap.sustainability.illinois.edu") {
    throw new Error("Only the configured public iCAP source is allowed");
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(25000), redirect: "error" });
  if (!response.ok) throw new Error(`iCAP HTTP ${response.status} at ${parsed.pathname}`);
  if (csv && !response.headers.get("content-type")?.includes("text/csv")) throw new Error("Source did not return CSV");
  const text = await response.text();
  if (Buffer.byteLength(text) > 2_000_000) throw new Error("Unexpectedly large iCAP source");
  return text;
}

function checkCatalog(snapshot) {
  if (snapshot?.version !== 1 || snapshot.sources?.length !== catalog.sources.length) {
    throw new Error("Snapshot must contain all configured pedestrian metrics");
  }
  const ids = new Set();
  for (const source of snapshot.sources) {
    const configured = catalog.sources.find(s => s.metricId === source.metricId);
    if (!configured || ids.has(source.metricId)) throw new Error("Unknown or duplicate source metric");
    ids.add(source.metricId);
    for (const key of ["name", "metricUrl", "csvUrl", "locationUrl", "locationScope"]) {
      if (source[key] !== configured[key]) throw new Error(`Snapshot source ${key} does not match catalog`);
    }
    if (!/^Metric:\s*Pedestrian Counts? at /i.test(source.metricTitle ?? "")) throw new Error("Not a verified pedestrian metric");
  }
}

async function main() {
  const args = process.argv.slice(2);
  let snapshot;
  if (args.length === 2 && args[0] === "--offline") {
    snapshot = JSON.parse(await readFile(resolve(args[1]), "utf8"));
  } else if (!args.length) {
    snapshot = { version: 1, retrievedAt: new Date().toISOString(), sources: [] };
    // Fetch a small, explicit set of official pedestrian CSVs, never Mapbox/Google APIs.
    for (const source of catalog.sources) {
      const [metricHTML, csv] = await Promise.all([publicText(source.metricUrl), publicText(source.csvUrl, true)]);
      const metricTitle = verifyMetricHTML(metricHTML, source);
      const coordinate = source.locationScope === "single_counter"
        ? publishedCoordinate(await publicText(source.locationUrl)) : { latitude: null, longitude: null };
      snapshot.sources.push({
        ...source, ...coordinate, metricTitle, measurementType: "pedestrian_count", granularity: "month",
        csvSha256: createHash("sha256").update(csv).digest("hex"), rows: parseCrowdCSV(csv),
      });
    }
  } else throw new Error("Usage: node scripts/import-crowd.mjs [--offline data/crowd-source-snapshot.json]");

  checkCatalog(snapshot);
  const records = normalizeCrowd(snapshot), summary = summarizeCrowd(records);
  const outputs = [
    ["crowd-source-snapshot.json", snapshot], ["crowd.json", records], ["crowd-coverage.json", summary],
  ];
  // Complete all fetching/parsing/validation before touching an existing output.
  const pending = [];
  try {
    for (const [name, data] of outputs) {
      const destination = resolve(ROOT, "data", name);
      const temporary = `${destination}.tmp-${process.pid}`;
      pending.push({ destination, temporary });
      await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { flag: "wx" });
    }
    for (const { destination, temporary } of pending) await rename(temporary, destination);
  } finally {
    await Promise.all(pending.map(({ temporary }) => rm(temporary, { force: true })));
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => { console.error(`Crowd import failed: ${error.message}`); process.exitCode = 1; });
