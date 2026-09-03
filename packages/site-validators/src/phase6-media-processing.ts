import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  phase6MediaLocalProcessingManifestSchema,
  phase6MediaRepositoryCandidateManifestSchema,
  type Phase6LocalProcessedObject,
  type Phase6LocalMediaProcessingRecord,
  type Phase6MediaLocalProcessingManifest,
  type Phase6MediaProvenanceRecord,
} from "@xpotato/content-contracts";
import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import {
  generatePublicDeliveryMaster,
  getMediaVariantProfileBinding,
  mediaToolchainId,
  SharpCanonicalMediaProcessor,
  SharpDeliveryVariantGenerator,
  sharpToolchainSha256,
  type LocalDeliveryObject,
  type MediaVariantProfileId,
} from "@xpotato/media-ingest";
import {
  buildPhase6MediaRepositoryCandidate,
  phase6MediaRepositoryCandidatePath,
} from "./phase6-media-candidate.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const legacyCommitSha = "927d105713561309fc5e2374396f86646b5aeb2a";
export const phase6MediaLocalProcessingPath = join(repositoryRoot, "docs/migration/media-local-processing-v1.json");
export const phase6MediaProcessingArtifactRoot = join(repositoryRoot, ".local/migration/phase6/processing-artifact");
const phase6MediaProcessingSourceRoot = join(repositoryRoot, ".local/migration/phase6/processing-source");
const processingVersion = "legacy-media-local-processing-v1" as const;

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;
const keyOf = (contentId: string, assetId: string): string => `${contentId}\0${assetId}`;

const contentTypeFor = (format: Phase6LocalProcessedObject["format"]): string => format === "svg" ? "image/svg+xml" : `image/${format}`;

const objectFromCanonical = (canonical: Readonly<{
  privateRelativePath: string;
  sha256: string;
  format: "webp" | "svg";
  width?: number;
  height?: number;
  sizeBytes: number;
}>): Phase6LocalProcessedObject => {
  if (!canonical.width || !canonical.height) throw new Error(`Canonical dimensions missing for ${canonical.privateRelativePath}`);
  return {
    sha256: canonical.sha256,
    artifactRelativePath: canonical.privateRelativePath,
    format: canonical.format,
    width: canonical.width,
    height: canonical.height,
    sizeBytes: canonical.sizeBytes,
    contentType: contentTypeFor(canonical.format),
  };
};

const objectFromDelivery = (value: LocalDeliveryObject): Phase6LocalProcessedObject => ({
  sha256: value.sha256,
  artifactRelativePath: value.privateRelativePath,
  format: value.format,
  width: value.width,
  height: value.height,
  sizeBytes: value.sizeBytes,
  contentType: value.contentType,
});

const sourceExtension = (provenance: Phase6MediaProvenanceRecord): string => {
  if (provenance.origin === "deterministic_generator") return ".svg";
  const extension = provenance.repositoryPath ? extname(provenance.repositoryPath) : "";
  if (!extension) throw new Error(`Legacy Git media extension missing for ${provenance.contentId}/${provenance.assetId}`);
  return extension;
};

