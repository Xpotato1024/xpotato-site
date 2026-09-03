import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  phase4ContentMaterializationManifestSchema,
  phase6MediaRawInventorySchema,
  phase6MediaReviewProposalSchema,
  phase6MediaReviewDecisionSchema,
  type Phase6MediaAssetPlan,
  type Phase6MediaRawRecord,
  type Phase6MediaReviewDecision,
  type Phase6MediaReviewProposal,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint } from "@xpotato/content-contracts/canonical";
import { phase6MediaRawInventoryPath } from "./phase6-media-inventory.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const phase4MaterializationPath = join(repositoryRoot, "docs/migration/content-materialization-v1.json");
export const phase6MediaReviewProposalPath = join(repositoryRoot, "docs/migration/media-review-proposal-v1.json");
const reviewVersion = "legacy-media-review-proposal-v1" as const;

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;
const sortPlans = (plans: readonly Phase6MediaAssetPlan[]): Phase6MediaAssetPlan[] =>
  [...plans].sort((left, right) => compareCanonicalKeys(`${left.legacyContentId}\0${left.assetId}`, `${right.legacyContentId}\0${right.assetId}`));

const planForBinding = (
  record: Phase6MediaRawRecord,
  binding: Phase6MediaRawRecord["contentBindings"][number],
  input: Readonly<{
    assetId: string;
    role: "hero" | "inline" | "overview" | "social_card";
    sourceAction: "ingest_git_object" | "recover_nonlocal_source" | "generate_deterministic";
    ingestProfileId?: string;
    variantProfileId?: string;
    alsoUsedInline?: boolean;
  }>,
): Phase6MediaAssetPlan => ({
  legacyContentId: binding.legacyContentId,
  contentId: binding.vNextContentId,
  assetId: input.assetId,
  role: input.role,
  ...(input.alsoUsedInline ? { alsoUsedInline: true } : {}),
  sourceAction: input.sourceAction,
  ...(input.ingestProfileId ? { ingestProfileId: input.ingestProfileId } : {}),
  ...(input.variantProfileId ? { variantProfileId: input.variantProfileId } : {}),
});

