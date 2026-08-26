import { articleJobSpecSchema, type ArticleJobSpec, type ArticleJobState } from "@xpotato/content-contracts";
import { canonicalJson, fingerprint } from "./canonical.js";

export interface NormalizedArticleJobSpec {
  readonly spec: ArticleJobSpec;
  readonly canonicalJson: string;
  readonly jobFingerprint: string;
}

export const normalizeArticleJobSpec = (input: unknown): NormalizedArticleJobSpec => {
  const spec = articleJobSpecSchema.parse(input);
  const normalized = canonicalJson(spec);
  return Object.freeze({ spec, canonicalJson: normalized, jobFingerprint: fingerprint(spec) });
};

export interface ImmutableArtifactIdentity {
  readonly artifactId: string;
  readonly sha256: string;
  readonly mediaType: string;
}

export interface SourcePinningPort {
  pin(input: Readonly<{ locator: unknown; expectedSha256?: string }>): Promise<ImmutableArtifactIdentity>;
}

export interface ArtifactStore {
  put(identity: ImmutableArtifactIdentity, bytes: Uint8Array): Promise<void>;
  get(identity: ImmutableArtifactIdentity): Promise<Uint8Array>;
}

export interface RepositoryExportPort {
  materialize(input: Readonly<{ candidateSha256: string; provenanceSha256: string }>): Promise<Readonly<{ patchSha256: string }>>;
}

export interface CleanupEligibility {
  readonly state: ArticleJobState;
  readonly durableGitRef: Readonly<{
    requestedRef: string;
    verifiedRef: string;
    expectedCommitSha: string;
    resolvedCommitSha: string;
    expectedContentSha256: string;
    actualContentSha256: string;
    expectedProvenanceSha256: string;
    actualProvenanceSha256: string;
  }>;
  readonly candidateApprovalProvenance: Readonly<{
    candidateSha256: string;
    approvalCandidateSha256: string;
    provenanceCandidateSha256: string;
    approvalRecordSha256: string;
    provenanceApprovalRecordSha256: string;
  }>;
  readonly materialClaimLineage: Readonly<{
    requiredClaimIds: readonly string[];
    durableClaimIds: readonly string[];
    supportBindingsVerified: boolean;
  }>;
  readonly externalAiLineage: Readonly<{
    externalRunCount: number;
    safeDurableRunCount: number;
    requestManifestBindingsVerified: boolean;
  }>;
  readonly canonicalSourceStorage: Readonly<{
    requiredReceiptSha256s: readonly string[];
    verifiedReceiptSha256s: readonly string[];
  }>;
  readonly mediaPublication: Readonly<{
    manifestSha256: string;
    expectedManifestSha256: string;
    verified: boolean;
  }>;
  readonly mediaProtection: Readonly<{
    receiptSha256: string;
    expectedReceiptSha256: string;
    verified: boolean;
  }>;
  readonly compactMediaRecovery: Readonly<{
    publicationObjectSetSha256: string;
    protectionObjectSetSha256: string;
    bindingObjectSetSha256: string;
    exactEqualityVerified: boolean;
  }>;
  readonly unresolvedIncidents: Readonly<{
    orphan: number;
    externalSideEffect: number;
    disclosureSecurity: number;
  }>;
  readonly operatorConfirmation: Readonly<{
    confirmed: boolean;
    operatorId?: string;
    confirmedAt?: string;
  }>;
}

export interface CleanupEligibilityResult {
  readonly eligible: boolean;
  readonly failures: readonly string[];
}

const exactSetEquals = (left: readonly string[], right: readonly string[]): boolean => {
  if (new Set(left).size !== left.length || new Set(right).size !== right.length) return false;
  const orderedLeft = [...left].sort(compareUtf16);
  const orderedRight = [...right].sort(compareUtf16);
  return orderedLeft.length === orderedRight.length && orderedLeft.every((item, index) => item === orderedRight[index]);
};

const compareUtf16 = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

export const evaluateCleanupEligibility = (input: CleanupEligibility): CleanupEligibilityResult => {
  const failures: string[] = [];
  if (input.state !== "EXPORTED") failures.push("state must be EXPORTED");

  const git = input.durableGitRef;
  if (
    !git.requestedRef ||
    git.requestedRef !== git.verifiedRef ||
    git.expectedCommitSha !== git.resolvedCommitSha ||
    git.expectedContentSha256 !== git.actualContentSha256 ||
    git.expectedProvenanceSha256 !== git.actualProvenanceSha256
  ) {
    failures.push("exact durable Git ref verification failed");
  }

  const lineage = input.candidateApprovalProvenance;
  if (
    lineage.candidateSha256 !== lineage.approvalCandidateSha256 ||
    lineage.candidateSha256 !== lineage.provenanceCandidateSha256 ||
    lineage.approvalRecordSha256 !== lineage.provenanceApprovalRecordSha256
  ) {
    failures.push("candidate/approval/provenance equality failed");
  }

  if (
    !input.materialClaimLineage.supportBindingsVerified ||
    !exactSetEquals(input.materialClaimLineage.requiredClaimIds, input.materialClaimLineage.durableClaimIds)
  ) {
    failures.push("material claim lineage is incomplete or stale");
  }

  if (
    input.externalAiLineage.externalRunCount !== input.externalAiLineage.safeDurableRunCount ||
    !input.externalAiLineage.requestManifestBindingsVerified
  ) {
    failures.push("external-AI safe lineage is incomplete or mismatched");
  }

  if (!exactSetEquals(input.canonicalSourceStorage.requiredReceiptSha256s, input.canonicalSourceStorage.verifiedReceiptSha256s)) {
    failures.push("CanonicalSourceStorageReceipt set mismatch");
  }

  if (
    !input.mediaPublication.verified ||
    input.mediaPublication.manifestSha256 !== input.mediaPublication.expectedManifestSha256
  ) {
    failures.push("MediaPublicationManifest is missing or invalid");
  }

  if (
    !input.mediaProtection.verified ||
    input.mediaProtection.receiptSha256 !== input.mediaProtection.expectedReceiptSha256
  ) {
    failures.push("MediaProtectionReceipt is missing or invalid");
  }

  const recovery = input.compactMediaRecovery;
  if (
    !recovery.exactEqualityVerified ||
    recovery.publicationObjectSetSha256 !== recovery.protectionObjectSetSha256 ||
    recovery.publicationObjectSetSha256 !== recovery.bindingObjectSetSha256
  ) {
    failures.push("CompactMediaRecoveryBinding exact equality failed");
  }

  const incidents = input.unresolvedIncidents;
  if (incidents.orphan !== 0 || incidents.externalSideEffect !== 0 || incidents.disclosureSecurity !== 0) {
    failures.push("unresolved orphan/external-side-effect/disclosure-security incident exists");
  }

  if (
    !input.operatorConfirmation.confirmed ||
    !input.operatorConfirmation.operatorId ||
    !input.operatorConfirmation.confirmedAt
  ) {
    failures.push("explicit operator confirmation missing");
  }

  return Object.freeze({ eligible: failures.length === 0, failures: Object.freeze(failures) });
};

export const isCleanupEligible = (input: CleanupEligibility): boolean => evaluateCleanupEligibility(input).eligible;
