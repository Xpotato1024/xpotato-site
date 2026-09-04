import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint } from "@xpotato/content-contracts/canonical";
import {
  LEGACY_COMMIT,
  LEGACY_REPOSITORY,
  LEGACY_TAG,
  generateLegacyInventory,
  inventoryEndpointPaths,
  parseLegacyFreezeBaseline,
  splitLegacyContentSource,
  verifyLegacyTagIdentity,
} from "./legacy-inventory.js";
import {
  compareLegacyBuildEquivalence,
  validateLegacyBuildReproductionEvidence,
  type LegacyBuildReproductionEvidence,
  type LegacySortRecord,
} from "./legacy-equivalence.js";
import {
  LEGACY_PRIME_FACTORIZER_HTML_PATH,
  provePrimeFactorizerAstroUidVariance,
  validateAstroReactIslandUidVarianceEvidence,
  verifyPrimeFactorizerInteractiveBinding,
  type AstroReactIslandUidVarianceEvidence,
} from "./legacy-uid-equivalence.js";
import {
  compareLegacyDistManifests,
  createLegacyDistManifest,
  readLegacyHtmlArtifacts,
  type LegacyDistDifference,
  type LegacyDistManifest,
} from "./legacy-reproduction.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const outputDirectory = join(repositoryRoot, ".local/migration", LEGACY_TAG, "build");
const baselinePath = join(repositoryRoot, "tests/fixtures/migration/legacy-freeze-baseline.json");
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

interface CommandReceipt { readonly attempt: number; readonly command: string; readonly exitStatus: number; }
type EmittedEvidence = LegacyBuildReproductionEvidence & Readonly<{
  permittedGeneratedMetadataVariances: readonly AstroReactIslandUidVarianceEvidence[];
}>;

