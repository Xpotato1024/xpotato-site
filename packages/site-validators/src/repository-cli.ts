import { privateDraftOutputErrors } from "@xpotato/portable-content/private-output";
import { validateSeriesReferences } from "@xpotato/portable-content/series";
import { seriesRegistrySchema } from "@xpotato/content-contracts/series";
import { execFile as execFileCallback } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { articleRoute } from "@xpotato/content-contracts";
import type {
  ContentCollection,
  InteractiveModuleRecord,
  TaxonomyRegistry,
  ToolBindingRecord,
} from "@xpotato/content-contracts";
import { validateWorkspaceDependencies } from "./dependencies.js";
import { validateVnextWranglerConfig } from "./delivery/deployment-config.js";
import { validateGitMediaChange } from "./git-media.js";
import { validatePortableMdx } from "./portable-mdx.js";
import {
  renderSecurityHeaderArtifact,
  validateSecurityHeaderArtifact,
} from "./delivery/security-headers.js";
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
  "packages/portable-content",
  "apps/editor",
  "apps/editor-api",
  "packages/editor-core",
  "packages/design-system",
  "content/registry",
  "tests/fixtures",
];
const errors: string[] = [];
const tracked = (await execFile("git", ["ls-files", "-z"], { cwd: root })).stdout
  .split("\0")
  .filter(Boolean);
for (const path of tracked) errors.push(...privateDraftOutputErrors(path));

for (const path of required) {
  await readdir(join(root, path)).catch(() =>
    errors.push(`Required workspace path missing: ${path}`),
  );
}

const siteDirectory = join(root, "apps/site");
const securityPolicy = renderSecurityHeaderArtifact({ scriptHashes: [], styleHashes: [] });
errors.push(
  ...validateSecurityHeaderArtifact(securityPolicy).map(
    (error) => `security header policy: ${error}`,
  ),
);

const gitAttributesSource = await readFile(join(root, ".gitattributes"), "utf8").catch(() => "");
const requiredGitAttributes = [
  ".gitattributes text eol=lf",
  "apps/site/public/_headers text eol=lf",
] as const;
if (gitAttributesSource === "")
  errors.push("Required deterministic checkout policy missing: .gitattributes");
else {
  const attributeLines = new Set(gitAttributesSource.split(/\r?\n/u).filter(Boolean));
  for (const line of requiredGitAttributes) {
    if (!attributeLines.has(line))
      errors.push(`.gitattributes missing deterministic LF rule: ${line}`);
  }
}

const vnextWranglerSource = await readFile(join(siteDirectory, "wrangler.jsonc"), "utf8").catch(
  () => "",
);
if (vnextWranglerSource === "")
  errors.push("Required vNext deploy config missing: apps/site/wrangler.jsonc");
else errors.push(...validateVnextWranglerConfig(vnextWranglerSource, siteDirectory));

const deployWorkflowSource = await readFile(
  join(root, ".github/workflows/deploy-site.yml"),
  "utf8",
).catch(() => "");
if (deployWorkflowSource === "")
  errors.push("Required blocked deploy workflow missing: .github/workflows/deploy-site.yml");
else {
  const { assertManualWorkflow } = (await import(
    pathToFileURL(join(root, "ops/deployment/manual-deployment-workflow-policy.mjs")).href
  )) as { assertManualWorkflow: (source: string) => boolean };
  try {
    assertManualWorkflow(deployWorkflowSource);
  } catch {
    errors.push(
      "deploy-site.yml must preserve the reviewed owner/main/manual/Environment/Production-artifact boundary",
    );
  }
}

for (const path of [
  "apps/site",
  "packages/content-contracts",
  "packages/article-pipeline",
  "packages/media-ingest",
  "packages/example-verifier",
  "packages/site-validators",
  "packages/portable-content",
]) {
  const manifest = JSON.parse(
    await readFile(join(root, path, "package.json"), "utf8"),
  ) as Parameters<typeof validateWorkspaceDependencies>[0];
  errors.push(...validateWorkspaceDependencies(manifest));
}

const walk = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ["node_modules", "dist", ".astro", ".vite"].includes(entry.name))
      continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
};

const contentCollections = [
  "blog",
  "notes",
  "projects",
  "tools",
  "pages",
] as const satisfies readonly ContentCollection[];
const contentRecords: ContentInvariantRecord[] = [];
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---/u;
const demoPattern = /<Demo\b[^>]*\bmodule=["']([^"']+)["'][^>]*\/?\s*>/gu;

