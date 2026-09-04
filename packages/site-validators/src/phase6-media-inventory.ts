import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  phase4ContentMaterializationManifestSchema,
  phase6MediaRawInventorySchema,
  phase6MediaRawRecordSchema,
  type Phase6MediaContentBinding,
  type Phase6MediaRawInventory,
  type Phase6MediaRawRecord,
  type Phase6MediaReferenceKind,
  type Phase6MediaRoleHint,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint } from "@xpotato/content-contracts/canonical";
import {
  generateLegacyInventory,
  LEGACY_COMMIT,
  splitLegacyContentSource,
} from "./legacy-inventory.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const materializationManifestPath = join(repositoryRoot, "docs/migration/content-materialization-v1.json");
export const phase6MediaRawInventoryPath = join(repositoryRoot, "docs/migration/media-raw-inventory-v1.json");
const inventoryVersion = "legacy-media-raw-v1" as const;

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;
const sortStrings = (values: Iterable<string>): string[] => [...values].sort(compareCanonicalKeys);

const readLegacyBlob = (repositoryPath: string): Buffer =>
  execFileSync("git", ["cat-file", "blob", `${LEGACY_COMMIT}:${repositoryPath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
  });

const mediaFieldKinds = [
  ["heroImage", "frontmatter_hero_image"],
  ["ogImage", "frontmatter_og_image"],
  ["coverImage", "frontmatter_cover_image"],
  ["overviewImage", "frontmatter_overview_image"],
  ["previewImage", "frontmatter_preview_image"],
] as const satisfies readonly (readonly [string, Phase6MediaReferenceKind])[];

export const phase6RoleHintsForReferenceKinds = (
  kinds: readonly Phase6MediaReferenceKind[],
): Phase6MediaRoleHint[] => {
  const hints = new Set<Phase6MediaRoleHint>();
  for (const kind of kinds) {
    if (kind === "frontmatter_hero_image") hints.add("hero");
    else if (kind === "frontmatter_og_image") hints.add("social_card");
    else if (kind === "frontmatter_overview_image") hints.add("overview");
    else if (kind === "body_reference") hints.add("inline");
    else hints.add("unresolved");
  }
  return sortStrings(hints) as Phase6MediaRoleHint[];
};

const referenceKindsFor = (legacyPath: string, locator: string): Phase6MediaReferenceKind[] => {
  const source = readLegacyBlob(legacyPath);
  const { data, bodySource } = splitLegacyContentSource(source, legacyPath);
  const kinds = new Set<Phase6MediaReferenceKind>();
  for (const [field, kind] of mediaFieldKinds) {
    if (data[field] === locator) kinds.add(kind);
  }
  if (bodySource.includes(locator)) kinds.add("body_reference");
  if (kinds.size === 0) {
    throw new Error(`${legacyPath}: deferred media locator has no exact source reference context: ${locator}`);
  }
  return sortStrings(kinds) as Phase6MediaReferenceKind[];
};

const resolveRepositoryMediaPath = (
  locator: string,
  contentPath: string,
  verifiedRepositoryPaths: ReadonlySet<string>,
): string | undefined => {
  if (/^(?:r2:|https?:)/iu.test(locator)) return undefined;
  const withoutSuffix = locator.split(/[?#]/u, 1)[0] ?? locator;
  const candidates = new Set<string>();
  if (withoutSuffix.startsWith("/")) candidates.add(`public${withoutSuffix}`);
  if (withoutSuffix.startsWith("public/")) candidates.add(withoutSuffix);
  candidates.add(posix.normalize(posix.join(posix.dirname(contentPath), withoutSuffix)));
  candidates.add(`public/${withoutSuffix.replace(/^\.\//u, "")}`);
  return [...candidates].find((candidate) => verifiedRepositoryPaths.has(candidate));
};

interface DeferredLocatorEvidence {
  repositoryPath?: string;
  bindings: Phase6MediaContentBinding[];
}

export const buildPhase6MediaRawInventory = async (): Promise<Phase6MediaRawInventory> => {
  const materialization = phase4ContentMaterializationManifestSchema.parse(await readJson(materializationManifestPath));
  const legacyInventory = generateLegacyInventory(repositoryRoot, { generatedAt: "2000-01-01T00:00:00.000Z" });
  if (legacyInventory.inventoryPayloadSha256 !== materialization.source.inventoryPayloadSha256) {
    throw new Error("Phase 6 legacy inventory is not bound to the accepted Phase 4 source identity");
  }

  const verifiedRepositoryPaths = new Set(
    legacyInventory.media
      .filter((record) => record.verificationStatus === "git_verified")
      .map((record) => record.legacyPath),
  );
  const deferredByLocator = new Map<string, DeferredLocatorEvidence>();
  let mediaPendingContentCount = 0;
  for (const materializationRecord of materialization.records) {
    const locators = materializationRecord.deferredMediaLocators;
    const expectsMediaPhase = materializationRecord.remainingPhases.includes("media_phase6");
    if ((locators.length > 0) !== expectsMediaPhase) {
      throw new Error(`${materializationRecord.legacyContentId}: media_phase6 flag does not exactly match deferred media locators`);
    }
    if (locators.length === 0) continue;
    mediaPendingContentCount += 1;
    for (const locator of locators) {
      const referenceKinds = referenceKindsFor(materializationRecord.legacyPath, locator);
      const binding: Phase6MediaContentBinding = {
        legacyContentId: materializationRecord.legacyContentId,
        vNextContentId: materializationRecord.vNextContentId,
        targetPath: materializationRecord.targetPath,
        referenceKinds,
        roleHints: phase6RoleHintsForReferenceKinds(referenceKinds),
      };
      const repositoryPath = resolveRepositoryMediaPath(locator, materializationRecord.legacyPath, verifiedRepositoryPaths);
      const existing = deferredByLocator.get(locator);
      if (existing && existing.repositoryPath !== repositoryPath) {
        throw new Error(`Phase 6 locator resolves inconsistently across content: ${locator}`);
      }
      const entry = existing ?? { ...(repositoryPath ? { repositoryPath } : {}), bindings: [] };
      entry.bindings.push(binding);
      deferredByLocator.set(locator, entry);
    }
  }

  const legacyMediaByPath = new Map(legacyInventory.media.map((record) => [record.legacyPath, record]));
  const matchedLegacyInventoryPaths = new Set<string>();
  const records: Phase6MediaRawRecord[] = [];
  for (const locator of sortStrings(deferredByLocator.keys())) {
    const evidence = deferredByLocator.get(locator);
    if (!evidence) throw new Error(`Phase 6 deferred locator evidence missing: ${locator}`);
    const bindings = [...evidence.bindings].sort((left, right) => compareCanonicalKeys(left.legacyContentId, right.legacyContentId));
    const inventoryPath = evidence.repositoryPath ?? locator;
    const legacyRecord = legacyMediaByPath.get(inventoryPath);
    if (!legacyRecord || bindings.length === 0) {
      throw new Error(`Phase 6 media inventory record missing for ${locator} -> ${inventoryPath}`);
    }
    if (evidence.repositoryPath && legacyRecord.verificationStatus !== "git_verified") {
      throw new Error(`Phase 6 verified repository path resolved to non-verified record: ${locator}`);
    }
    if (!evidence.repositoryPath && legacyRecord.verificationStatus !== "unresolved_non_local") {
      throw new Error(`Phase 6 unresolved locator unexpectedly resolves to Git media: ${locator}`);
    }
    matchedLegacyInventoryPaths.add(inventoryPath);
    const bindingIds = bindings.map((binding) => binding.legacyContentId);
    if (bindingIds.join("\0") !== sortStrings(legacyRecord.referencedByContentIds).join("\0")) {
      throw new Error(`Phase 6 content binding mismatch for ${locator}`);
    }
    const base = {
      legacyLocator: locator,
      likelyOrigin: legacyRecord.likelyOrigin,
      referencedByLegacyContentIds: bindingIds,
      contentBindings: bindings,
      rightsReviewStatus: "pending_human_review" as const,
      publicationStatus: "blocked" as const,
    };
    const core = legacyRecord.verificationStatus === "git_verified"
      ? {
          ...base,
          verificationStatus: "git_verified" as const,
          repositoryPath: legacyRecord.legacyPath,
          sourceFileSha256: legacyRecord.sourceFileSha256,
          sizeBytes: legacyRecord.sizeBytes,
          detectedFormat: legacyRecord.detectedFormat,
          ...(legacyRecord.width ? { width: legacyRecord.width } : {}),
          ...(legacyRecord.height ? { height: legacyRecord.height } : {}),
        }
      : {
          ...base,
          verificationStatus: "unresolved_non_local" as const,
          unresolvedReason: legacyRecord.reason,
        };
    records.push(phase6MediaRawRecordSchema.parse({ ...core, recordPayloadSha256: fingerprint(core) }));
  }

  const referencedInventoryPaths = legacyInventory.media
    .filter((record) => record.referencedByContentIds.length > 0)
    .map((record) => record.legacyPath);
  const unmatchedReferencedInventoryPaths = sortStrings(
    referencedInventoryPaths.filter((path) => !matchedLegacyInventoryPaths.has(path)),
  );
  if (unmatchedReferencedInventoryPaths.length > 0) {
    throw new Error(`Phase 6 omitted referenced legacy media inventory records: ${unmatchedReferencedInventoryPaths.join(",")}`);
  }

  const payload = {
    schemaVersion: 1 as const,
    inventoryVersion,
    source: materialization.source,
    phase4MaterializationManifestPayloadSha256: materialization.manifestPayloadSha256,
    legacyInventoryPayloadSha256: legacyInventory.inventoryPayloadSha256,
    sourceContentCount: materialization.records.length,
    mediaPendingContentCount,
    uniqueLocatorCount: records.length,
    gitVerifiedLocatorCount: records.filter((record) => record.verificationStatus === "git_verified").length,
    unresolvedLocatorCount: records.filter((record) => record.verificationStatus === "unresolved_non_local").length,
    records,
  };
  return phase6MediaRawInventorySchema.parse({ ...payload, manifestPayloadSha256: fingerprint(payload) });
};

export const writePhase6MediaRawInventory = async (): Promise<Phase6MediaRawInventory> => {
  const inventory = await buildPhase6MediaRawInventory();
  await writeFile(phase6MediaRawInventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  return inventory;
};

export const checkPhase6MediaRawInventory = async (): Promise<Phase6MediaRawInventory> => {
  const expected = await buildPhase6MediaRawInventory();
  const committed = phase6MediaRawInventorySchema.parse(await readJson(phase6MediaRawInventoryPath));
  if (JSON.stringify(committed) !== JSON.stringify(expected)) {
    throw new Error("Committed Phase 6 media raw inventory differs from exact frozen-source regeneration");
  }
  return committed;
};