const run = (attempt: number, command: string, args: readonly string[], cwd: string): CommandReceipt => {
  const executable = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : command;
  const executableArgs = process.platform === "win32" ? ["/d", "/s", "/c", command, ...args] : [...args];
  const result = spawnSync(executable, executableArgs, { cwd, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" }, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  return { attempt, command: [command, ...args].join(" "), exitStatus: result.status ?? 1 };
};
const gitBuffer = (args: readonly string[], cwd = repositoryRoot): Buffer => execFileSync("git", ["-c", "core.quotepath=false", ...args], { cwd, encoding: "buffer", maxBuffer: 128 * 1024 * 1024 });
const git = (args: readonly string[], cwd = repositoryRoot): string => gitBuffer(args, cwd).toString("utf8").trim();
const npmVersionText = (): string => process.platform === "win32"
  ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", npmExecutable, "--version"], { encoding: "utf8" }).trim()
  : execFileSync(npmExecutable, ["--version"], { encoding: "utf8" }).trim();
const readBaseline = async (): Promise<ReturnType<typeof parseLegacyFreezeBaseline> | undefined> => {
  try { return parseLegacyFreezeBaseline(JSON.parse(await readFile(baselinePath, "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
};
const rawStringValues = (value: unknown): readonly string[] => typeof value === "string" && value.length > 0
  ? [value]
  : Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
const buildLegacySortCatalog = (): ReadonlyMap<string, LegacySortRecord> => {
  const paths = gitBuffer(["ls-tree", "-r", "-z", "--name-only", LEGACY_COMMIT, "--", "src/content"]).toString("utf8").split("\0")
    .filter((path) => /^src\/content\/(?:blog|notes|projects|tools)\/.+\.mdx?$/u.test(path)).sort();
  const records = new Map<string, LegacySortRecord>();
  for (const path of paths) {
    const match = /^src\/content\/(blog|notes|projects|tools)\/(.+)\.mdx?$/u.exec(path);
    if (!match?.[1] || !match[2]) continue;
    const collection = match[1] as LegacySortRecord["collection"];
    const route = `/${collection}/${match[2]}/`;
    const { data } = splitLegacyContentSource(gitBuffer(["cat-file", "blob", `${LEGACY_COMMIT}:${path}`]), path);
    const pubDate = data.pubDate;
    const pubDateMs = pubDate instanceof Date ? pubDate.getTime() : new Date(String(pubDate ?? "")).getTime();
    if (!Number.isFinite(pubDateMs)) throw new Error(`${path}: pubDate is not reproducibly parseable`);
    const title = data.title;
    if (typeof title !== "string" || title.length === 0) throw new Error(`${path}: title missing for equivalence catalog`);
    const description = typeof data.description === "string" ? data.description : undefined;
    const category = typeof data.category === "string" ? data.category : undefined;
    const featuredOrder = typeof data.featuredOrder === "number" && Number.isFinite(data.featuredOrder) ? data.featuredOrder : undefined;
    records.set(route, {
      route, collection, title, pubDateMs, tags: rawStringValues(data.tags), draft: data.draft === true,
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(featuredOrder !== undefined ? { featuredOrder } : {}),
    });
  }
  return records;
};

const tempRoot = await mkdtemp(join(tmpdir(), "xpotato-site-legacy-reproduce-"));
const commands: CommandReceipt[] = [];
const builds: LegacyDistManifest[] = [];
const htmlBuilds: Array<ReadonlyMap<string, string>> = [];
let differences: readonly LegacyDistDifference[] = [];
let evidence: EmittedEvidence | undefined;
let completed = false;
let failure: string | undefined;
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

try {
  const inventory = generateLegacyInventory(repositoryRoot, { generatedAt: "2000-01-01T00:00:00.000Z" });
  const bindingErrors = verifyPrimeFactorizerInteractiveBinding(inventory.interactive);
  if (bindingErrors.length > 0) throw new Error(bindingErrors.join("\n"));
  const expectedEndpointsSha256 = fingerprint(inventoryEndpointPaths(inventory));
  const baseline = await readBaseline();
  if (baseline) {
    const tagErrors = verifyLegacyTagIdentity(repositoryRoot, baseline);
    if (tagErrors.length > 0) throw new Error(tagErrors.join("\n"));
  }
  const nodeVersion = process.version;
  const npmVersion = npmVersionText();
  const packageLockBlobSha = git(["rev-parse", `${LEGACY_TAG}:package-lock.json`]);
  const tagObjectSha = git(["rev-parse", `refs/tags/${LEGACY_TAG}`]);
  const catalog = buildLegacySortCatalog();
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const legacyWorktree = join(tempRoot, `legacy-worktree-${attempt}`);
    let worktreeAdded = false;
    try {
      git(["worktree", "add", "--detach", legacyWorktree, LEGACY_TAG]);
      worktreeAdded = true;
      if (git(["rev-parse", "HEAD"], legacyWorktree) !== LEGACY_COMMIT) throw new Error(`legacy worktree #${attempt} commit mismatch`);
      commands.push(run(attempt, npmExecutable, ["ci"], legacyWorktree));
      if (commands.at(-1)?.exitStatus !== 0) throw new Error(`legacy npm ci #${attempt} failed`);
      commands.push(run(attempt, npmExecutable, ["run", "check"], legacyWorktree));
      if (commands.at(-1)?.exitStatus !== 0) throw new Error(`legacy npm run check #${attempt} failed`);
      commands.push(run(attempt, npmExecutable, ["run", "build"], legacyWorktree));
      if (commands.at(-1)?.exitStatus !== 0) throw new Error(`legacy npm run build #${attempt} failed`);
      const distDirectory = join(legacyWorktree, "dist");
      const manifest = await createLegacyDistManifest(distDirectory);
      builds.push(manifest);
      htmlBuilds.push(await readLegacyHtmlArtifacts(distDirectory));
      await writeFile(join(outputDirectory, `manifest-${attempt}.json`), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      if (git(["status", "--porcelain", "--untracked-files=no"], legacyWorktree) !== "") throw new Error(`legacy tracked source changed during reproduction #${attempt}`);
      await cp(distDirectory, join(outputDirectory, `dist-${attempt}`), { recursive: true });
    } finally {
      if (worktreeAdded) git(["worktree", "remove", "--force", legacyWorktree]);
    }
  }
  const first = builds[0]!;
  const second = builds[1]!;
  differences = compareLegacyDistManifests(first, second);
  await writeFile(join(outputDirectory, "differences.json"), `${JSON.stringify(differences, null, 2)}\n`, "utf8");

  const firstRawHtml = htmlBuilds[0]!;
  const secondRawHtml = htmlBuilds[1]!;
  const firstComparisonHtml = new Map(firstRawHtml);
  const secondComparisonHtml = new Map(secondRawHtml);
  const generatedMetadataVariances: AstroReactIslandUidVarianceEvidence[] = [];
  const firstToolHtml = firstRawHtml.get(LEGACY_PRIME_FACTORIZER_HTML_PATH);
  const secondToolHtml = secondRawHtml.get(LEGACY_PRIME_FACTORIZER_HTML_PATH);
  if (firstToolHtml === undefined || secondToolHtml === undefined) throw new Error("PrimeFactorizer HTML evidence missing from legacy build");
  const uidProof = provePrimeFactorizerAstroUidVariance({
    path: LEGACY_PRIME_FACTORIZER_HTML_PATH,
    firstHtml: firstToolHtml,
    secondHtml: secondToolHtml,
    interactiveBindingVerified: true,
  });
  if (uidProof) {
    const uidEvidenceErrors = validateAstroReactIslandUidVarianceEvidence(uidProof.evidence);
    if (uidEvidenceErrors.length > 0) throw new Error(`Astro uid variance evidence invalid:\n${uidEvidenceErrors.join("\n")}`);
    firstComparisonHtml.set(LEGACY_PRIME_FACTORIZER_HTML_PATH, uidProof.firstComparisonHtml);
    secondComparisonHtml.set(LEGACY_PRIME_FACTORIZER_HTML_PATH, uidProof.secondComparisonHtml);
    generatedMetadataVariances.push(uidProof.evidence);
  }

  const baseEvidence = compareLegacyBuildEquivalence({
    first: { manifest: first, html: firstComparisonHtml },
    second: { manifest: second, html: secondComparisonHtml },
    expectedEndpointPathsSha256: expectedEndpointsSha256,
    catalog,
    source: { repository: LEGACY_REPOSITORY, tag: LEGACY_TAG, tagObjectSha, commitSha: LEGACY_COMMIT, packageLockBlobSha },
    nodeVersion,
    npmVersion,
  });
  const actualEvidence: EmittedEvidence = {
    ...baseEvidence,
    permittedGeneratedMetadataVariances: generatedMetadataVariances,
  };
  evidence = actualEvidence;
  const evidenceErrors = validateLegacyBuildReproductionEvidence(actualEvidence);
  if (evidenceErrors.length > 0) throw new Error(`Legacy reproduction evidence invalid:\n${evidenceErrors.join("\n")}`);
  await writeFile(join(outputDirectory, "reproduction-evidence.json"), `${JSON.stringify(actualEvidence, null, 2)}\n`, "utf8");
  if (actualEvidence.result.status !== "PASS") throw new Error(`Legacy characterized equivalence failed: ${actualEvidence.result.reason}`);

  if (baseline) {
    const expectedBuild = baseline.legacyBuild;
    if (expectedBuild.status !== "PASS") {
      throw new Error(`Committed legacy build baseline is not PASS: ${expectedBuild.status}`);
    }
    const baselineErrors: string[] = [];
    const compareBaselineField = (label: string, actual: unknown, expected: unknown): void => {
      if (actual !== expected) baselineErrors.push(`${label} mismatch: ${String(actual)} != ${String(expected)}`);
    };
    compareBaselineField("legacy baseline nodeVersion", nodeVersion, expectedBuild.nodeVersion);
    compareBaselineField("legacy baseline npmVersion", npmVersion, expectedBuild.npmVersion);
    compareBaselineField("legacy baseline packageLockBlobSha", packageLockBlobSha, expectedBuild.packageLockBlobSha);
    compareBaselineField("legacy baseline endpointPathsSha256", first.endpointPathsSha256, expectedBuild.endpointPathsSha256);
    compareBaselineField("legacy baseline endpointPathsSha256 (build 2)", second.endpointPathsSha256, expectedBuild.endpointPathsSha256);
    compareBaselineField("legacy baseline nonHtmlManifestSha256", first.nonHtmlManifestSha256, expectedBuild.nonHtmlManifestSha256);
    compareBaselineField("legacy baseline nonHtmlManifestSha256 (build 2)", second.nonHtmlManifestSha256, expectedBuild.nonHtmlManifestSha256);
    compareBaselineField("legacy baseline fileCount", first.fileCount, expectedBuild.fileCount);
    compareBaselineField("legacy baseline fileCount (build 2)", second.fileCount, expectedBuild.fileCount);
    compareBaselineField("legacy baseline equivalenceProfileId", actualEvidence.equivalenceProfileId, expectedBuild.equivalenceProfileId);
    compareBaselineField("legacy baseline rawByteIdentical", actualEvidence.result.rawByteIdentical, expectedBuild.rawByteIdentical);
    compareBaselineField("legacy baseline equivalenceVerified", actualEvidence.result.equivalenceVerified, expectedBuild.equivalenceVerified);
    if (baselineErrors.length > 0) {
      throw new Error(`Legacy reproduction deterministic baseline mismatch:\n${baselineErrors.join("\n")}`);
    }
  }

  completed = true;
  await writeFile(join(outputDirectory, "reproduction-report.json"), `${JSON.stringify({ schemaVersion: 2, success: true, sourceTag: LEGACY_TAG, sourceCommit: LEGACY_COMMIT, packageLockBlobSha, nodeVersion, npmVersion, commands, builds, rawDifferences: differences, equivalence: actualEvidence, sourceTreeByteIdentity: "PASS" }, null, 2)}\n`, "utf8");
  console.log(`Legacy reproduction PASS (${actualEvidence.result.rawByteIdentical ? "raw-byte-identical" : "characterized-equivalence"})`);
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  await writeFile(join(outputDirectory, "reproduction-report.json"), `${JSON.stringify({ schemaVersion: 2, success: false, sourceTag: LEGACY_TAG, sourceCommit: LEGACY_COMMIT, commands, builds, rawDifferences: differences, equivalence: evidence, failure }, null, 2)}\n`, "utf8");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
if (!completed || failure) throw new Error(`Legacy reproduction failed:\n${failure ?? "unknown failure"}`);