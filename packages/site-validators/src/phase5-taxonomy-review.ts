import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  phase5TaxonomyRawInventorySchema,
  phase5TaxonomyReviewManifestSchema,
  type Phase5TaxonomyRawInventory,
  type Phase5TaxonomyReviewManifest,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint } from "@xpotato/content-contracts/canonical";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const rawInventoryPath = join(repositoryRoot, "docs/migration/taxonomy-raw-inventory-v1.json");
export const phase5TaxonomyReviewPath = join(repositoryRoot, "docs/migration/taxonomy-review-v1.json");

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;
const identity = (namespace: string, rawValue: string): string => `${namespace}\0${rawValue}`;

const reviewPayload = (review: Phase5TaxonomyReviewManifest): Omit<Phase5TaxonomyReviewManifest, "reviewPayloadSha256"> => ({
  schemaVersion: review.schemaVersion,
  reviewVersion: review.reviewVersion,
  rawInventoryManifestPayloadSha256: review.rawInventoryManifestPayloadSha256,
  decisions: review.decisions,
  canonicalTags: review.canonicalTags,
});

export const loadPhase5TaxonomyReview = async (): Promise<Readonly<{
  rawInventory: Phase5TaxonomyRawInventory;
  review: Phase5TaxonomyReviewManifest;
}>> => {
  const rawInventory = phase5TaxonomyRawInventorySchema.parse(await readJson(rawInventoryPath));
  const review = phase5TaxonomyReviewManifestSchema.parse(await readJson(phase5TaxonomyReviewPath));
  if (review.rawInventoryManifestPayloadSha256 !== rawInventory.manifestPayloadSha256) {
    throw new Error("Phase 5 taxonomy review is not bound to the current raw inventory");
  }
  if (fingerprint(reviewPayload(review)) !== review.reviewPayloadSha256) {
    throw new Error("Phase 5 taxonomy review payload hash mismatch");
  }

  const rawIdentities = rawInventory.terms.map((term) => identity(term.namespace, term.rawValue)).sort(compareCanonicalKeys);
  const decisionIdentities = review.decisions.map((decision) => identity(decision.namespace, decision.rawValue)).sort(compareCanonicalKeys);
  if (rawIdentities.join("\0") !== decisionIdentities.join("\0")) {
    throw new Error("Phase 5 taxonomy review must explicitly disposition every exact raw term and no others");
  }

  const tagById = new Map(review.canonicalTags.map((tag) => [tag.id, tag]));
  const rawByIdentity = new Map(rawInventory.terms.map((term) => [identity(term.namespace, term.rawValue), term]));
  const targetedTagIds = new Set<string>();
  const aliasOwners = new Map<string, string>();
  for (const tag of review.canonicalTags) {
    if (tag.status !== "active") throw new Error(`Phase 5 migration canonical tag must be active: ${tag.id}`);
    if (tag.indexable && !tag.archive) throw new Error(`Indexable Phase 5 tag must have archive=true: ${tag.id}`);
    for (const alias of tag.aliases) {
      const normalizedAlias = alias.normalize("NFKC").trim().toLowerCase();
      const previous = aliasOwners.get(normalizedAlias);
      if (previous && previous !== tag.id) throw new Error(`Ambiguous taxonomy alias ${alias}: ${previous} / ${tag.id}`);
      aliasOwners.set(normalizedAlias, tag.id);
    }
  }

  for (const decision of review.decisions) {
    const term = rawByIdentity.get(identity(decision.namespace, decision.rawValue));
    if (!term) throw new Error(`Unexpected taxonomy review decision: ${decision.namespace}:${decision.rawValue}`);
    if (decision.namespace === "tag") {
      if (decision.disposition === "retire") {
        if (term.requiresTechnologyKind) throw new Error(`Project technology term cannot be retired: ${decision.rawValue}`);
      } else {
        const tag = tagById.get(decision.targetId ?? "");
        if (!tag) throw new Error(`Taxonomy target tag missing: ${decision.rawValue} -> ${decision.targetId}`);
        targetedTagIds.add(tag.id);
        if (term.requiresTechnologyKind && tag.kind !== "technology") {
          throw new Error(`Project technology must resolve to kind=technology: ${decision.rawValue} -> ${tag.id}`);
        }
        if (decision.disposition === "alias" && !tag.aliases.includes(decision.rawValue)) {
          throw new Error(`Alias decision must be represented by target tag aliases: ${decision.rawValue} -> ${tag.id}`);
        }
      }
    } else if (decision.namespace === "blog_category") {
      const expected = decision.rawValue === "devlog"
        ? "software"
        : decision.rawValue === "infra" || decision.rawValue === "network"
          ? "infrastructure"
          : decision.rawValue === "diary"
            ? "robotics"
            : undefined;
      if (!expected || decision.targetId !== expected) throw new Error(`Unexpected Blog category migration: ${decision.rawValue} -> ${decision.targetId}`);
      const expectedSupplemental = decision.rawValue === "network" ? ["network"] : [];
      if ([...decision.supplementalTagIds].sort(compareCanonicalKeys).join("\0") !== expectedSupplemental.join("\0")) {
        throw new Error(`Unexpected Blog category supplemental tags for ${decision.rawValue}`);
      }
    } else if (decision.namespace === "note_subject") {
      if (decision.rawValue !== "infrastructure" || decision.targetId !== "infrastructure") {
        throw new Error(`Unexpected Note subject migration: ${decision.rawValue} -> ${decision.targetId}`);
      }
    } else if (decision.namespace === "tool_category") {
      if (decision.rawValue !== "calculation" || decision.targetId !== "calculation") {
        throw new Error(`Unexpected Tool category migration: ${decision.rawValue} -> ${decision.targetId}`);
      }
    }
    for (const tagId of decision.supplementalTagIds) targetedTagIds.add(tagId);
  }

  const orphanTags = review.canonicalTags.map((tag) => tag.id).filter((tagId) => !targetedTagIds.has(tagId));
  if (orphanTags.length > 0) throw new Error(`Phase 5 review defines unreferenced migration tags: ${orphanTags.join(", ")}`);
  return { rawInventory, review };
};

export const checkPhase5TaxonomyReview = async (): Promise<Phase5TaxonomyReviewManifest> => {
  const { review } = await loadPhase5TaxonomyReview();
  return review;
};
