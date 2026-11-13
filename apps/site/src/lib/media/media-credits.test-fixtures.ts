import { contentMediaRegistrySchema, mediaRightsRecordSchema } from "@xpotato/content-contracts";

// Synthetic identifiers, prose and media identities only; no owner/article evidence.
export const creditContentId = "5c47dabd-8c7f-4c43-9c0a-8ef8a96c19a5";
const sha256 = "a".repeat(64);
export const creditObject = {
  sha256, objectKey: "media/v1/objects/sha256/aa/" + sha256 + ".webp",
  format: "webp", width: 640, height: 320, sizeBytes: 64,
};
export const creditRegistry = contentMediaRegistrySchema.parse({
  schemaVersion: 1, contentId: creditContentId,
  assets: [{
    assetId: "diagram", role: "inline", origin: "diagram", status: "active",
    defaultAlt: "合成図の断面", rightsRef: "synthetic-rights", provenanceRef: "synthetic-fixture",
    delivery: { mode: "fixed", master: creditObject, variants: [] },
  }],
});
export const creditRights = mediaRightsRecordSchema.parse({
  schemaVersion: 1, rightsId: "synthetic-rights", basis: "self_created",
  publicationAuthorized: true, confirmedBy: "system_policy", confirmedAt: "2026-01-01T00:00:00Z",
});
export const creditContext = {
  registry: creditRegistry, rights: [creditRights], candidate: false, referenceOnly: false,
  urlFor: () => "/__candidate_media/" + sha256 + ".webp",
};
