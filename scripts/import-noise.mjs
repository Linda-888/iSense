import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StringDecoder } from "node:string_decoder";
import { promisify } from "node:util";
import { NOISE_IMPORT_BOUNDS, isIndividualNoisePoint, summarizeNoise, validateNoiseRecords } from "./lib/noise-data.mjs";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(SCRIPT_DIR, "../data/noise.json");
const SOURCE_URL =
  process.env.NOISE_SOURCE_URL ?? "https://noise-planet.org/map_noisecapture/";
const BOUNDS = NOISE_IMPORT_BOUNDS;

const MEASUREMENT_FIELDS = [
  { names: ["noise_level"], metric: "LAeq" },
  { names: ["laeq", "leq_mean"], metric: "LAeq" },
  { names: ["la50"], metric: "LA50" },
];
const TIME_FIELDS = [
  { names: ["time_ISO8601", "time_date", "observedAt", "timestamp"], epoch: false },
  { names: ["time_epoch"], epoch: true },
  { names: ["leq_utc", "record_utc"], epoch: true },
  { names: ["first_measure_ISO_8601"], epoch: false },
  { names: ["first_measure_epoch"], epoch: true },
  { names: ["last_measure_ISO_8601"], epoch: false },
  { names: ["last_measure_epoch"], epoch: true },
];
const ID_FIELDS = ["leq_id"];

function propertyValue(properties, names) {
  for (const name of names) {
    if (Object.hasOwn(properties, name)) {
      return { name, value: properties[name] };
    }
  }

  const lowerNames = new Set(names.map((name) => name.toLowerCase()));
  const actualName = Object.keys(properties).find((name) =>
    lowerNames.has(name.toLowerCase()),
  );
  return actualName
    ? { name: actualName, value: properties[actualName] }
    : null;
}

function getMeasurement(properties) {
  for (const candidate of MEASUREMENT_FIELDS) {
    const found = propertyValue(properties, candidate.names);
    if (!found) continue;

    const value =
      typeof found.value === "number"
        ? found.value
        : typeof found.value === "string" && found.value.trim() !== ""
          ? Number(found.value)
          : Number.NaN;
    if (Number.isFinite(value)) {
      return {
        value,
        metric:
          found.name.toLowerCase() === "la50" ? "LA50" : candidate.metric,
      };
    }
  }
  return null;
}