const materializeSource = async (
  provenance: Phase6MediaProvenanceRecord,
  deterministicBytes: ReadonlyMap<string, string>,
): Promise<Readonly<{ sourcePath: string; sourceSha256: string }>> => {
  const directory = join(phase6MediaProcessingSourceRoot, provenance.contentId);
  await mkdir(directory, { recursive: true });
  const sourcePath = join(directory, `${provenance.assetId}${sourceExtension(provenance)}`);
  if (provenance.origin === "deterministic_generator") {
    const source = deterministicBytes.get(keyOf(provenance.contentId, provenance.assetId));
    if (!source || !provenance.deterministicSourceSha256) {
      throw new Error(`Deterministic source missing for ${provenance.contentId}/${provenance.assetId}`);
    }
    const bytes = Buffer.from(source, "utf8");
    if (sha256(bytes) !== provenance.deterministicSourceSha256) throw new Error("Deterministic source SHA mismatch");
    await writeFile(sourcePath, bytes);
    return { sourcePath, sourceSha256: provenance.deterministicSourceSha256 };
  }
  if (provenance.origin !== "legacy_git" || !provenance.repositoryPath || !provenance.sourceSha256) {
    throw new Error(`Only ready local provenance may be materialized: ${provenance.contentId}/${provenance.assetId}`);
  }
  const bytes = execFileSync("git", ["show", `${legacyCommitSha}:${provenance.repositoryPath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (sha256(bytes) !== provenance.sourceSha256) throw new Error(`Frozen Git source SHA mismatch: ${provenance.repositoryPath}`);
  await writeFile(sourcePath, bytes);
  return { sourcePath, sourceSha256: provenance.sourceSha256 };
};

const mediaKindFor = (ingestProfileId: string, variantProfileId: string | undefined): "diagram" | "photo" | "screenshot" => {
  if (ingestProfileId === "diagram-svg-v1") return "diagram";
  if (variantProfileId === "screenshot-ui-v1") return "screenshot";
  return "photo";
};

const normalizeVariant = (value: Readonly<{
  sha256: string;
  privateRelativePath: string;
  format: "jpeg" | "png" | "webp" | "avif";
  width: number;
  height: number;
  sizeBytes: number;
  contentType: string;
}>): Phase6LocalProcessedObject => ({
  sha256: value.sha256,
  artifactRelativePath: value.privateRelativePath,
  format: value.format,
  width: value.width,
  height: value.height,
  sizeBytes: value.sizeBytes,
  contentType: value.contentType,
});

export const buildPhase6MediaLocalProcessing = async (): Promise<Phase6MediaLocalProcessingManifest> => {
  await rm(phase6MediaProcessingArtifactRoot, { recursive: true, force: true });
  await rm(phase6MediaProcessingSourceRoot, { recursive: true, force: true });

  const expectedCandidate = await buildPhase6MediaRepositoryCandidate();
  const committedCandidate = phase6MediaRepositoryCandidateManifestSchema.parse(await readJson(phase6MediaRepositoryCandidatePath));
  if (JSON.stringify(committedCandidate) !== JSON.stringify(expectedCandidate.manifest)) {
    throw new Error("Phase 6 local processing requires the exact accepted repository candidate");
  }

  const provenanceByKey = new Map(committedCandidate.provenance.map((record) => [keyOf(record.contentId, record.assetId), record]));
  const canonicalProcessor = new SharpCanonicalMediaProcessor(".local/migration/phase6/processing-artifact/canonical");
  const variantGenerator = new SharpDeliveryVariantGenerator(".local/migration/phase6/processing-artifact/variants");
  const records: Phase6LocalMediaProcessingRecord[] = [];

  for (const plan of committedCandidate.processingPlan) {
    const provenance = provenanceByKey.get(keyOf(plan.contentId, plan.assetId));
    if (!provenance) throw new Error(`Processing provenance missing for ${plan.contentId}/${plan.assetId}`);
    if (plan.sourceStatus === "recovery_required") {
      records.push({
        legacyContentId: plan.legacyContentId,
        contentId: plan.contentId,
        assetId: plan.assetId,
        role: plan.role,
        ingestProfileId: plan.ingestProfileId,
        status: "deferred_nonlocal",
        blockers: ["nonlocal_source_recovery"],
      });
      continue;
    }

    const source = await materializeSource(provenance, expectedCandidate.deterministicSourceBytes);
    const ingest = await canonicalProcessor.ingest({
      schemaVersion: 1,
      sourcePath: source.sourcePath,
      target: { contentId: plan.contentId, semanticAssetId: plan.assetId },
      kind: mediaKindFor(plan.ingestProfileId, plan.variantProfileId),
      profileId: plan.ingestProfileId,
      overwrite: false,
    });
    if (ingest.source.sourceSha256 !== source.sourceSha256) throw new Error(`Ingest source SHA mismatch: ${plan.contentId}/${plan.assetId}`);
    const canonical = objectFromCanonical(ingest.canonicalMaster);

    if (plan.deliveryAction === "fixed_svg") {
      if (canonical.format !== "svg") throw new Error(`fixed_svg canonical format mismatch: ${plan.contentId}/${plan.assetId}`);
      records.push({
        legacyContentId: plan.legacyContentId,
        contentId: plan.contentId,
        assetId: plan.assetId,
        role: plan.role,
        ingestProfileId: plan.ingestProfileId,
        status: "processed",
        sourceSha256: source.sourceSha256,
        canonical,
        deliveryMaster: canonical,
        variants: [],
        blockers: [],
      });
      continue;
    }

    const variantProfileId = plan.variantProfileId;
    if (!variantProfileId) throw new Error(`Delivery profile missing for ${plan.contentId}/${plan.assetId}`);
    const binding = getMediaVariantProfileBinding(variantProfileId);
    const variantManifest = await variantGenerator.generate({
      contentId: plan.contentId,
      ingestResult: ingest,
      profileId: binding.profileId,
      profileSha256: binding.profileSha256,
    });
    const deliveryMaster = objectFromDelivery(await generatePublicDeliveryMaster(
      ingest,
      binding.profileId,
      ".local/migration/phase6/processing-artifact/public-master",
    ));
    records.push({
      legacyContentId: plan.legacyContentId,
      contentId: plan.contentId,
      assetId: plan.assetId,
      role: plan.role,
      ingestProfileId: plan.ingestProfileId,
      status: "processed",
      sourceSha256: source.sourceSha256,
      canonical,
      deliveryMaster,
      variantProfileId,
      variantManifestSha256: variantManifest.manifestSha256,
      variants: variantManifest.variants.map(normalizeVariant),
      blockers: [],
    });
  }

  records.sort((left, right) => keyOf(left.contentId, left.assetId).localeCompare(keyOf(right.contentId, right.assetId), "en"));
  const processedAssetCount = records.filter((record) => record.status === "processed").length;
  const deferredAssetCount = records.filter((record) => record.status === "deferred_nonlocal").length;
  if (records.length !== 101 || processedAssetCount !== 100 || deferredAssetCount !== 1) {
    throw new Error(`Unexpected Phase 6 local processing coverage: total=${records.length}; processed=${processedAssetCount}; deferred=${deferredAssetCount}`);
  }
  const payload = {
    schemaVersion: 1 as const,
    processingVersion,
    repositoryCandidateManifestPayloadSha256: committedCandidate.manifestPayloadSha256,
    toolchainId: mediaToolchainId,
    toolchainSha256: sharpToolchainSha256(),
    semanticAssetCount: records.length,
    processedAssetCount,
    deferredAssetCount,
    records,
    persistentMutationAuthorized: false as const,
  };
  return phase6MediaLocalProcessingManifestSchema.parse({ ...payload, manifestPayloadSha256: fingerprint(payload) });
};

export const writePhase6MediaLocalProcessing = async (): Promise<Phase6MediaLocalProcessingManifest> => {
  const manifest = await buildPhase6MediaLocalProcessing();
  await writeFile(phase6MediaLocalProcessingPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
};

export const checkPhase6MediaLocalProcessing = async (): Promise<Phase6MediaLocalProcessingManifest> => {
  const expected = await buildPhase6MediaLocalProcessing();
  const committed = phase6MediaLocalProcessingManifestSchema.parse(await readJson(phase6MediaLocalProcessingPath));
  if (JSON.stringify(committed) !== JSON.stringify(expected)) {
    throw new Error("Committed Phase 6 local processing manifest differs from exact regeneration");
  }
  return committed;
};
