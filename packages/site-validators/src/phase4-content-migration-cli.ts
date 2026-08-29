import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  phase4ContentCandidateManifestSchema,
  phase4ContentCandidateSchema,
  phase4ContentIdentityMapSchema,
  type Phase4ContentCandidate,
  type Phase4ContentCandidateManifest,
  type Phase4ContentIdentityEntry,
  type Phase4ContentIdentityMap,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import {
  LEGACY_COMMIT,
  LEGACY_REPOSITORY,
  LEGACY_TAG,
  generateLegacyInventory,
  splitLegacyContentSource,
} from "./legacy-inventory.js";
import { validatePortableMdx } from "./portable-mdx.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const identityMapPath = join(repositoryRoot, "docs/migration/content-id-map-v1.json");
const candidateBaselinePath = join(repositoryRoot, "docs/migration/content-candidate-baseline-v1.json");
const localCandidateRoot = join(repositoryRoot, ".local/migration", LEGACY_TAG, "phase4", "content-candidates");
const expectedTagObjectSha = "8503f5a50a5fb3d27a02422da0b50dc66c818b02";
const expectedInventoryPayloadSha256 = "9151be197d9e48a12297d45dfdd2a72a15cf9ce16f143fdc16b60e5345d37493";
const allocationVersion = "legacy-content-id-v1" as const;
const candidateVersion = "legacy-portable-content-candidate-v1" as const;
const existingSameEntityBindings = new Map<string, string>([
  ["pages:about", "f3f79a24-4d24-449d-907c-f4ced4924b29"],
  ["tools:prime-factorizer", "bca48f98-c89a-457f-84d8-168f941fe469"],
]);
const existingSameEntityTargetPaths = new Map<string, string>([
  ["apps/site/src/content/pages/about.mdx", "pages:about"],
  ["apps/site/src/content/tools/prime-factorizer.mdx", "tools:prime-factorizer"],
]);

const allocateMode = process.argv.includes("--allocate");
const writeCandidatesMode = process.argv.includes("--write-candidates");
const checkMode = process.argv.includes("--check");
if ([allocateMode, writeCandidatesMode, checkMode].filter(Boolean).length !== 1) {
  throw new Error("Use exactly one of --allocate, --write-candidates, or --check");
}

