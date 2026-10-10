import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const BOUNDING_BOX = {
  south: 40.098,
  west: -88.240,
  north: 40.115,
  east: -88.215,
};
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(SCRIPT_DIR, "../data/trees.json");

const query = `
[out:json][timeout:60];
node["natural"="tree"](${BOUNDING_BOX.south},${BOUNDING_BOX.west},${BOUNDING_BOX.north},${BOUNDING_BOX.east});
out body;
`.trim();

async function fetchTrees() {
  let response;
  try {
    response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
        "User-Agent": "QuietCampus-EnvironmentalDataPipeline/1.0",
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    throw new Error(`Network request to Overpass failed: ${error.message}`);
  }

  if (!response.ok) {
    const detail = (await response.text()).trim().slice(0, 500);
    throw new Error(
      `Overpass returned HTTP ${response.status} ${response.statusText}` +
        (detail ? `: ${detail}` : ""),
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`Overpass returned invalid JSON: ${error.message}`);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.elements)
  ) {
    throw new Error(
      "Unexpected Overpass response: expected an object with an elements array.",
    );
  }
  if (payload.remark) {
    throw new Error(`Overpass reported an incomplete query: ${payload.remark}`);
  }

  const fetchedAt = new Date().toISOString();
  return payload.elements.map((element, index) => {
    if (
      element?.type !== "node" ||
      !Number.isSafeInteger(element.id) ||
      !Number.isFinite(element.lat) ||
      !Number.isFinite(element.lon)
    ) {
      throw new Error(
        `Unexpected tree element at response index ${index}: expected a node with a safe integer id and numeric coordinates.`,
      );
    }
    if (
      element.tags !== undefined &&
      (element.tags === null || typeof element.tags !== "object")
    ) {
      throw new Error(
        `Unexpected tags on tree node ${element.id}: expected an object.`,
      );
    }

    return {
      osm_id: element.id,
      latitude: element.lat,
      longitude: element.lon,
      species: element.tags?.species ?? null,
      data_source: "OpenStreetMap",
      source_url: `https://www.openstreetmap.org/node/${element.id}`,
      fetched_at: fetchedAt,
    };
  });
}

async function main() {
  const trees = await fetchTrees();
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(trees, null, 2)}\n`, "utf8");

  console.log(`Saved ${trees.length} tree records to data/trees.json.`);
  if (trees.length > 0) {
    console.log("Sample record:");
    console.log(JSON.stringify(trees[0], null, 2));
  } else {
    console.log("Overpass returned no mapped trees in the requested area.");
  }
}

main().catch((error) => {
  console.error(`Tree data sync failed: ${error.message}`);
  process.exitCode = 1;
});
