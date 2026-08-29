import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEGACY_COMMIT,
  LEGACY_REPOSITORY,
  LEGACY_TAG,
} from "./legacy-inventory.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const baselinePath = join(repositoryRoot, "tests/fixtures/migration/legacy-visual-performance-baseline.json");
const fixtureDirectory = join(repositoryRoot, "tests/fixtures/migration");
const expectedTagObjectSha = "8503f5a50a5fb3d27a02422da0b50dc66c818b02";
const expectedLockBlobSha = "bb805f8a5558bf1eebe6d57d8292f7f69cb06d5a";
const expectedProfileId = "legacy-visual-performance-v1";

const expectedViewports = [
  { id: "desktop", width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  { id: "mobile", width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
] as const;

const expectedRoutes = [
  { id: "home", path: "/", className: "home" },
  { id: "blog-archive", path: "/blog/", className: "archive" },
  { id: "blog-category-diary", path: "/blog/category/diary/", className: "generated_archive" },
  { id: "vibration-robot", path: "/blog/vibration-robot/", className: "content" },
  { id: "xpotato-site", path: "/projects/xpotato-site/", className: "project" },
  { id: "prime-factorizer", path: "/tools/prime-factorizer/", className: "tool" },
] as const;

const errors: string[] = [];
const candidate = JSON.parse(await readFile(baselinePath, "utf8")) as unknown;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const requireRecord = (value: unknown, label: string): Record<string, unknown> | undefined => {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return undefined;
  }
  return value;
};
const nonNegativeFinite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const nonNegativeInteger = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const gitShaPattern = /^[a-f0-9]{40}$/u;
const keyOf = (routeId: unknown, viewportId: unknown): string => `${String(routeId)}\0${String(viewportId)}`;

const root = requireRecord(candidate, "baseline");
if (!root) throw new Error(`Legacy visual/performance baseline invalid:\n${errors.join("\n")}`);

if (root.schemaVersion !== 1) errors.push("schemaVersion must be 1");
if (root.captureProfileId !== expectedProfileId) errors.push(`captureProfileId must be ${expectedProfileId}`);

const source = requireRecord(root.source, "source");
if (source) {
  if (source.repository !== LEGACY_REPOSITORY) errors.push("source.repository mismatch");
  if (source.tag !== LEGACY_TAG) errors.push("source.tag mismatch");
  if (source.tagObjectSha !== expectedTagObjectSha || !gitShaPattern.test(String(source.tagObjectSha ?? ""))) errors.push("source.tagObjectSha mismatch");
  if (source.commitSha !== LEGACY_COMMIT || !gitShaPattern.test(String(source.commitSha ?? ""))) errors.push("source.commitSha mismatch");
  if (source.packageLockBlobSha !== expectedLockBlobSha || !gitShaPattern.test(String(source.packageLockBlobSha ?? ""))) errors.push("source.packageLockBlobSha mismatch");
}

const environment = requireRecord(root.environment, "environment");
if (environment) {
  if (environment.platform !== "linux") errors.push("environment.platform must record hosted Linux baseline");
  if (environment.architecture !== "x64") errors.push("environment.architecture must be x64");
  if (environment.nodeVersion !== "v24.19.0") errors.push("environment.nodeVersion mismatch");
  if (typeof environment.chromeVersion !== "string" || !/^Google Chrome \d+\.\d+\.\d+\.\d+$/u.test(environment.chromeVersion)) {
    errors.push("environment.chromeVersion must record a concrete Google Chrome version");
  }
}

const compareExactArray = (label: string, actual: unknown, expected: readonly unknown[]): void => {
  if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`${label} does not match capture profile`);
};
compareExactArray("viewports", root.viewports, expectedViewports);
compareExactArray("routes", root.routes, expectedRoutes);

const expectedPairs = new Set(expectedViewports.flatMap((viewport) => expectedRoutes.map((route) => keyOf(route.id, viewport.id))));
if (root.observationCount !== expectedPairs.size) errors.push(`observationCount must be ${expectedPairs.size}`);

const validatePairs = (label: string, value: unknown, validate: (record: Record<string, unknown>, index: number) => void): void => {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const record = requireRecord(item, `${label}.${index}`);
    if (!record) return;
    const key = keyOf(record.routeId, record.viewportId);
    if (!expectedPairs.has(key)) errors.push(`${label}.${index} has unexpected route/viewport ${key}`);
    if (seen.has(key)) errors.push(`${label} duplicate route/viewport ${key}`);
    seen.add(key);
    validate(record, index);
  });
  for (const key of expectedPairs) if (!seen.has(key)) errors.push(`${label} missing route/viewport ${key}`);
  if (value.length !== expectedPairs.size) errors.push(`${label} must contain exactly ${expectedPairs.size} records`);
};

validatePairs("screenshots", root.screenshots, (record, index) => {
  if (typeof record.sha256 !== "string" || !sha256Pattern.test(record.sha256)) errors.push(`screenshots.${index}.sha256 invalid`);
  if (!Number.isInteger(record.sizeBytes) || Number(record.sizeBytes) <= 0) errors.push(`screenshots.${index}.sizeBytes must be positive integer`);
});

validatePairs("measurements", root.measurements, (record, index) => {
  for (const field of ["firstContentfulPaintMs", "largestContentfulPaintMs"] as const) {
    if (record[field] !== null && !nonNegativeFinite(record[field])) errors.push(`measurements.${index}.${field} must be null or non-negative finite number`);
  }
  for (const field of ["cls", "transferBytes", "javascriptTransferBytes", "cssTransferBytes", "imageTransferBytes", "externalTransferBytes", "domElementCount", "otherTransferBytes"] as const) {
    if (!nonNegativeFinite(record[field])) errors.push(`measurements.${index}.${field} must be non-negative finite number`);
  }
  for (const field of ["failedRequestCount", "consoleErrorCount"] as const) {
    if (!nonNegativeInteger(record[field])) errors.push(`measurements.${index}.${field} must be non-negative integer`);
  }
  const categorized = Number(record.javascriptTransferBytes ?? 0)
    + Number(record.cssTransferBytes ?? 0)
    + Number(record.imageTransferBytes ?? 0)
    + Number(record.otherTransferBytes ?? 0);
  if (categorized !== record.transferBytes) {
    errors.push(`measurements.${index} resource categories must sum exactly to transferBytes`);
  }
  if (Number(record.externalTransferBytes ?? 0) > Number(record.transferBytes ?? 0)) {
    errors.push(`measurements.${index}.externalTransferBytes cannot exceed observed transferBytes`);
  }
});

const fixtureNames = await readdir(fixtureDirectory);
const committedRaster = fixtureNames.filter((name) => /\.(?:avif|gif|jpe?g|png|webp)$/iu.test(name));
if (committedRaster.length > 0) errors.push(`Phase 1B screenshots must remain artifact-only; committed raster fixture(s): ${committedRaster.join(", ")}`);

if (errors.length > 0) throw new Error(`Legacy visual/performance baseline invalid:\n${errors.join("\n")}`);
console.log(`Legacy visual/performance baseline PASS (${expectedPairs.size} observations, profile ${expectedProfileId})`);
