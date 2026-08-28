import { describe, expect, it } from "vitest";
import { evaluateCleanupEligibility, type CleanupEligibility } from "./job.js";

const hash = (character: string): string => character.repeat(64);
const valid = (): CleanupEligibility => ({
  state: "EXPORTED",
  durableGitRef: {
    requestedRef: "refs/heads/reviewed",
    verifiedRef: "refs/heads/reviewed",
    expectedCommitSha: "1".repeat(40),
    resolvedCommitSha: "1".repeat(40),
    expectedContentSha256: hash("2"),
    actualContentSha256: hash("2"),
    expectedProvenanceSha256: hash("3"),
    actualProvenanceSha256: hash("3"),
  },
  candidateApprovalProvenance: {
    candidateSha256: hash("4"),
    approvalCandidateSha256: hash("4"),
    provenanceCandidateSha256: hash("4"),
    approvalRecordSha256: hash("5"),
    provenanceApprovalRecordSha256: hash("5"),
  },
  materialClaimLineage: {
    requiredClaimIds: ["claim-a", "claim-b"],
    durableClaimIds: ["claim-b", "claim-a"],
    supportBindingsVerified: true,
  },
  externalAiLineage: { externalRunCount: 2, safeDurableRunCount: 2, requestManifestBindingsVerified: true },
  canonicalSourceStorage: { requiredReceiptSha256s: [hash("6")], verifiedReceiptSha256s: [hash("6")] },
  mediaPublication: { manifestSha256: hash("7"), expectedManifestSha256: hash("7"), verified: true },
  mediaProtection: { receiptSha256: hash("8"), expectedReceiptSha256: hash("8"), verified: true },
  compactMediaRecovery: {
    publicationObjectSetSha256: hash("9"),
    protectionObjectSetSha256: hash("9"),
    bindingObjectSetSha256: hash("9"),
    exactEqualityVerified: true,
  },
  unresolvedIncidents: { orphan: 0, externalSideEffect: 0, disclosureSecurity: 0 },
  operatorConfirmation: { confirmed: true, operatorId: "operator", confirmedAt: "2026-08-27T00:00:00Z" },
});

describe("frozen Article Job cleanup retention gate", () => {
  it("accepts only the complete exported durable state", () => {
    expect(evaluateCleanupEligibility(valid())).toEqual({ eligible: true, failures: [] });
  });

  it.each([
    ["state", (input: CleanupEligibility) => ({ ...input, state: "MEDIA_PROTECTED" as const })],
    ["durable Git ref", (input: CleanupEligibility) => ({ ...input, durableGitRef: { ...input.durableGitRef, resolvedCommitSha: "0".repeat(40) } })],
    ["candidate/approval/provenance", (input: CleanupEligibility) => ({ ...input, candidateApprovalProvenance: { ...input.candidateApprovalProvenance, provenanceCandidateSha256: hash("0") } })],
    ["material claim lineage", (input: CleanupEligibility) => ({ ...input, materialClaimLineage: { ...input.materialClaimLineage, durableClaimIds: ["claim-a"] } })],
    ["external-AI lineage", (input: CleanupEligibility) => ({ ...input, externalAiLineage: { ...input.externalAiLineage, safeDurableRunCount: 1 } })],
    ["canonical source receipts", (input: CleanupEligibility) => ({ ...input, canonicalSourceStorage: { ...input.canonicalSourceStorage, verifiedReceiptSha256s: [] } })],
    ["publication manifest", (input: CleanupEligibility) => ({ ...input, mediaPublication: { ...input.mediaPublication, verified: false } })],
    ["protection receipt", (input: CleanupEligibility) => ({ ...input, mediaProtection: { ...input.mediaProtection, verified: false } })],
    ["compact recovery equality", (input: CleanupEligibility) => ({ ...input, compactMediaRecovery: { ...input.compactMediaRecovery, bindingObjectSetSha256: hash("0") } })],
    ["incident disposition", (input: CleanupEligibility) => ({ ...input, unresolvedIncidents: { ...input.unresolvedIncidents, disclosureSecurity: 1 } })],
    ["operator confirmation", (input: CleanupEligibility) => ({ ...input, operatorConfirmation: { confirmed: false } })],
  ] as const)("rejects when %s is missing or mismatched", (_name, mutate) => {
    expect(mutate(valid()).state).toBeDefined();
    expect(evaluateCleanupEligibility(mutate(valid())).eligible).toBe(false);
  });
});
