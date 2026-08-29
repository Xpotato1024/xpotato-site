import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  phase4ContentCandidateManifestSchema,
  phase4ContentMaterializationManifestSchema,
  phase5TaxonomyRawInventorySchema,
  type Phase4ContentCandidate,
  type Phase5TaxonomyNamespace,
  type Phase5TaxonomyRawInventory,
  type Phase5TaxonomyUsageKind,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint } from "@xpotato/content-contracts/canonical";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const candidateManifestPath = join(repositoryRoot, "docs/migration/content-candidate-baseline-v1.json");
const materializationManifestPath = join(repositoryRoot, "docs/migration/content-materialization-v1.json");
export const phase5TaxonomyRawInventoryPath = join(repositoryRoot, "docs/migration/taxonomy-raw-inventory-v1.json");
const inventoryVersion = "legacy-taxonomy-raw-v1" as const;

interface UsageAccumulator {
  occurrenceCount: number;
  affectedLegacyContentIds: Set<string>;
}

interface TermAccumulator {
  namespace: Phase5TaxonomyNamespace;
  rawValue: string;
  normalizedValue: string;
  usages: Map<Phase5TaxonomyUsageKind, UsageAccumulator>;
}

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;

export const normalizePhase5TaxonomyRawTerm = (value: string): string => {
  if (value.includes("\0")) throw new Error("Taxonomy raw term must not contain NUL");
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (normalized.length === 0) throw new Error("Taxonomy raw term becomes empty after normalization");
  return normalized;
};

const taxonomyUsageFor = (
  candidate: Phase4ContentCandidate,
): ReadonlyArray<Readonly<{ namespace: Phase5TaxonomyNamespace; usageKind: Phase5TaxonomyUsageKind; values: readonly string[] }>> => {
  const taxonomy = candidate.deferredTaxonomy;
  const entries = Object.entries(taxonomy).filter(([, values]) => values.length > 0);
  const expectedKeys = candidate.collection === "blog"
    ? new Set(["category", "tags"])
    : candidate.collection === "notes"
      ? new Set(["subject", "tags"])
      : candidate.collection === "projects"
        ? new Set(["tags", "technologies"])
        : candidate.collection === "tools"
          ? new Set(["category", "tags"])
          : new Set<string>();
  for (const [key] of entries) {
    if (!expectedKeys.has(key)) throw new Error(`${candidate.legacyContentId}: unexpected deferred taxonomy field ${key}`);
  }
  if (candidate.collection === "blog") return [
    { namespace: "blog_category", usageKind: "blog_category", values: taxonomy.category ?? [] },
    { namespace: "tag", usageKind: "blog_tag", values: taxonomy.tags ?? [] },
  ];
  if (candidate.collection === "notes") return [
    { namespace: "note_subject", usageKind: "note_subject", values: taxonomy.subject ?? [] },
    { namespace: "tag", usageKind: "note_tag", values: taxonomy.tags ?? [] },
  ];
  if (candidate.collection === "projects") return [
    { namespace: "tag", usageKind: "project_tag", values: taxonomy.tags ?? [] },
    { namespace: "tag", usageKind: "project_technology", values: taxonomy.technologies ?? [] },
  ];
  if (candidate.collection === "tools") return [
    { namespace: "tool_category", usageKind: "tool_category", values: taxonomy.category ?? [] },
    { namespace: "tag", usageKind: "tool_tag", values: taxonomy.tags ?? [] },
  ];
  if (entries.length > 0) throw new Error(`${candidate.legacyContentId}: pages must not carry deferred taxonomy`);
  return [];
};

const manifestPayload = (
  candidates: ReturnType<typeof phase4ContentCandidateManifestSchema.parse>,
  materialization: ReturnType<typeof phase4ContentMaterializationManifestSchema.parse>,
  terms: Phase5TaxonomyRawInventory["terms"],
  taxonomyPendingContentCount: number,
): Omit<Phase5TaxonomyRawInventory, "manifestPayloadSha256"> => ({
  schemaVersion: 1,
  inventoryVersion,
  source: candidates.source,
  mappingPayloadSha256: candidates.mappingPayloadSha256,
  candidateManifestPayloadSha256: candidates.manifestPayloadSha256,
  materializationManifestPayloadSha256: materialization.manifestPayloadSha256,
  sourceCandidateCount: candidates.candidates.length,
  taxonomyPendingContentCount,
  rawTermOccurrenceCount: terms.reduce((sum, term) => sum + term.occurrenceCount, 0),
  uniqueRawTermCount: terms.length,
  terms,
});