const exactDecisionCore = (record: Phase6MediaRawRecord): Omit<Phase6MediaReviewDecision, "decisionPayloadSha256"> => {
  const bindings = record.contentBindings;
  const canonicalRaster = "canonical-raster-srgb8-lossless-webp-v1";

  if (record.legacyLocator === "/blog-placeholder-1.jpg") {
    return {
      legacyLocator: record.legacyLocator,
      disposition: "replace_with_deterministic_cover",
      mediaKindCandidate: "deterministic_cover",
      rightsBasisCandidate: "self_created",
      rightsReviewStatus: "pending_human_review",
      publicationAuthorized: false,
      assetPlans: sortPlans(bindings.map((binding) => planForBinding(record, binding, {
        assetId: "hero",
        role: "hero",
        sourceAction: "generate_deterministic",
        ingestProfileId: "diagram-svg-v1",
      }))),
      rationale: "missing_generic_placeholder",
    };
  }

  if (record.legacyLocator === "r2:/blog/my-first-post/GDCH3152.JPG") {
    if (bindings.length !== 1) throw new Error("vibration-robot nonlocal hero must bind exactly one content item");
    return {
      legacyLocator: record.legacyLocator,
      disposition: "recover_nonlocal_source",
      mediaKindCandidate: "photo",
      rightsBasisCandidate: "self_created",
      rightsReviewStatus: "pending_human_review",
      publicationAuthorized: false,
      assetPlans: [planForBinding(record, bindings[0]!, {
        assetId: "hero",
        role: "hero",
        alsoUsedInline: true,
        sourceAction: "recover_nonlocal_source",
        ingestProfileId: canonicalRaster,
        variantProfileId: "photo-hero-v1",
      })],
      rationale: "nonlocal_legacy_hero_source",
    };
  }

  if (record.verificationStatus !== "git_verified") {
    throw new Error(`Unclassified unresolved Phase 6 media locator: ${record.legacyLocator}`);
  }

  if (record.detectedFormat === "svg") {
    const plans = bindings.map((binding) => {
      const overview = binding.referenceKinds.includes("frontmatter_overview_image");
      const cover = binding.referenceKinds.includes("frontmatter_cover_image") || binding.referenceKinds.includes("frontmatter_preview_image");
      if (overview === cover) throw new Error(`SVG media role is ambiguous: ${record.legacyLocator}`);
      return planForBinding(record, binding, {
        assetId: overview ? "overview" : "hero",
        role: overview ? "overview" : "hero",
        sourceAction: "ingest_git_object",
        ingestProfileId: "diagram-svg-v1",
      });
    });
    return {
      legacyLocator: record.legacyLocator,
      disposition: "migrate_existing",
      mediaKindCandidate: "diagram",
      rightsBasisCandidate: "self_created",
      rightsReviewStatus: "pending_human_review",
      publicationAuthorized: false,
      assetPlans: sortPlans(plans),
      rationale: "verified_svg_content_asset",
    };
  }

  if (record.likelyOrigin === "project") {
    const plans = bindings.map((binding) => {
      if (!binding.referenceKinds.includes("frontmatter_overview_image")) {
        throw new Error(`Project raster is not an overview reference: ${record.legacyLocator}`);
      }
      return planForBinding(record, binding, {
        assetId: "overview",
        role: "overview",
        sourceAction: "ingest_git_object",
        ingestProfileId: canonicalRaster,
        variantProfileId: "project-overview-v1",
      });
    });
    return {
      legacyLocator: record.legacyLocator,
      disposition: "migrate_existing",
      mediaKindCandidate: "screenshot",
      rightsBasisCandidate: "self_created",
      rightsReviewStatus: "pending_human_review",
      publicationAuthorized: false,
      assetPlans: sortPlans(plans),
      rationale: "project_overview_candidate",
    };
  }

  if (record.legacyLocator === "/wp-content/uploads/2025/10/19EBD197-78A0-4E6A-82A4-7365DF22AF13.png") {
    if (bindings.length !== 1) throw new Error("ConoHa screenshot must bind exactly one content item");
    return {
      legacyLocator: record.legacyLocator,
      disposition: "replace_with_deterministic_diagram",
      mediaKindCandidate: "diagram",
      rightsBasisCandidate: "self_created",
      rightsReviewStatus: "pending_human_review",
      publicationAuthorized: false,
      assetPlans: [planForBinding(record, bindings[0]!, {
        assetId: "inline-01",
        role: "inline",
        sourceAction: "generate_deterministic",
        ingestProfileId: "diagram-svg-v1",
      })],
      rationale: "third_party_ui_replaced_with_deterministic_diagram",
    };
  }

  const vibrationInlineAssetIds = new Map([
    ["/wp-content/uploads/2025/09/img_7.jpg", "inline-01"],
    ["/wp-content/uploads/2025/09/img_9.png", "inline-02"],
    ["/wp-content/uploads/2025/09/img_8.png", "inline-03"],
  ]);
  const vibrationAssetId = vibrationInlineAssetIds.get(record.legacyLocator);
  if (vibrationAssetId) {
    if (bindings.length !== 1 || !bindings[0]!.referenceKinds.includes("body_reference")) {
      throw new Error(`Vibration robot photo binding mismatch: ${record.legacyLocator}`);
    }
    return {
      legacyLocator: record.legacyLocator,
      disposition: "migrate_existing",
      mediaKindCandidate: "photo",
      rightsBasisCandidate: "self_created",
      rightsReviewStatus: "pending_human_review",
      publicationAuthorized: false,
      assetPlans: [planForBinding(record, bindings[0]!, {
        assetId: vibrationAssetId,
        role: "inline",
        sourceAction: "ingest_git_object",
        ingestProfileId: canonicalRaster,
        variantProfileId: "photo-inline-v1",
      })],
      rationale: "legacy_photo_candidate",
    };
  }

  throw new Error(`No reviewed Phase 6 media proposal rule for ${record.legacyLocator}`);
};

const decisionFor = (record: Phase6MediaRawRecord): Phase6MediaReviewDecision => {
  const core = exactDecisionCore(record);
  return phase6MediaReviewDecisionSchema.parse({ ...core, decisionPayloadSha256: fingerprint(core) });
};

