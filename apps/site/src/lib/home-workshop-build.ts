import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { contentMediaRegistrySchema } from "@xpotato/content-contracts";
import { fingerprint } from "@xpotato/content-contracts/canonical";
import { homeWorkshopPicture } from "./home-workshop.js";
export type { AstroIntegration } from "astro";

const findWorkspace = async (): Promise<string> => {
  let directory = resolve(process.cwd());
  while (true) {
    try {
      const pkg = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as { name?: unknown };
      if (pkg.name === "xpotato-site-vnext") return directory;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Homepage photo workspace missing");
    directory = parent;
  }
};
export const readHomeWorkshopBuildBinding = async (workspace?: string) => {
  const root = workspace ?? await findWorkspace(), cache = join(root, ".local/home-workshop-build");
  if (relative(await realpath(root), await realpath(cache)) !== relative(root, cache)) {
    throw new Error("Homepage photo prepared cache path drift");
  }
  const paths = ["candidate.json", "verified-binding.json"].map(name => join(cache, name));
  for (const path of paths) {
    const file = await lstat(path);
    if (!file.isFile() || file.isSymbolicLink()) throw new Error("Homepage photo prepared metadata path drift");
  }
  const [candidate, binding, reviewed] = await Promise.all([
    ...paths.map(path => readFile(path, "utf8")),
    readFile(join(root, "docs/design/home-workshop-candidate-v1.json"), "utf8"),
  ]).then(values => values.map(value => JSON.parse(value)));
  const { candidateSha256, ...candidatePayload } = candidate;
  const { bindingSha256, ...bindingPayload } = binding;
  if (binding.schemaVersion !== 1 || binding.state !== "VERIFIED_FROZEN_HOME_WORKSHOP_BINDING"
    || !/^[a-f0-9]{64}$/u.test(candidateSha256) || fingerprint(candidatePayload) !== candidateSha256
    || binding.candidateSha256 !== candidateSha256 || fingerprint(bindingPayload) !== bindingSha256) {
    throw new Error("Homepage photo was not prepared by the build hook");
  }
  const registry = contentMediaRegistrySchema.parse(binding.registryCandidate);
  if (registry.assets.length !== 1 || fingerprint(registry) !== fingerprint(contentMediaRegistrySchema.parse(candidate.registryCandidate))
    || fingerprint(registry) !== fingerprint(contentMediaRegistrySchema.parse(reviewed.registryCandidate))) {
    throw new Error("Homepage photo prepared registry drift");
  }
  const asset = registry.assets[0]!;
  homeWorkshopPicture(asset);
  return asset;
};
