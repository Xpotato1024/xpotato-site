import { execFile as execFileCallback } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import type {
  ContentCollection,
  InteractiveModuleRecord,
  TaxonomyRegistry,
  ToolBindingRecord,
} from "@xpotato/content-contracts";
import { validateWorkspaceDependencies } from "./dependencies.js";
import { validateBlockedDeployWorkflow, validateVnextWranglerConfig } from "./deployment-config.js";
import {
  FROZEN_LEGACY_BASELINE,
  parseGitNameStatus,
  validateGitMediaChange,
  validateLegacyRemoval,
  type GitChangedPath,
} from "./git-media.js";
import { validatePortableMdx } from "./portable-mdx.js";
import { validateSecurityHeaderArtifact } from "./security-headers.js";
import {
  validateRegistryInvariants,
  type ContentInvariantRecord,
  type ContentModuleInvariantRecord,
  type MediaRegistryInvariantRecord,
} from "./registry-invariants.js";

const execFile = promisify(execFileCallback);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const required = [
  "apps/site",
  "packages/content-contracts",
  "packages/article-pipeline",
  "packages/media-ingest",
  "packages/example-verifier",
  "packages/site-validators",
  "schemas/generated",
  "tests/fixtures",
];
const errors: string[] = [];

for (const path of required) {
  await readdir(join(root, path)).catch(() => errors.push(`Required workspace path missing: ${path}`));
}

const siteDirectory = join(root, "apps/site");
const securityHeaderPath = join(siteDirectory, "public/_headers");
const securityHeaderSource = await readFile(securityHeaderPath, "utf8").catch(() => "");
if (securityHeaderSource === "") errors.push("Required vNext security header artifact missing: apps/site/public/_headers");
else errors.push(...validateSecurityHeaderArtifact(securityHeaderSource).map((error) => `apps/site/public/_headers: ${error}`));

const vnextWranglerSource = await readFile(join(siteDirectory, "wrangler.jsonc"), "utf8").catch(() => "");
if (vnextWranglerSource === "") errors.push("Required vNext deploy config missing: apps/site/wrangler.jsonc");
else errors.push(...validateVnextWranglerConfig(vnextWranglerSource, siteDirectory));

const deployWorkflowSource = await readFile(join(root, ".github/workflows/deploy-site.yml"), "utf8").catch(() => "");
if (deployWorkflowSource === "") errors.push("Required blocked deploy workflow missing: .github/workflows/deploy-site.yml");
else errors.push(...validateBlockedDeployWorkflow(deployWorkflowSource));

for (const path of ["apps/site", "packages/content-contracts", "packages/article-pipeline", "packages/media-ingest", "packages/example-verifier", "packages/site-validators"]) {
  const manifest = JSON.parse(await readFile(join(root, path, "package.json"), "utf8")) as Parameters<typeof validateWorkspaceDependencies>[0];
  errors.push(...validateWorkspaceDependencies(manifest));
}

const walk = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ["node_modules", "dist", ".astro", ".vite"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
};

const contentCollections = ["blog", "notes", "projects", "tools", "pages"] as const satisfies readonly ContentCollection[];
const contentRecords: ContentInvariantRecord[] = [];
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---/u;
const demoPattern = /<Demo\b[^>]*\bmodule=["']([^"']+)["'][^>]*\/?\s*>/gu;

for (const collection of contentCollections) {
  const directory = join(root, "apps/site/src/content", collection);
  for (const file of await walk(directory)) {
    if (!/\.mdx?$/iu.test(file)) continue;
    const source = await readFile(file, "utf8");
    for (const problem of validatePortableMdx(source)) errors.push(`${relative(root, file)}: ${problem}`);
    const match = frontmatterPattern.exec(source);
    if (!match?.[1]) {
      errors.push(`${relative(root, file)}: frontmatter missing`);
      continue;
    }
    const data = parseYaml(match[1]) as Record<string, unknown>;
    const relativePath = relative(directory, file).replaceAll("\\", "/");
    const slug = relativePath.slice(0, -extname(relativePath).length);
    const route = collection === "pages" ? (slug === "index" ? "/" : `/${slug}/`) : `/${collection}/${slug}/`;
    const interactiveModuleIds = [...source.matchAll(demoPattern)].map((item) => item[1]!).filter(Boolean);
    contentRecords.push({
      contentId: String(data.id ?? ""),
      collection,
      route,
      draft: data.draft === true,
      ...(collection === "blog" ? { categoryId: String(data.category ?? "") } : {}),
      ...(collection === "notes" ? { subjectId: String(data.subject ?? "") } : {}),
      ...(collection === "tools" ? { toolCategoryId: String(data.category ?? "") } : {}),
      tagIds: Array.isArray(data.tags) ? data.tags.map(String) : [],
      stackIds: Array.isArray(data.stack) ? data.stack.map(String) : [],
      interactiveModuleIds,
    });
  }
}