const proposalPayload = (proposal: Omit<Phase6MediaReviewProposal, "reviewPayloadSha256">): Omit<Phase6MediaReviewProposal, "reviewPayloadSha256"> => proposal;

export const buildPhase6MediaReviewProposal = async (): Promise<Phase6MediaReviewProposal> => {
  const rawInventory = phase6MediaRawInventorySchema.parse(await readJson(phase6MediaRawInventoryPath));
  const phase4 = phase4ContentMaterializationManifestSchema.parse(await readJson(phase4MaterializationPath));
  if (rawInventory.phase4MaterializationManifestPayloadSha256 !== phase4.manifestPayloadSha256) {
    throw new Error("Phase 6 media proposal is not bound to the accepted Phase 4 materialization");
  }

  const decisions = rawInventory.records.map(decisionFor).sort((left, right) => compareCanonicalKeys(left.legacyLocator, right.legacyLocator));
  if (decisions.length !== rawInventory.uniqueLocatorCount) throw new Error("Phase 6 proposal must disposition every raw media locator exactly once");
  const rawSet = rawInventory.records.map((record) => record.legacyLocator).sort(compareCanonicalKeys);
  const reviewSet = decisions.map((decision) => decision.legacyLocator).sort(compareCanonicalKeys);
  if (rawSet.join("\0") !== reviewSet.join("\0")) throw new Error("Phase 6 proposal raw locator set mismatch");

  const legacyHeroLocator = "r2:/blog/my-first-post/GDCH3152.JPG";
  const blogPublicationPlans = phase4.records
    .filter((record) => record.collection === "blog" && !record.sourceDraft)
    .map((record) => ({
      legacyContentId: record.legacyContentId,
      contentId: record.vNextContentId,
      targetPath: record.targetPath,
      hero: record.legacyContentId === "blog:vibration-robot"
        ? { assetId: "hero" as const, origin: "legacy_media" as const, sourceLocator: legacyHeroLocator }
        : { assetId: "hero" as const, origin: "deterministic_cover" as const },
      socialCard: { assetId: "social-card" as const, origin: "deterministic_cover" as const, variantProfileId: "social-card-v1" as const },
      reviewStatus: "pending_human_review" as const,
      publicationStatus: "blocked" as const,
    }))
    .sort((left, right) => compareCanonicalKeys(left.legacyContentId, right.legacyContentId));
  if (blogPublicationPlans.length !== 44) throw new Error(`Phase 6 publication plan requires exactly 44 historically published Blogs, got ${blogPublicationPlans.length}`);
  const vibrationPlan = blogPublicationPlans.find((plan) => plan.legacyContentId === "blog:vibration-robot");
  if (!vibrationPlan || vibrationPlan.hero.origin !== "legacy_media") throw new Error("vibration-robot legacy hero plan missing");
  const deterministicHeroCount = blogPublicationPlans.filter((plan) => plan.hero.origin === "deterministic_cover").length;
  if (deterministicHeroCount !== 43) throw new Error(`Expected 43 deterministic Blog hero replacements, got ${deterministicHeroCount}`);

  const payload = proposalPayload({
    schemaVersion: 1,
    reviewVersion,
    rawInventoryManifestPayloadSha256: rawInventory.manifestPayloadSha256,
    decisions,
    blogPublicationPlans,
    reviewStatus: "pending_operator_acceptance",
    persistentMutationAuthorized: false,
  });
  return phase6MediaReviewProposalSchema.parse({ ...payload, reviewPayloadSha256: fingerprint(payload) });
};

export const writePhase6MediaReviewProposal = async (): Promise<Phase6MediaReviewProposal> => {
  const proposal = await buildPhase6MediaReviewProposal();
  await writeFile(phase6MediaReviewProposalPath, `${JSON.stringify(proposal, null, 2)}\n`, "utf8");
  return proposal;
};

export const checkPhase6MediaReviewProposal = async (): Promise<Phase6MediaReviewProposal> => {
  const expected = await buildPhase6MediaReviewProposal();
  const committed = phase6MediaReviewProposalSchema.parse(await readJson(phase6MediaReviewProposalPath));
  if (JSON.stringify(committed) !== JSON.stringify(expected)) {
    throw new Error("Committed Phase 6 media review proposal differs from exact regeneration");
  }
  return committed;
};
