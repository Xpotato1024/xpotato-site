import { execFileSync } from "node:child_process";
import { appendFile, lstat, readFile, readdir, realpath } from "node:fs/promises";
import { join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "@xpotato/content-contracts/canonical";
import { sharpToolchainSha256 } from "@xpotato/media-ingest";
import { readHomeWorkshopBuildCandidate } from "./home-workshop-build.js";

const cacheRoot = ".local/home-workshop-build";
// Keep the workflow's cache paths equal to this list. Never cache the whole parent.
export const homeWorkshopCiCachePaths = ["candidate.json", "public-master", "variants", "mobile", "social"]
  .map(path => `${cacheRoot}/${path}`);
const objectRoots = homeWorkshopCiCachePaths.slice(1);
const sourcePaths = [
  "package.json", "package-lock.json", ".nvmrc", ".node-version", ".npmrc", ".gitattributes",
  ".github/workflows/ci.yml", "tools/build/home-workshop", "packages/media-ingest",
  "packages/content-contracts", "packages/site-validators/src", "apps/site/src/lib/home",
  "apps/site/source-inputs", "apps/site/src/styles/fonts.css", "apps/site/public/fonts",
  "apps/site/public/xpotato-logo.svg", "docs/migration/media-raw-inventory-v1.json",
  "docs/migration/media-repository-candidate-v1.json", "tests/fixtures/migration/legacy-freeze-baseline.json",
];
const configPatterns = ["package.json", "tsconfig*.json", "tools/tsconfig*.json",
  "apps/*/package.json", "packages/*/package.json", "apps/*/tsconfig*.json", "packages/*/tsconfig*.json"]
  .map(path => `:(glob)${path}`);
const git = (workspace: string, args: string[]) => execFileSync("git", args, {
  cwd: workspace, encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
  env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0" },
});
const repositoryRoot = () => git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();

/** Git subtree/blob IDs bind source content, so unrelated commits retain the key. */
export function homeWorkshopCiCacheKey(workspace = repositoryRoot()): string {
  const paths = [...new Set([...sourcePaths,
    ...git(workspace, ["ls-files", "-z", "--", ...configPatterns]).split("\0").filter(Boolean)])].sort();
  // A HEAD tree key must not describe modified or additional working-tree inputs.
  if (git(workspace, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...sourcePaths, ...configPatterns])) {
    throw Error("Homepage media cache key requires clean source inputs");
  }
  const objects = git(workspace, ["ls-tree", "-z", "HEAD", "--", ...paths]);
  if (!objects) throw Error("Homepage media cache source objects are missing");
  const inputs = sha256(objects);
  return `home-workshop-public-v1-${process.platform}-${process.arch}-${process.version}-${sharpToolchainSha256()}-${inputs}`;
}

const portable = (path: string) => path.replaceAll("\\", "/");
async function checkedEntry(workspace: string, path: string) {
  const absolute = join(workspace, path), entry = await lstat(absolute);
  if (entry.isSymbolicLink() || portable(relative(workspace, await realpath(absolute))) !== path
    || (!entry.isDirectory() && (!entry.isFile() || entry.nlink !== 1))) {
    throw Error("Homepage media cache requires regular unlinked paths: " + path);
  }
  return entry;
}

/** Saving bytes is not validation evidence: the ordinary build rechecks every object. */
export async function verifyHomeWorkshopCiCache(workspace = repositoryRoot()): Promise<void> {
  workspace = await realpath(resolve(workspace));
  for (const path of [".local", cacheRoot]) {
    if (!(await checkedEntry(workspace, path)).isDirectory()) throw Error("Homepage media cache parent is not a directory");
  }
  const files = new Set<string>(), directories = new Set<string>();
  const walk = async (path: string): Promise<void> => {
    const entry = await checkedEntry(workspace, path);
    if (entry.isDirectory()) {
      directories.add(path);
      for (const name of await readdir(join(workspace, path))) await walk(`${path}/${name}`);
    } else files.add(path);
  };
  for (const path of homeWorkshopCiCachePaths) await walk(path);
  const metadataPath = `${cacheRoot}/candidate.json`;
  if (!files.has(metadataPath)) throw Error("Homepage media cache candidate must be a regular file");
  const metadata = JSON.parse(await readFile(join(workspace, metadataPath), "utf8")) as { localObjects?: unknown };
  if (!Array.isArray(metadata.localObjects)) throw Error("Homepage media cache object list is missing");
  const expected = new Set([metadataPath]), expectedDirectories = new Set<string>();
  for (const object of metadata.localObjects) {
    const path = object?.privateRelativePath;
    if (typeof path !== "string" || path.includes("\\") || posix.normalize(path) !== path
      || !objectRoots.some(root => path.startsWith(root + "/")) || expected.has(path)) {
      throw Error("Homepage media cache object path is outside the public allowlist or duplicated");
    }
    expected.add(path);
    for (let parent = posix.dirname(path); parent !== cacheRoot; parent = posix.dirname(parent)) expectedDirectories.add(parent);
  }
  if (files.size !== expected.size || [...files].some(path => !expected.has(path))
    || directories.size !== expectedDirectories.size || [...directories].some(path => !expectedDirectories.has(path))) {
    throw Error("Homepage media cache must contain exactly the candidate and public object set");
  }
  // Existing reviewed recipe/profile/toolchain/registry/hash/size checks remain authoritative.
  await readHomeWorkshopBuildCandidate(workspace);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (process.argv.length !== 3 || (command !== "key" && command !== "verify")) {
    throw Error("Usage: tsx tools/build/home-workshop/ci-cache.ts <key|verify>");
  }
  if (command === "key") {
    const key = homeWorkshopCiCacheKey();
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `key=${key}\n`);
    console.log(key);
  } else {
    await verifyHomeWorkshopCiCache();
    console.log("Homepage media cache: exact public byte set verified; no validation result is cached");
  }
}