const git = async (args: readonly string[]): Promise<string> =>
  (await execFile("git", ["-c", "core.quotepath=false", ...args], { cwd: root, encoding: "utf8" })).stdout;
const injectedNameStatus = process.env.XPOTATO_GIT_NAME_STATUS;
if (process.env.CI && injectedNameStatus !== undefined) {
  throw new Error("CI must compute repository changes from Git; XPOTATO_GIT_NAME_STATUS is local-executor only");
}
const changedPaths: GitChangedPath[] = injectedNameStatus !== undefined
  ? [...parseGitNameStatus(injectedNameStatus)]
  : [
      ...parseGitNameStatus(await git(["diff", "--name-status", "--find-renames", FROZEN_LEGACY_BASELINE, "--"])),
      ...(await git(["ls-files", "--others", "--exclude-standard"]))
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((path) => ({ kind: "A" as const, path })),
    ];
for (const change of changedPaths) {
  const mediaDecision = validateGitMediaChange(change);
  if (!mediaDecision.allowed) errors.push(`${change.path}: ${mediaDecision.reason}`);
  const legacyDecision = validateLegacyRemoval(change);
  if (!legacyDecision.allowed) errors.push(`${change.path}: ${legacyDecision.reason}`);
}

const importModule = async <T>(repositoryPath: string): Promise<T> =>
  await import(pathToFileURL(join(root, repositoryPath)).href) as T;

const { taxonomyRegistry } = await importModule<{ taxonomyRegistry: TaxonomyRegistry }>(
  "apps/site/src/content-registry/taxonomy/index.ts",
);
const { mediaRegistries } = await importModule<{ mediaRegistries: readonly MediaRegistryInvariantRecord[] }>(
  "apps/site/src/content-registry/media/index.ts",
);
const { publicationProvenanceRegistry } = await importModule<{
  publicationProvenanceRegistry: readonly Readonly<{ contentId: string }>[];
}>("apps/site/src/content-registry/provenance/index.ts");
const { interactiveModuleRegistry, toolBindings } = await importModule<{
  interactiveModuleRegistry: Readonly<Record<string, InteractiveModuleRecord>>;
  toolBindings: readonly ToolBindingRecord[];
}>("apps/site/src/content-registry/interactive/index.ts");
const { interactiveComponentIds } = await importModule<{ interactiveComponentIds: readonly string[] }>(
  "apps/site/src/content-registry/interactive/component-ids.ts",
);
const { contentModuleRegistry } = await importModule<{ contentModuleRegistry: readonly ContentModuleInvariantRecord[] }>(
  "apps/site/src/content-registry/content-modules.ts",
);
const { siteConfig } = await importModule<{ siteConfig: { site: { canonicalOrigin: string } } }>(
  "apps/site/src/lib/site-config.ts",
);
const { astroCanonicalOrigin } = await importModule<{ astroCanonicalOrigin: string }>("apps/site/astro.config.mjs");

errors.push(...validateRegistryInvariants({
  contents: contentRecords,
  mediaRegistries,
  provenanceContentIds: publicationProvenanceRegistry.map((record) => record.contentId),
  taxonomy: taxonomyRegistry,
  interactiveModules: interactiveModuleRegistry,
  toolBindings,
  interactiveComponentIds,
  contentModules: contentModuleRegistry,
}));
if (siteConfig.site.canonicalOrigin !== "https://xpotato.net/") {
  errors.push(`site config canonical origin must be https://xpotato.net/: ${siteConfig.site.canonicalOrigin}`);
}
if (astroCanonicalOrigin !== siteConfig.site.canonicalOrigin) {
  errors.push(`Astro/site config canonical origin mismatch: ${astroCanonicalOrigin} != ${siteConfig.site.canonicalOrigin}`);
}

if (errors.length > 0) throw new Error(`Repository validation failed:\n${errors.join("\n")}`);
console.log("Repository validation PASS");
