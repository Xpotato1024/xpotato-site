import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import sharp from "sharp";
import { contentMediaRegistrySchema, mediaIngestRequestSchema } from "@xpotato/content-contracts";
import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { canonicalRasterProfile, getMediaVariantProfileBinding, SharpCanonicalMediaProcessor,
  SharpDeliveryVariantGenerator, generatePublicDeliveryMaster } from "@xpotato/media-ingest";

// Private candidate only: no network, publication, protected-storage receipt or active registry export.
const root = resolve(import.meta.dirname, "..");
export const prepareHomeWorkshop = async (output: string) => {
const privatePath = relative(join(root, ".local"), resolve(output));
if (!privatePath || privatePath.startsWith("..") || isAbsolute(privatePath)) throw new Error("Private candidate must be an owned child of .local");
await mkdir(output, { recursive: false });
sharp.concurrency(1);
const source = { commit: "927d105713561309fc5e2374396f86646b5aeb2a", path: "public/images/ui/hero-workshop-stage.jpg",
  sha256: "1daf2c4eb0519c2f04bec3a549b9f1711d9be1f1ca572d73c6352ea975fb00ca", bytes: 760808 };
const bytes = execFileSync("git", ["show", `${source.commit}:${source.path}`], { cwd: root, maxBuffer: 2 * 1024 * 1024 });
if (bytes.length !== source.bytes || sha256(bytes) !== source.sha256) throw new Error("Reviewed legacy photo identity drift");
const sourcePath = join(output, "source.jpg");
await writeFile(sourcePath, bytes);
const target = { contentId: "daf04736-9b1b-49c7-8942-1e1545a4b985", semanticAssetId: "home-workshop" };
const profile = getMediaVariantProfileBinding("photo-hero-v1");
const request = mediaIngestRequestSchema.parse({ schemaVersion: 1, sourcePath, target, kind: "photo", profileId: canonicalRasterProfile.id, overwrite: false });
console.log("home workshop: canonical normalization (one worker)");
const ingest = await new SharpCanonicalMediaProcessor(join(output, "canonical")).ingest(request);
if (ingest.source.width !== 2400 || ingest.source.height !== 1350) throw new Error("Reviewed source dimensions drift");
console.log("home workshop: existing photo-hero-v1 variants");
const variants = await new SharpDeliveryVariantGenerator(join(output, "variants")).generate({ contentId: target.contentId, ingestResult: ingest, ...profile });
const master = await generatePublicDeliveryMaster(ingest, "photo-hero-v1", join(output, "public-master"));
const object = (item: typeof master) => ({ sha256: item.sha256,
  objectKey: `media/v1/objects/sha256/${item.sha256.slice(0, 2)}/${item.sha256}.${item.format === "jpeg" ? "jpg" : item.format}`,
  format: item.format, width: item.width, height: item.height, sizeBytes: item.sizeBytes });
const registryCandidate = contentMediaRegistrySchema.parse({ schemaVersion: 1, contentId: target.contentId, assets: [{
  assetId: target.semanticAssetId, role: "hero", origin: "camera", status: "active",
  delivery: { mode: "responsive", ...profile, master: object(master), variants: variants.variants.map(object) },
  defaultAlt: "ボール盤、工具、はんだごてが並ぶ工作台", provenanceRef: "home-workshop-legacy-v1", rightsRef: "home-workshop-rights-v1",
}] });
const localObjects = [master, ...variants.variants].map(item => ({ ...object(item), privateRelativePath: item.privateRelativePath }));
for (const item of localObjects) if (sha256(await readFile(resolve(item.privateRelativePath))) !== item.sha256) throw new Error("Private candidate bytes mismatch");
const candidate = { schemaVersion: 1, state: "PRIVATE_CANDIDATE_ONLY", route: "/", source, ingest, variants, registryCandidate,
  localObjects, providerMutations: 0, productionBindingActive: false,
  provenance: { origin: "legacy_git_camera_photo", firstKnownCommit: "2c50a80", generatedImage: false,
    visiblePeopleOrPersonalDocuments: false, exifOrXmpPresent: false, rightsProblemEvidence: "none found in reviewed source and history" },
  proposedOperationsAfterApproval: ["connect exact frozen photo to ordinary build and existing Worker artifact", "verify exact photo-enabled artifact", "merge/deploy only after owner batch approval"],
  proposedDeliveryMode: "frozen-homepage-asset-in-existing-worker-artifact",
  recoverySource: { legacyGitCommit: source.commit, legacyGitPath: source.path },
};
await writeFile(join(output, "candidate.json"), JSON.stringify({ ...candidate, candidateSha256: fingerprint(candidate) }, null, 2) + "\n");
return { ...candidate, candidateSha256: fingerprint(candidate) };
};