function getObservedAt(properties) {
  for (const candidate of TIME_FIELDS) {
    const found = propertyValue(properties, candidate.names);
    if (!found || found.value === null || found.value === "") continue;

    const date = candidate.epoch
      ? new Date(Number(found.value))
      : new Date(found.value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function getSourceId(feature, properties) {
  if (feature.id !== undefined && feature.id !== null) {
    return String(feature.id);
  }

  const found = propertyValue(properties, ID_FIELDS);
  return found && found.value !== undefined && found.value !== null
    ? String(found.value)
    : null;
}

function isInsideCampus(latitude, longitude) {
  return (
    latitude >= BOUNDS.south &&
    latitude <= BOUNDS.north &&
    longitude >= BOUNDS.west &&
    longitude <= BOUNDS.east
  );
}

async function* iterateGeoJsonFeatures(stream, label) {
  const decoder = new StringDecoder("utf8");
  let prefix = "";
  let foundFeatures = false;
  let featuresClosed = false;
  let currentFeature = "";
  let objectDepth = 0;
  let insideString = false;
  let escaped = false;

  for await (const chunk of stream) {
    let text = decoder.write(chunk);
    if (!foundFeatures) {
      prefix += text;
      const match = /"features"\s*:\s*\[/.exec(prefix);
      if (!match) {
        if (prefix.length > 1024 * 1024) {
          throw new Error(`${label}: could not find a GeoJSON features array.`);
        }
        continue;
      }
      text = prefix.slice(match.index + match[0].length);
      prefix = "";
      foundFeatures = true;
    }

    for (const character of text) {
      if (featuresClosed) break;

      if (objectDepth === 0) {
        if (/\s|,/.test(character)) continue;
        if (character === "]") {
          featuresClosed = true;
          break;
        }
        if (character !== "{") {
          throw new Error(
            `${label}: invalid GeoJSON feature entry; expected an object or the end of the features array.`,
          );
        }
        currentFeature = "{";
        objectDepth = 1;
        insideString = false;
        escaped = false;
        continue;
      }

      currentFeature += character;
      if (insideString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          insideString = false;
        }
      } else if (character === '"') {
        insideString = true;
      } else if (character === "{") {
        objectDepth += 1;
      } else if (character === "}") {
        objectDepth -= 1;
        if (objectDepth === 0) {
          let feature;
          try {
            feature = JSON.parse(currentFeature);
          } catch (error) {
            throw new Error(`${label}: invalid GeoJSON feature: ${error.message}`);
          }
          if (!feature || feature.type !== "Feature") {
            throw new Error(`${label}: expected every item to be a GeoJSON Feature.`);
          }
          yield feature;
          currentFeature = "";
        }
      }
    }
  }

  const finalText = decoder.end();
  if (finalText && foundFeatures && !featuresClosed) {
    for (const character of finalText) {
      if (objectDepth === 0) {
        if (/\s|,/.test(character)) continue;
        if (character === "]") {
          featuresClosed = true;
          break;
        }
        if (character !== "{") {
          throw new Error(`${label}: invalid GeoJSON feature array.`);
        }
        currentFeature = "{";
        objectDepth = 1;
        insideString = false;
        escaped = false;
        continue;
      }

      currentFeature += character;
      if (insideString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') insideString = false;
      } else if (character === '"') insideString = true;
      else if (character === "{") objectDepth += 1;
      else if (character === "}") {
        objectDepth -= 1;
        if (objectDepth === 0) {
          let feature;
          try {
            feature = JSON.parse(currentFeature);
          } catch (error) {
            throw new Error(`${label}: invalid GeoJSON feature: ${error.message}`);
          }
          if (!feature || feature.type !== "Feature") {
            throw new Error(`${label}: expected every item to be a GeoJSON Feature.`);
          }
          yield feature;
          currentFeature = "";
        }
      }
    }
  }

  if (!foundFeatures) {
    throw new Error(`${label}: not a GeoJSON FeatureCollection (no features array).`);
  }
  if (!featuresClosed || objectDepth !== 0) {
    throw new Error(`${label}: the GeoJSON features array ended unexpectedly.`);
  }
}

async function listGeoJsonMembers(zipPath) {
  try {
    const { stdout } = await execFileAsync("unzip", ["-Z1", zipPath], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout
      .split(/\r?\n/)
      .filter((entry) => entry && /\.geojson$/i.test(entry));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "ZIP input requires the `unzip` command. Install unzip, or pass a .geojson file directly.",
      );
    }
    throw new Error(`Could not list GeoJSON files in ZIP: ${error.message}`);
  }
}

function openZipMember(zipPath, member) {
  const child = spawn("unzip", ["-p", zipPath, member], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-2000);
  });

  const done = new Promise((resolveDone, rejectDone) => {
    child.once("error", rejectDone);
    child.once("close", (code) => {
      if (code === 0) resolveDone();
      else rejectDone(new Error(stderr.trim() || `unzip exited with code ${code}`));
    });
  });
  done.catch(() => {});
  return { stream: child.stdout, done, child };
}

async function getInputStreams(inputPath) {
  const extension = extname(inputPath).toLowerCase();
  if (extension === ".geojson" || extension === ".json") {
    return [{ name: basename(inputPath), stream: createReadStream(inputPath) }];
  }
  if (extension !== ".zip") {
    throw new Error("Input must be a .zip, .geojson, or .json file.");
  }

  const members = await listGeoJsonMembers(inputPath);
  if (members.length === 0) {
    throw new Error("The ZIP contains no .geojson files.");
  }
  return members.map((name) => ({ name, zipPath: inputPath }));
}