const readJson = async (path: string): Promise<unknown | undefined> => {
  try { return JSON.parse(await readFile(path, "utf8")) as unknown; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const sourceIdentity = Object.freeze({
  repository: LEGACY_REPOSITORY,
  tag: LEGACY_TAG,
  tagObjectSha: expectedTagObjectSha,
  commitSha: LEGACY_COMMIT,
  inventoryPayloadSha256: expectedInventoryPayloadSha256,
});

const targetPathForLegacy = (legacyPath: string): string => {
  const match = /^src\/content\/(blog|notes|projects|tools|pages)\/(.+)\.(?:md|mdx)$/u.exec(legacyPath);
  if (!match?.[1] || !match[2]) throw new Error(`Unsupported legacy content path: ${legacyPath}`);
  return `apps/site/src/content/${match[1]}/${match[2]}.mdx`;
};

const mappingPayload = (entries: readonly Phase4ContentIdentityEntry[]): Omit<Phase4ContentIdentityMap, "mappingPayloadSha256"> => ({
  schemaVersion: 1,
  allocationVersion,
  source: sourceIdentity,
  entries: [...entries].sort((left, right) => compareCanonicalKeys(left.legacyContentId, right.legacyContentId)),
});

const createIdentityMap = (): Phase4ContentIdentityMap => {
  const inventory = generateLegacyInventory(repositoryRoot, { generatedAt: "2000-01-01T00:00:00.000Z" });
  if (inventory.inventoryPayloadSha256 !== expectedInventoryPayloadSha256) {
    throw new Error(`Frozen inventory identity changed: ${inventory.inventoryPayloadSha256}`);
  }
  const entries: Phase4ContentIdentityEntry[] = inventory.content.map((content) => ({
    legacyContentId: content.legacyContentId,
    legacyPath: content.legacyPath,
    collection: content.collection,
    targetPath: targetPathForLegacy(content.legacyPath),
    vNextContentId: existingSameEntityBindings.get(content.legacyContentId) ?? randomUUID(),
    disposition: "migrate",
  }));
  const payload = mappingPayload(entries);
  return phase4ContentIdentityMapSchema.parse({ ...payload, mappingPayloadSha256: fingerprint(payload) });
};

const loadIdentityMap = async (): Promise<Phase4ContentIdentityMap> => {
  const candidate = await readJson(identityMapPath);
  if (candidate === undefined) throw new Error(`Phase 4 ContentId map missing: ${identityMapPath}`);
  return phase4ContentIdentityMapSchema.parse(candidate);
};

const validateIdentityMap = async (mapping: Phase4ContentIdentityMap): Promise<readonly string[]> => {
  const errors: string[] = [];
  if (fingerprint(mappingPayload(mapping.entries)) !== mapping.mappingPayloadSha256) errors.push("mappingPayloadSha256 mismatch");
  if (fingerprint(mapping.source) !== fingerprint(sourceIdentity)) errors.push("frozen source identity mismatch");
  const inventory = generateLegacyInventory(repositoryRoot, { generatedAt: "2000-01-01T00:00:00.000Z" });
  const legacyIds = inventory.content.map((item) => item.legacyContentId).sort(compareCanonicalKeys);
  const mappedLegacyIds = mapping.entries.map((item) => item.legacyContentId).sort(compareCanonicalKeys);
  if (legacyIds.join("\0") !== mappedLegacyIds.join("\0")) errors.push("ContentId map must cover the exact frozen legacy content set");
  const unique = (values: readonly string[], label: string): void => {
    if (new Set(values).size !== values.length) errors.push(`${label} must be globally unique`);
  };
  unique(mapping.entries.map((item) => item.vNextContentId), "vNext ContentIds");
  unique(mapping.entries.map((item) => item.legacyContentId), "LegacyContentIds");
  unique(mapping.entries.map((item) => item.legacyPath), "legacy paths");
  unique(mapping.entries.map((item) => item.targetPath), "target paths");
  for (const entry of mapping.entries) {
    if (entry.targetPath !== targetPathForLegacy(entry.legacyPath)) errors.push(`target path is not a pure path migration for ${entry.legacyContentId}`);
    if (entry.disposition !== "migrate") errors.push(`Phase 4 baseline does not authorize non-migrate disposition for ${entry.legacyContentId}`);
  }
  const existingContent = await currentVNextContentRecords();
  for (const entry of mapping.entries) {
    const currentAtTarget = existingContent.byPath.get(entry.targetPath);
    const expectedSameEntity = existingSameEntityBindings.get(entry.legacyContentId);
    if (currentAtTarget) {
      const expectedLegacyId = existingSameEntityTargetPaths.get(entry.targetPath);
      if (expectedLegacyId !== entry.legacyContentId || expectedSameEntity !== currentAtTarget) {
        errors.push(`target path already contains a different vNext entity: ${entry.targetPath}`);
      }
      if (entry.vNextContentId !== currentAtTarget) {
        errors.push(`same-entity migration must reuse current ContentId at ${entry.targetPath}`);
      }
    } else if (expectedSameEntity) {
      errors.push(`expected existing same-entity binding disappeared for ${entry.legacyContentId}`);
    }
    const currentPathForId = existingContent.byId.get(entry.vNextContentId);
    if (currentPathForId && currentPathForId !== entry.targetPath) {
      errors.push(`allocated ContentId collides with another current vNext entity: ${entry.vNextContentId}`);
    }
  }
  return errors;
};

const walk = async (directory: string): Promise<string[]> => {
  const result: string[] = [];
  for (const item of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const path = join(directory, item.name);
    if (item.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result;
};

const currentVNextContentRecords = async (): Promise<Readonly<{ byPath: ReadonlyMap<string, string>; byId: ReadonlyMap<string, string> }>> => {
  const base = join(repositoryRoot, "apps/site/src/content");
  const files = (await walk(base)).filter((path) => [".md", ".mdx"].includes(extname(path)));
  const byPath = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const path of files) {
    const repositoryPath = relative(repositoryRoot, path).replaceAll("\\", "/");
    const bytes = await readFile(path);
    const { data } = splitLegacyContentSource(bytes, repositoryPath);
    if (typeof data.id !== "string") continue;
    byPath.set(repositoryPath, data.id);
    byId.set(data.id, repositoryPath);
  }
  return { byPath, byId };
};

const readLegacyBlob = (legacyPath: string): Buffer => {
  return execFileSync("git", ["cat-file", "blob", `${LEGACY_COMMIT}:${legacyPath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
  });
};

const metadataValue = (value: unknown): string | number | boolean | Array<string | number | boolean> | undefined => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (["string", "number", "boolean"].includes(typeof value)) return value as string | number | boolean;
  if (Array.isArray(value)) {
    const mapped = value.map(metadataValue);
    if (mapped.every((item) => item !== undefined && !Array.isArray(item))) return mapped as Array<string | number | boolean>;
  }
  return undefined;
};

const pickMetadata = (data: Readonly<Record<string, unknown>>, fields: readonly string[]): Record<string, string | number | boolean | Array<string | number | boolean>> => {
  const result: Record<string, string | number | boolean | Array<string | number | boolean>> = {};
  for (const field of fields) {
    const value = metadataValue(data[field]);
    if (value !== undefined) result[field] = value;
  }
  return result;
};

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" ? [value] : [];

const taxonomyFor = (collection: Phase4ContentIdentityEntry["collection"], data: Readonly<Record<string, unknown>>): Record<string, string[]> => {
  if (collection === "blog") return { category: stringArray(data.category), tags: stringArray(data.tags) };
  if (collection === "notes") return { subject: stringArray(data.subject), tags: stringArray(data.tags) };
  if (collection === "projects") return { tags: stringArray(data.tags), technologies: stringArray(data.technologies) };
  if (collection === "tools") return { category: stringArray(data.category), tags: stringArray(data.tags) };
  return {};
};

const stableFieldsFor = (collection: Phase4ContentIdentityEntry["collection"], data: Readonly<Record<string, unknown>>): Record<string, string | number | boolean | Array<string | number | boolean>> => {
  const common = ["title", "description", "pubDate", "updatedDate", "draft"] as const;
  if (collection === "projects") {
    return pickMetadata(data, [...common, "summary", "status", "repoUrl", "demoUrl", "showRepoLink", "confidential", "featured", "featuredOrder"]);
  }
  if (collection === "tools") return pickMetadata(data, [...common, "summary", "featured", "legacyPath"]);
  if (collection === "blog") return pickMetadata(data, [...common, "legacyPath"]);
  if (collection === "pages") return pickMetadata(data, [...common, "summary"]);
  return pickMetadata(data, common);
};

const buildCandidateManifest = async (mapping: Phase4ContentIdentityMap, writeLocalBodies: boolean): Promise<Phase4ContentCandidateManifest> => {
  const inventory = generateLegacyInventory(repositoryRoot, { generatedAt: "2000-01-01T00:00:00.000Z" });
  const contentById = new Map(inventory.content.map((item) => [item.legacyContentId, item]));
  const htmlById = new Map(inventory.legacyHtml.map((item) => [item.contentId, item]));
  const candidates: Phase4ContentCandidate[] = [];
  if (writeLocalBodies) await mkdir(localCandidateRoot, { recursive: true });
  for (const entry of mapping.entries) {
    const inventoryRecord = contentById.get(entry.legacyContentId);
    if (!inventoryRecord) throw new Error(`Missing inventory record for ${entry.legacyContentId}`);
    const sourceBytes = readLegacyBlob(entry.legacyPath);
    const { bodySource, data } = splitLegacyContentSource(sourceBytes, entry.legacyPath);
    const title = data.title;
    const description = data.description;
    if (typeof title !== "string" || title.length === 0) throw new Error(`${entry.legacyPath}: title missing`);
    if (typeof description !== "string" || description.length === 0) throw new Error(`${entry.legacyPath}: description missing`);
    const deferredTaxonomy = taxonomyFor(entry.collection, data);
    const taxonomyPending = Object.values(deferredTaxonomy).some((values) => values.length > 0);
    const html = htmlById.get(entry.legacyContentId);
    const legacyHtmlStatus = html
      ? html.extractionStatus === "static" ? "static_manual_review" as const : "blocked_manual_review" as const
      : "none" as const;
    const validationErrors = validatePortableMdx(bodySource);
    const bodyStatus = legacyHtmlStatus !== "none"
      ? "manual_review" as const
      : validationErrors.length === 0
        ? "portable_as_is" as const
        : "requires_semantic_conversion" as const;
    const body = bodyStatus === "portable_as_is"
      ? { sourceBodySha256: inventoryRecord.bodySha256, status: bodyStatus, candidateBodySha256: sha256(bodySource), validationErrors: [] }
      : { sourceBodySha256: inventoryRecord.bodySha256, status: bodyStatus, validationErrors: [...validationErrors].sort(compareCanonicalKeys) };
    const blockers = new Set<Phase4ContentCandidate["blockers"][number]>();
    if (taxonomyPending) blockers.add("taxonomy_mapping");
    if (inventoryRecord.referencedMediaPaths.length > 0) blockers.add("media_mapping");
    if (inventoryRecord.referencedInteractiveComponents.length > 0) blockers.add("interactive_mapping");
    if (legacyHtmlStatus !== "none") blockers.add("legacy_html_review");
    if (bodyStatus === "requires_semantic_conversion") blockers.add("semantic_mdx_conversion");
    if (entry.collection === "projects") blockers.add("project_metadata_review");
    const core = {
      candidateVersion,
      legacyContentId: entry.legacyContentId,
      vNextContentId: entry.vNextContentId,
      legacyPath: entry.legacyPath,
      targetPath: entry.targetPath,
      collection: entry.collection,
      title,
      description,
      draft: inventoryRecord.draft,
      stableEditorialFields: stableFieldsFor(entry.collection, data),
      deferredTaxonomy,
      deferredMediaLocators: [...inventoryRecord.referencedMediaPaths].sort(compareCanonicalKeys),
      deferredInteractiveComponents: [...inventoryRecord.referencedInteractiveComponents].sort(compareCanonicalKeys),
      legacyHtmlStatus,
      body,
      blockers: [...blockers].sort(compareCanonicalKeys),
    } as const;
    const candidate = phase4ContentCandidateSchema.parse({
      ...core,
      candidatePayloadSha256: fingerprint(core),
    });
    candidates.push(candidate);
    if (writeLocalBodies) {
      const relativePath = entry.targetPath.replace(/^apps\/site\/src\/content\//u, "");
      const output = join(localCandidateRoot, relativePath);
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, bodySource, "utf8");
    }
  }
  const sorted = candidates.sort((left, right) => compareCanonicalKeys(left.legacyContentId, right.legacyContentId));
  const payload = {
    schemaVersion: 1 as const,
    candidateVersion,
    source: sourceIdentity,
    mappingPayloadSha256: mapping.mappingPayloadSha256,
    candidates: sorted,
  };
  return phase4ContentCandidateManifestSchema.parse({ ...payload, manifestPayloadSha256: fingerprint(payload) });
};

const candidatePayloadWithoutHash = (candidate: Phase4ContentCandidate): Omit<Phase4ContentCandidate, "candidatePayloadSha256"> => {
  const { candidatePayloadSha256: _ignored, ...payload } = candidate;
  return payload;
};

const validateCandidateManifest = (manifest: Phase4ContentCandidateManifest, mapping: Phase4ContentIdentityMap): readonly string[] => {
  const errors: string[] = [];
  if (manifest.mappingPayloadSha256 !== mapping.mappingPayloadSha256) errors.push("candidate manifest mapping binding mismatch");
  if (fingerprint({ schemaVersion: manifest.schemaVersion, candidateVersion: manifest.candidateVersion, source: manifest.source, mappingPayloadSha256: manifest.mappingPayloadSha256, candidates: manifest.candidates }) !== manifest.manifestPayloadSha256) {
    errors.push("manifestPayloadSha256 mismatch");
  }
  const mapByLegacyId = new Map(mapping.entries.map((entry) => [entry.legacyContentId, entry]));
  if (manifest.candidates.length !== mapping.entries.length) errors.push("candidate manifest must cover every allocated content identity");
  const candidateIds = new Set<string>();
  for (const candidate of manifest.candidates) {
    const mappingEntry = mapByLegacyId.get(candidate.legacyContentId);
    if (!mappingEntry) errors.push(`candidate has no mapping: ${candidate.legacyContentId}`);
    else {
      if (candidate.vNextContentId !== mappingEntry.vNextContentId) errors.push(`candidate ContentId mismatch: ${candidate.legacyContentId}`);
      if (candidate.targetPath !== mappingEntry.targetPath) errors.push(`candidate target path mismatch: ${candidate.legacyContentId}`);
    }
    if (candidateIds.has(candidate.vNextContentId)) errors.push(`duplicate candidate ContentId: ${candidate.vNextContentId}`);
    candidateIds.add(candidate.vNextContentId);
    if (fingerprint(candidatePayloadWithoutHash(candidate)) !== candidate.candidatePayloadSha256) errors.push(`candidate payload hash mismatch: ${candidate.legacyContentId}`);
  }
  return errors;
};

if (allocateMode) {
  if (await readJson(identityMapPath) !== undefined) throw new Error("ContentId allocation map already exists; refusing to regenerate stable identities");
  const mapping = createIdentityMap();
  const errors = await validateIdentityMap(mapping);
  if (errors.length > 0) throw new Error(`Allocated ContentId map invalid:\n${errors.join("\n")}`);
  await mkdir(dirname(identityMapPath), { recursive: true });
  await writeFile(identityMapPath, `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
  console.log(`Phase 4 ContentId allocation PASS: ${mapping.entries.length} identities -> ${mapping.mappingPayloadSha256}`);
}

if (writeCandidatesMode) {
  const mapping = await loadIdentityMap();
  const mappingErrors = await validateIdentityMap(mapping);
  if (mappingErrors.length > 0) throw new Error(`ContentId map invalid:\n${mappingErrors.join("\n")}`);
  const manifest = await buildCandidateManifest(mapping, true);
  const candidateErrors = validateCandidateManifest(manifest, mapping);
  if (candidateErrors.length > 0) throw new Error(`Phase 4 candidate manifest invalid:\n${candidateErrors.join("\n")}`);
  await writeFile(candidateBaselinePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Phase 4 candidate generation PASS: ${manifest.candidates.length} candidates -> ${manifest.manifestPayloadSha256}`);
}

if (checkMode) {
  const mapping = await loadIdentityMap();
  const mappingErrors = await validateIdentityMap(mapping);
  const baselineCandidate = await readJson(candidateBaselinePath);
  if (baselineCandidate === undefined) throw new Error(`Phase 4 candidate baseline missing: ${candidateBaselinePath}`);
  const baseline = phase4ContentCandidateManifestSchema.parse(baselineCandidate);
  const regenerated = await buildCandidateManifest(mapping, false);
  const candidateErrors = validateCandidateManifest(baseline, mapping);
  const errors = [...mappingErrors, ...candidateErrors];
  if (JSON.stringify(regenerated) !== JSON.stringify(baseline)) errors.push("committed Phase 4 candidate baseline differs from exact frozen-source regeneration");
  if (errors.length > 0) throw new Error(`Phase 4 content migration check failed:\n${errors.join("\n")}`);
  const blockerCounts = baseline.candidates.flatMap((candidate) => candidate.blockers).reduce<Record<string, number>>((counts, blocker) => {
    counts[blocker] = (counts[blocker] ?? 0) + 1;
    return counts;
  }, {});
  const portableCount = baseline.candidates.filter((candidate) => candidate.body.status === "portable_as_is").length;
  console.log(`Phase 4 content migration PASS: ${mapping.entries.length} stable ContentIds; ${portableCount} portable-as-is bodies; blockers=${JSON.stringify(blockerCounts)}`);
}