for (const collection of contentCollections) {
  const directory = join(root, "content", collection === "blog" ? "articles" : collection);
  for (const file of await walk(directory)) {
    if (!/\.mdx?$/iu.test(file)) continue;
    const source = await readFile(file, "utf8");
    for (const problem of validatePortableMdx(source))
      errors.push(`${relative(root, file)}: ${problem}`);
    const match = frontmatterPattern.exec(source);
    if (!match?.[1]) {
      errors.push(`${relative(root, file)}: frontmatter missing`);
      continue;
    }
    const data = parseYaml(match[1]) as Record<string, unknown>;
    const relativePath = relative(directory, file).replaceAll("\\", "/");
    const slug = relativePath.slice(0, -extname(relativePath).length);
    const route =
      collection === "blog"
        ? articleRoute(String(data.id))
        : collection === "pages"
          ? slug === "index"
            ? "/"
            : `/${slug}/`
          : `/${collection}/${slug}/`;
    const interactiveModuleIds = [...source.matchAll(demoPattern)]
      .map((item) => item[1]!)
      .filter(Boolean);
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

// Current-tree policy: no permanent diff against the pre-migration commit.
const { readPreservedMediaInputs } = await import("./preserved-media-inputs.js");
const preserved = readPreservedMediaInputs(root);
for (const path of tracked) {
  if (preserved.paths.has(path)) continue;
  const decision = validateGitMediaChange({ kind: "A", path });
  if (!decision.allowed) errors.push(path + ": " + decision.reason);
}
const importModule = async <T>(repositoryPath: string): Promise<T> =>
  (await import(pathToFileURL(join(root, repositoryPath)).href)) as T;

const { taxonomyRegistry } = await importModule<{ taxonomyRegistry: TaxonomyRegistry }>(
  "content/registry/taxonomy/index.ts",
);
try {
  const seriesRegistry = seriesRegistrySchema.parse(
    JSON.parse(await readFile(join(root, "content/registry/series/series.json"), "utf8")),
  );
  errors.push(
    ...validateSeriesReferences(
      seriesRegistry,
      contentRecords.map((record) => record.contentId),
    ),
  );
} catch (error) {
  errors.push(`Series registry validation failed: ${String(error)}`);
}
const { mediaRegistries } = await importModule<{
  mediaRegistries: readonly MediaRegistryInvariantRecord[];
}>("content/registry/media/index.ts");
const { publicationProvenanceRegistry } = await importModule<{
  publicationProvenanceRegistry: readonly Readonly<{ contentId: string }>[];
}>("content/registry/provenance/index.ts");
const { interactiveModuleRegistry, toolBindings } = await importModule<{
  interactiveModuleRegistry: Readonly<Record<string, InteractiveModuleRecord>>;
  toolBindings: readonly ToolBindingRecord[];
}>("content/registry/interactive/index.ts");
const { interactiveComponentIds } = await importModule<{
  interactiveComponentIds: readonly string[];
}>("content/registry/interactive/component-ids.ts");
const { contentModuleRegistry } = await importModule<{
  contentModuleRegistry: readonly ContentModuleInvariantRecord[];
}>("content/registry/content-modules.ts");
const { siteConfig } = await importModule<{ siteConfig: { site: { canonicalOrigin: string } } }>(
  "apps/site/src/shared/lib/site-config.ts",
);
const { astroCanonicalOrigin } = await importModule<{ astroCanonicalOrigin: string }>(
  "apps/site/astro.config.mjs",
);

errors.push(
  ...validateRegistryInvariants({
    contents: contentRecords,
    mediaRegistries,
    provenanceContentIds: publicationProvenanceRegistry.map((record) => record.contentId),
    taxonomy: taxonomyRegistry,
    interactiveModules: interactiveModuleRegistry,
    toolBindings,
    interactiveComponentIds,
    contentModules: contentModuleRegistry,
  }),
);
if (siteConfig.site.canonicalOrigin !== "https://xpotato.net/") {
  errors.push(
    `site config canonical origin must be https://xpotato.net/: ${siteConfig.site.canonicalOrigin}`,
  );
}
if (astroCanonicalOrigin !== siteConfig.site.canonicalOrigin) {
  errors.push(
    `Astro/site config canonical origin mismatch: ${astroCanonicalOrigin} != ${siteConfig.site.canonicalOrigin}`,
  );
}

const { readPublicationHoldIds, assertPublicationHolds } =
  await import("@xpotato/portable-content/publication-holds");
const { readSiteContent } = await import("./site-content.js");
try {
  assertPublicationHolds(
    (await readSiteContent()).catalog,
    readPublicationHoldIds(
      JSON.parse(await readFile(join(root, "content/registry/publication-holds.json"), "utf8")),
    ),
  );
} catch (error) {
  errors.push(String(error));
}
try {
  const { validateEditorialProvenance } = await import("./editorial-provenance.js");
  const registry = JSON.parse(
    await readFile(join(root, "content/registry/editorial/provenance.json"), "utf8"),
  );
  const sources = new Map<string, string>();
  for (const row of registry.records) {
    if (
      typeof row.path !== "string" ||
      !/^content\/(notes|projects|tools|pages)\/[^/]+\.mdx$/.test(row.path)
    )
      throw Error("EDITORIAL_PATH_INVALID");
    sources.set(row.path, await readFile(join(root, row.path), "utf8"));
  }
  validateEditorialProvenance(registry, sources);
} catch (error) {
  errors.push(String(error));
}
if (errors.length > 0) throw new Error(`Repository validation failed:\n${errors.join("\n")}`);
console.log("Repository validation PASS");