async function main() {
  const inputArgument = process.argv[2];
  if (!inputArgument) {
    throw new Error(
      "Usage: npm run import:noise -- <path-to-noisecapture.zip-or-geojson>",
    );
  }

  const inputPath = resolve(process.cwd(), inputArgument);
  const inputFiles = await getInputStreams(inputPath);
  const retrievedAt = new Date().toISOString();
  const records = [];
  const observedProperties = new Set();
  const missingFieldCounts = {
    sourceId: 0,
    pointCoordinates: 0,
    noiseMeasurement: 0,
    observationTimestamp: 0,
  };
  let recordsRead = 0;
  let campusFeatures = 0;
  let nonMeasurementFeaturesSkipped = 0;
  let validObservationsBeforeBounds = 0;
  let validObservationsFilteredByBounds = 0;

  for (const inputFile of inputFiles) {
    let streamInfo;
    if (inputFile.zipPath) {
      streamInfo = openZipMember(inputFile.zipPath, inputFile.name);
    } else {
      streamInfo = {
        stream: inputFile.stream,
        done: Promise.resolve(),
      };
    }

    try {
      for await (const feature of iterateGeoJsonFeatures(
        streamInfo.stream,
        inputFile.name,
      )) {
        recordsRead += 1;
        const properties =
          feature.properties &&
          typeof feature.properties === "object" &&
          !Array.isArray(feature.properties)
            ? feature.properties
            : {};
        for (const propertyName of Object.keys(properties)) {
          observedProperties.add(propertyName);
        }

        // Stationary tracks can also have Point geometry. They are summaries,
        // not extra one-second measurements. Likewise exclude aggregate areas.
        if (!isIndividualNoisePoint(feature, inputFile.name)) {
          nonMeasurementFeaturesSkipped += 1;
          continue;
        }

        const coordinates = feature.geometry?.coordinates;
        const isPoint =
          feature.geometry?.type === "Point" &&
          Array.isArray(coordinates) &&
          Number.isFinite(coordinates[0]) &&
          Number.isFinite(coordinates[1]);
        if (!isPoint) {
          missingFieldCounts.pointCoordinates += 1;
        }

        const measurement = getMeasurement(properties);
        if (!measurement) missingFieldCounts.noiseMeasurement += 1;

        const observedAt = getObservedAt(properties);
        if (!observedAt) missingFieldCounts.observationTimestamp += 1;

        const sourceId = getSourceId(feature, properties);
        if (!sourceId) missingFieldCounts.sourceId += 1;

        if (!isPoint) continue;
        const [longitude, latitude] = coordinates;
        if (measurement && observedAt) validObservationsBeforeBounds += 1;
        if (!isInsideCampus(latitude, longitude)) {
          if (measurement && observedAt) validObservationsFilteredByBounds += 1;
          continue;
        }
        campusFeatures += 1;
        if (!measurement || !observedAt) continue;

        const id =
          sourceId ??
          createHash("sha256")
            .update(`${inputFile.name}\0${JSON.stringify(feature)}`)
            .digest("hex");
        records.push({
          id,
          sourceId,
          sourceTrackId: properties.pk_track == null ? null : String(properties.pk_track),
          latitude,
          longitude,
          noiseDb: measurement.value,
          noiseMetric: measurement.metric,
          observedAt,
          observedAtOriginal: properties.time_ISO8601 ?? properties.time_date ?? null,
          accuracyMeters: Number.isFinite(properties.accuracy) ? properties.accuracy : null,
          retrievedAt,
          sourceUrl: SOURCE_URL,
          sourceType: "NoiseCapture",
          sourceArchive: basename(inputPath),
          sourceFile: inputFile.name,
        });
      }
      await streamInfo.done;
    } catch (error) {
      streamInfo.child?.kill();
      await streamInfo.done.catch(() => {});
      throw error;
    }
  }

  // Validate before replacing existing data; empty/malformed input must not erase it.
  validateNoiseRecords(records);
  const coverage = summarizeNoise(records);
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  await writeFile(resolve(dirname(OUTPUT_PATH), "noise-coverage.json"),
    `${JSON.stringify(coverage, null, 2)}\n`, "utf8");

  const missingFields =
    recordsRead === 0
      ? "Not assessable: the input contains no GeoJSON features."
      : Object.fromEntries(
          Object.entries(missingFieldCounts).filter(([, count]) => count > 0),
        );

  console.log(
    JSON.stringify(
      {
        input: basename(inputPath),
        geojsonFilesRead: inputFiles.length,
        recordsRead,
        nonMeasurementFeaturesSkipped,
        validObservationsBeforeBounds,
        validObservationsFilteredByBounds,
        featuresInsideCampusBounds: campusFeatures,
        validRecordsSaved: records.length,
        coverage,
        inspectedPropertyNames: [...observedProperties].sort(),
        missingFields,
        output: "data/noise.json",
        sampleRecord: records[0] ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`NoiseCapture import failed: ${error.message}`);
  process.exitCode = 1;
});
