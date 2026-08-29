import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint } from "@xpotato/content-contracts/canonical";
import {
  DESIGN_TIME_BASELINE,
  LEGACY_TAG,
  deriveMigrationParityReport,
  generateLegacyInventory,
  inventoryEndpointPaths,
  summarizeLegacyInventory,
  validateBaselineAgainstInventory,
  validateMigrationInventoryInvariants,
  verifyLegacyTagIdentity,
} from "./legacy-inventory.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const outputDirectory = join(repositoryRoot, ".local/migration", LEGACY_TAG);
const inventoryPath = join(outputDirectory, "inventory.json");
const reportPath = join(outputDirectory, "inventory-report.json");
const reproductionReportPath = join(outputDirectory, "build/reproduction-report.json");
const baselinePath = join(repositoryRoot, "tests/fixtures/migration/legacy-freeze-baseline.json");
const writeMode = process.argv.includes("--write");
const checkMode = process.argv.includes("--check");

if (writeMode === checkMode) throw new Error("Use exactly one of --write or --check");

const readJson = async (path: string): Promise<unknown | undefined> =>
  JSON.parse(await readFile(path, "utf8").catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "null";
    throw error;
  })) ?? undefined;

const first = generateLegacyInventory(repositoryRoot, {
  ...(checkMode ? { generatedAt: "2000-01-01T00:00:00.000Z" } : {}),
});
const second = generateLegacyInventory(repositoryRoot, {
  generatedAt: checkMode ? "2001-01-01T00:00:00.000Z" : new Date(Date.now() + 1_000).toISOString(),
});
const errors = [
  ...validateMigrationInventoryInvariants(first),
  ...validateMigrationInventoryInvariants(second),
];
if (first.inventoryPayloadSha256 !== second.inventoryPayloadSha256) {
  errors.push(`repeated inventory digest mismatch: ${first.inventoryPayloadSha256} != ${second.inventoryPayloadSha256}`);
}

const baseline = await readJson(baselinePath);
let legacyBuildBaselineStatus: "PASS" | "FAIL" | "UNKNOWN" = "UNKNOWN";
if (checkMode && baseline === undefined) errors.push(`baseline fixture missing: ${baselinePath}`);
if (baseline !== undefined) {
  errors.push(...validateBaselineAgainstInventory(baseline, first));
  const baselineRecord = baseline as Readonly<{
    tag?: string;
    tagObjectSha?: string;
    commitSha?: string;
    legacyBuild?: { status?: "PASS" | "FAIL"; endpointPathsSha256?: string };
  }>;
  legacyBuildBaselineStatus = baselineRecord.legacyBuild?.status ?? "UNKNOWN";
  if (baselineRecord.tag && baselineRecord.tagObjectSha && baselineRecord.commitSha) {
    errors.push(...verifyLegacyTagIdentity(repositoryRoot, {
      tag: baselineRecord.tag,
      tagObjectSha: baselineRecord.tagObjectSha,
      commitSha: baselineRecord.commitSha,
    }));
  }
  const endpointDigest = fingerprint(inventoryEndpointPaths(first));
  if (baselineRecord.legacyBuild?.endpointPathsSha256 !== endpointDigest) {
    errors.push(`legacy build endpoint digest mismatch: ${baselineRecord.legacyBuild?.endpointPathsSha256 ?? "missing"} != ${endpointDigest}`);
  }
}

const reproduction = await readJson(reproductionReportPath);
let routeEvidence = "source_model_pending_build_confirmation";
if (reproduction !== undefined) {
  const endpointDigest = (reproduction as { builds?: Array<{ endpointPathsSha256?: string }> }).builds?.[1]?.endpointPathsSha256;
  const expectedEndpointDigest = fingerprint(inventoryEndpointPaths(first));
  if (endpointDigest !== expectedEndpointDigest) errors.push(`reproduced build endpoints differ from inventory routes`);
  else routeEvidence = "reproduced_legacy_build_confirmed";
}

if (errors.length > 0) throw new Error(`Legacy migration inventory validation failed:\n${errors.join("\n")}`);

const summary = summarizeLegacyInventory(first);
const parity = deriveMigrationParityReport(first);
if (writeMode) {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(inventoryPath, `${JSON.stringify(first, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: first.snapshot.generatedAt,
    inventoryPayloadSha256: first.inventoryPayloadSha256,
    repeatedGenerationDeterministic: true,
    inventoryIntegrity: "PASS",
    legacyBuildReproduction: legacyBuildBaselineStatus,
    phase1aStatus: legacyBuildBaselineStatus === "PASS" ? "PASS" : "FAIL",
    routeEvidence,
    summary,
    designTimeBaseline: DESIGN_TIME_BASELINE,
    designTimeDelta: {
      publishedContentCounts: Object.fromEntries(
        Object.entries(summary.publishedContentCounts).map(([key, value]) => [key, value - DESIGN_TIME_BASELINE.publishedContentCounts[key as keyof typeof DESIGN_TIME_BASELINE.publishedContentCounts]]),
      ),
      gitMediaBytes: summary.gitMediaBytes - DESIGN_TIME_BASELINE.gitMediaBytes,
      wordpressQueryIdentityCount: summary.wordpressQueryIdentityCount - DESIGN_TIME_BASELINE.wordpressQueryIdentityCount,
      interactiveRecordCount: summary.interactiveRecordCount - DESIGN_TIME_BASELINE.interactiveRecordCount,
    },
    parity,
    expectedFutureMigrationBlockers: [
      "vNext ContentId allocation not started",
      "content/taxonomy/media/route migration mappings not reviewed",
      "non-local media not migrated",
      "LegacyHtml manual review pending",
      "migration/cutover remains blocked",
    ],
  }, null, 2)}\n`, "utf8");
}

console.log(`Legacy inventory PASS ${first.inventoryPayloadSha256}`);
console.log(`Legacy build baseline ${legacyBuildBaselineStatus}`);
console.log(JSON.stringify(summary));
