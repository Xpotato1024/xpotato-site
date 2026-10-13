import { execFileSync } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { contentMediaRegistrySchema } from "@xpotato/content-contracts";
import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { canonicalRasterProfile, getMediaVariantProfileBinding, sharpToolchainSha256 } from "@xpotato/media-ingest";
import { homeWorkshopPicture } from "./home-workshop.js";
import type { prepareHomeWorkshop } from "../../../../scripts/prepare-home-workshop-media.js";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const cacheRoot = (workspace: string) => join(workspace, ".local/home-workshop-build");
type Candidate = Awaited<ReturnType<typeof prepareHomeWorkshop>>;
type ObjectRecord = Candidate["localObjects"][number];
const isChild = (parent: string, path: string): boolean => {
  const within = relative(parent, path);
  return !!within && !within.startsWith("..") && !isAbsolute(within);
};
const readObject = async (workspace: string, item: ObjectRecord) => {
  const cache = cacheRoot(workspace), path = resolve(workspace, item.privateRelativePath);
  const realWorkspace = await realpath(workspace), realCache = await realpath(cache);
  if (!isChild(cache, path) || relative(realWorkspace, realCache) !== relative(workspace, cache)
    || !isChild(realCache, await realpath(path))) throw new Error("Homepage photo path drift");
  const bytes = await readFile(path);
  if (bytes.length !== item.sizeBytes || sha256(bytes) !== item.sha256) throw new Error("Homepage photo bytes drift");
  return bytes;
};
export const readHomeWorkshopBuildCandidate = async (workspace = root): Promise<Candidate> => {
  const candidate = JSON.parse(await readFile(join(cacheRoot(workspace), "candidate.json"), "utf8")) as Candidate;
  const reviewed = JSON.parse(await readFile(join(workspace, "docs/design/home-workshop-candidate-v1.json"), "utf8")) as Candidate;
  const { candidateSha256, ...payload } = candidate;
  const profile = getMediaVariantProfileBinding("photo-hero-v1"), toolchain = sharpToolchainSha256();
  if (candidateSha256 !== fingerprint(payload) || candidate.state !== "PRIVATE_CANDIDATE_ONLY"
    || candidate.providerMutations !== 0 || candidate.productionBindingActive !== false
    || candidate.source.commit !== "927d105713561309fc5e2374396f86646b5aeb2a"
    || candidate.source.path !== "public/images/ui/hero-workshop-stage.jpg" || candidate.source.bytes !== 760808
    || candidate.source.sha256 !== "1daf2c4eb0519c2f04bec3a549b9f1711d9be1f1ca572d73c6352ea975fb00ca"
    || candidate.ingest.source.sourceSha256 !== candidate.source.sha256
    || candidate.ingest.source.width !== 2400 || candidate.ingest.source.height !== 1350
    || candidate.ingest.processing.profileId !== canonicalRasterProfile.id
    || candidate.ingest.processing.profileSha256 !== fingerprint(canonicalRasterProfile)
    || candidate.ingest.processing.toolchainSha256 !== toolchain
    || candidate.variants.profileId !== profile.profileId || candidate.variants.profileSha256 !== profile.profileSha256
    || candidate.variants.toolchainSha256 !== toolchain
    || candidate.variants.masterSha256 !== candidate.ingest.canonicalMaster.sha256
    || candidate.localObjects.length !== 13) throw new Error("Homepage photo build binding drift");
  const registry = contentMediaRegistrySchema.parse(candidate.registryCandidate);
  if (registry.assets.length !== 1 || fingerprint(registry) !== fingerprint(contentMediaRegistrySchema.parse(reviewed.registryCandidate))) {
    throw new Error("Homepage photo reviewed registry drift");
  }
  const asset = registry.assets[0]!;
  homeWorkshopPicture(asset);
  if (asset.delivery.mode !== "responsive" || asset.delivery.profileId !== profile.profileId
    || asset.delivery.profileSha256 !== profile.profileSha256
    || candidate.variants.contentId !== registry.contentId || candidate.variants.assetId !== asset.assetId) {
    throw new Error("Homepage photo profile/identity drift");
  }
  const expected = [asset.delivery.master, ...asset.delivery.variants];
  if (fingerprint(candidate.localObjects.map(({ privateRelativePath: _path, ...item }) => item)) !== fingerprint(expected)
    || fingerprint(candidate.variants.variants.map(({ privateRelativePath: _path, contentType: _type, ...item }) => item))
      !== fingerprint(asset.delivery.variants.map(({ objectKey: _key, ...item }) => item))) {
    throw new Error("Homepage photo object set drift");
  }
  for (const item of candidate.localObjects) await readObject(workspace, item);
  return candidate;
};
const prepare = async () => {
  try { return await readHomeWorkshopBuildCandidate(); }
  catch (error) {
    const failure = error as NodeJS.ErrnoException;
    if (failure.code !== "ENOENT" || failure.path !== join(cacheRoot(root), "candidate.json")) throw error;
    execFileSync(process.execPath, ["--import", "tsx", join(root, "scripts/prepare-home-workshop-media-cli.ts"), cacheRoot(root)], { cwd: root, stdio: "inherit", timeout: 60000 });
    return readHomeWorkshopBuildCandidate();
  }
};
export const readHomeWorkshopBuildBinding = async () => (await prepare()).registryCandidate.assets[0]!;
const checkedDirectory = async (dist: string, directory: string): Promise<void> => {
  let ancestor = directory;
  while (true) {
    try {
      const actual = await realpath(ancestor);
      if (actual !== dist && !isChild(dist, actual)) throw new Error("Homepage photo artifact path drift");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      ancestor = dirname(ancestor);
    }
  }
  await mkdir(directory, { recursive: true });
  if (!isChild(dist, await realpath(directory))) throw new Error("Homepage photo artifact path drift");
};
export const copyHomeWorkshopBuildObjects = async (dir: URL, workspace = root): Promise<void> => {
  const candidate = await readHomeWorkshopBuildCandidate(workspace);
  const dist = await realpath(fileURLToPath(dir));
  for (const item of candidate.localObjects) {
    const target = resolve(dist, item.objectKey);
    if (!isChild(dist, target)) throw new Error("Homepage photo artifact key drift");
    await checkedDirectory(dist, dirname(target));
    const bytes = await readObject(workspace, item);
    try { await writeFile(target, bytes, { flag: "wx" }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (!isChild(dist, await realpath(target)) || sha256(await readFile(target)) !== item.sha256) {
        throw new Error("Homepage photo immutable artifact collision");
      }
    }
  }
};
export const homeWorkshopIntegration = (): AstroIntegration => ({ name: "frozen-home-workshop-artifact",
  hooks: {
    "astro:build:start": async () => { await prepare(); },
    "astro:build:done": async ({ dir }) => { await copyHomeWorkshopBuildObjects(dir); },
    "astro:server:setup": async ({ server }) => {
      const objects = new Map((await prepare()).localObjects.map(item => ["/" + item.objectKey, item]));
      server.middlewares.use((request, response, next) => {
        const item = objects.get(new URL(request.url ?? "/", "http://localhost").pathname);
        if (!item) { next(); return; }
        readObject(root, item).then(bytes => {
          response.setHeader("Content-Type", "image/" + item.format); response.end(bytes);
        }).catch(next);
      });
    },
  },
});