export const buildPhase5TaxonomyRawInventory = async (): Promise<Phase5TaxonomyRawInventory> => {
  const candidates = phase4ContentCandidateManifestSchema.parse(await readJson(candidateManifestPath));
  const materialization = phase4ContentMaterializationManifestSchema.parse(await readJson(materializationManifestPath));
  if (fingerprint(candidates.source) !== fingerprint(materialization.source)) throw new Error("Phase 4 candidate/materialization source identity mismatch");
  if (candidates.mappingPayloadSha256 !== materialization.mappingPayloadSha256) throw new Error("Phase 4 candidate/materialization mapping binding mismatch");
  if (candidates.manifestPayloadSha256 !== materialization.candidateManifestPayloadSha256) throw new Error("Phase 4 candidate/materialization manifest binding mismatch");

  const accumulators = new Map<string, TermAccumulator>();
  let taxonomyPendingContentCount = 0;
  for (const candidate of candidates.candidates) {
    const usageGroups = taxonomyUsageFor(candidate);
    const hasTaxonomy = usageGroups.some((usage) => usage.values.length > 0);
    const hasBlocker = candidate.blockers.includes("taxonomy_mapping");
    if (hasTaxonomy !== hasBlocker) throw new Error(`${candidate.legacyContentId}: taxonomy_mapping blocker does not match deferred taxonomy evidence`);
    if (hasTaxonomy) taxonomyPendingContentCount += 1;
    for (const usage of usageGroups) {
      for (const rawValue of usage.values) {
        const normalizedValue = normalizePhase5TaxonomyRawTerm(rawValue);
        const identity = `${usage.namespace}\0${rawValue}`;
        let term = accumulators.get(identity);
        if (!term) {
          term = { namespace: usage.namespace, rawValue, normalizedValue, usages: new Map() };
          accumulators.set(identity, term);
        } else if (term.normalizedValue !== normalizedValue) {
          throw new Error(`Taxonomy normalization changed within one raw identity: ${rawValue}`);
        }
        let usageAccumulator = term.usages.get(usage.usageKind);
        if (!usageAccumulator) {
          usageAccumulator = { occurrenceCount: 0, affectedLegacyContentIds: new Set() };
          term.usages.set(usage.usageKind, usageAccumulator);
        }
        usageAccumulator.occurrenceCount += 1;
        usageAccumulator.affectedLegacyContentIds.add(candidate.legacyContentId);
      }
    }
  }

  const terms = [...accumulators.values()].map((term) => {
    const usages = [...term.usages.entries()]
      .sort(([left], [right]) => compareCanonicalKeys(left, right))
      .map(([kind, usage]) => ({
        kind,
        occurrenceCount: usage.occurrenceCount,
        affectedLegacyContentIds: [...usage.affectedLegacyContentIds].sort(compareCanonicalKeys),
      }));
    const affectedLegacyContentIds = [...new Set(usages.flatMap((usage) => usage.affectedLegacyContentIds))].sort(compareCanonicalKeys);
    const core = {
      namespace: term.namespace,
      rawValue: term.rawValue,
      normalizedValue: term.normalizedValue,
      occurrenceCount: usages.reduce((sum, usage) => sum + usage.occurrenceCount, 0),
      usages,
      affectedLegacyContentIds,
      requiresTechnologyKind: usages.some((usage) => usage.kind === "project_technology"),
    } as const;
    return { ...core, termPayloadSha256: fingerprint(core) };
  }).sort((left, right) => compareCanonicalKeys(`${left.namespace}\0${left.rawValue}`, `${right.namespace}\0${right.rawValue}`));

  const payload = manifestPayload(candidates, materialization, terms, taxonomyPendingContentCount);
  return phase5TaxonomyRawInventorySchema.parse({ ...payload, manifestPayloadSha256: fingerprint(payload) });
};

export const writePhase5TaxonomyRawInventory = async (): Promise<Phase5TaxonomyRawInventory> => {
  const inventory = await buildPhase5TaxonomyRawInventory();
  await writeFile(phase5TaxonomyRawInventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  return inventory;
};

export const checkPhase5TaxonomyRawInventory = async (): Promise<Phase5TaxonomyRawInventory> => {
  const expected = await buildPhase5TaxonomyRawInventory();
  const committed = phase5TaxonomyRawInventorySchema.parse(await readJson(phase5TaxonomyRawInventoryPath));
  if (JSON.stringify(committed) !== JSON.stringify(expected)) {
    throw new Error("Committed Phase 5 raw taxonomy inventory differs from exact Phase 4 evidence regeneration");
  }
  return committed;
};
