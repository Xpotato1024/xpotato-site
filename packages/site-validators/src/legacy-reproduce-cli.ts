import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint } from "@xpotato/content-contracts/canonical";
import {
  LEGACY_COMMIT,
  LEGACY_TAG,
  generateLegacyInventory,
  inventoryEndpointPaths,
  parseLegacyFreezeBaseline,
  verifyLegacyTagIdentity,
} from "./legacy-inventory.js";
import {
  compareLegacyDistManifests,
  createLegacyDistManifest,
  type LegacyDistDifference,
  type LegacyDistManifest,
} from "./legacy-reproduction.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const outputDirectory = join(repositoryRoot, ".local/migration", LEGACY_TAG, "build");
const baselinePath = join(repositoryRoot, "tests/fixtures/migration/legacy-freeze-baseline.json");
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

interface CommandReceipt {
  readonly attempt: number;
  readonly command: string;
  readonly exitStatus: number;
}

const run = (attempt: number, command: string, args: readonly string[], cwd: string): CommandReceipt => {
  const executable = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : command;
  const executableArgs = process.platform === "win32" ? ["/d", "/s", "/c", command, ...args] : [...args];
  const result = spawnSync(executable, executableArgs, {
    cwd,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  return { attempt, command: [command, ...args].join(" "), exitStatus: result.status ?? 1 };
};

const git = (args: readonly string[], cwd = repositoryRoot): string =>
  execFileSync("git", ["-c", "core.quotepath=false", ...args], { cwd, encoding: "utf8" }).trim();

const npmVersionText = (): string => process.platform === "win32"
  ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", npmExecutable, "--version"], { encoding: "utf8" }).trim()
  : execFileSync(npmExecutable, ["--version"], { encoding: "utf8" }).trim();

const readBaseline = async (): Promise<ReturnType<typeof parseLegacyFreezeBaseline> | undefined> => {
  try {
    return parseLegacyFreezeBaseline(JSON.parse(await readFile(baselinePath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const tempRoot = await mkdtemp(join(tmpdir(), "xpotato-site-legacy-reproduce-"));
const commands: CommandReceipt[] = [];
const builds: LegacyDistManifest[] = [];
let differences: readonly LegacyDistDifference[] = [];
let completed = false;
let failure: string | undefined;

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

try {
  const inventory = generateLegacyInventory(repositoryRoot, { generatedAt: "2000-01-01T00:00:00.000Z" });
  const expectedEndpointsSha256 = fingerprint(inventoryEndpointPaths(inventory));
  const baseline = await readBaseline();
  if (baseline) {
    const tagErrors = verifyLegacyTagIdentity(repositoryRoot, baseline);
    if (tagErrors.length > 0) throw new Error(tagErrors.join("\n"));
  }
  const nodeVersion = process.version;
  const npmVersion = npmVersionText();
  const packageLockBlobSha = git(["rev-parse", `${LEGACY_TAG}:package-lock.json`]);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const legacyWorktree = join(tempRoot, `legacy-worktree-${attempt}`);
    let worktreeAdded = false;
    try {
      git(["worktree", "add", "--detach", legacyWorktree, LEGACY_TAG]);
      worktreeAdded = true;
      if (git(["rev-parse", "HEAD"], legacyWorktree) !== LEGACY_COMMIT) {
        throw new Error(`legacy worktree #${attempt} commit mismatch`);
      }
      commands.push(run(attempt, npmExecutable, ["ci"], legacyWorktree));
      if (commands.at(-1)?.exitStatus !== 0) throw new Error(`legacy npm ci #${attempt} failed`);
      commands.push(run(attempt, npmExecutable, ["run", "check"], legacyWorktree));
      if (commands.at(-1)?.exitStatus !== 0) throw new Error(`legacy npm run check #${attempt} failed`);
      commands.push(run(attempt, npmExecutable, ["run", "build"], legacyWorktree));
      if (commands.at(-1)?.exitStatus !== 0) throw new Error(`legacy npm run build #${attempt} failed`);
      const manifest = await createLegacyDistManifest(join(legacyWorktree, "dist"));
      builds.push(manifest);
      await writeFile(join(outputDirectory, `manifest-${attempt}.json`), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      if (git(["status", "--porcelain", "--untracked-files=no"], legacyWorktree) !== "") {
        throw new Error(`legacy tracked source changed during reproduction #${attempt}`);
      }
      if (attempt === 2) {
        await cp(join(legacyWorktree, "dist"), join(outputDirectory, "dist"), { recursive: true });
      }
    } finally {
      if (worktreeAdded) git(["worktree", "remove", "--force", legacyWorktree]);
    }
  }

  const first = builds[0]!;
  const second = builds[1]!;
  differences = compareLegacyDistManifests(first, second);
  await writeFile(join(outputDirectory, "differences.json"), `${JSON.stringify(differences, null, 2)}\n`, "utf8");
  if (second.endpointPathsSha256 !== expectedEndpointsSha256) {
    throw new Error(`legacy build endpoint set differs from inventory: ${second.endpointPathsSha256} != ${expectedEndpointsSha256}`);
  }
  if (differences.length > 0) {
    throw new Error(`legacy build output is nondeterministic across clean worktrees:\n${JSON.stringify(differences, null, 2)}`);
  }
  if (baseline) {
    const expectedBuild = baseline.legacyBuild;
    if (expectedBuild.status !== "PASS") {
      throw new Error("legacy build became deterministic but the committed baseline still records FAIL; review and refresh the baseline");
    }
    const actualBuild = {
      status: "PASS" as const,
      nodeVersion,
      npmVersion,
      packageLockBlobSha,
      distManifestSha256: second.distManifestSha256,
      endpointPathsSha256: second.endpointPathsSha256,
      fileCount: second.fileCount,
      repeatedBuild: true as const,
      differingArtifactCount: 0 as const,
    };
    if (fingerprint(actualBuild) !== fingerprint(expectedBuild)) {
      throw new Error(`legacy build baseline mismatch:\nexpected=${JSON.stringify(expectedBuild)}\nactual=${JSON.stringify(actualBuild)}`);
    }
  }
  completed = true;
  await writeFile(join(outputDirectory, "reproduction-report.json"), `${JSON.stringify({
    schemaVersion: 1,
    success: true,
    sourceTag: LEGACY_TAG,
    sourceCommit: LEGACY_COMMIT,
    packageLockBlobSha,
    nodeVersion,
    npmVersion,
    commands,
    builds,
    repeatedBuild: "PASS",
    differingArtifacts: differences,
    sourceTreeByteIdentity: "PASS",
  }, null, 2)}\n`, "utf8");
  console.log(`Legacy reproduction PASS ${second.distManifestSha256}`);
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  await writeFile(join(outputDirectory, "reproduction-report.json"), `${JSON.stringify({
    schemaVersion: 1,
    success: false,
    sourceTag: LEGACY_TAG,
    sourceCommit: LEGACY_COMMIT,
    commands,
    builds,
    differingArtifacts: differences,
    failure,
  }, null, 2)}\n`, "utf8");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

if (!completed || failure) throw new Error(`Legacy reproduction failed:\n${failure ?? "unknown failure"}`);
