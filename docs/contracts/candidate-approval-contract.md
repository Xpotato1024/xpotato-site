---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - publication candidate manifest
  - human review bundle
  - approval record contract
---

# Candidate and Approval Contract

## PublicationCandidateManifest

Candidateはpersistent media/provider mutation前のexact human approval target。

```ts
interface PublicationCandidateManifest {
  schemaVersion: 1;
  candidateId: string;
  jobId: string;
  jobFingerprint: string;

  baseRepositoryCommit: string;

  article: {
    contentId: ContentId;
    mdxSha256: string;
    frontmatterSha256: string;
    route: string;
    collection: string;
    updateDiffSha256?: string;
  };

  evidence: {
    sourceBundleSha256: string;
    evidenceBundleSha256: string;
    claimLedgerSha256: string;
    durableClaimLedgerProposalSha256: string;
    citationCompilationSha256: string;
    technicalExampleVerificationSha256: string;
    contentAuditSha256: string;
  };

  visual: {
    visualPlanSetSha256: string;
    visualAuditManifestSha256: string;
    heroAssetId?: string;
    socialCardAssetId?: string;
  };

  media: {
    mediaSetManifestSha256: string;
    canonicalSourceSha256s: string[];
    ingestProfileSha256s: string[];
    variantManifestSha256s: string[];
    deliveryProfileSha256s: string[];
    canonicalSourceStoragePlanSha256: string;
    mediaPublicationPlanSha256: string;
    mediaRegistryProposalSha256: string;
  };

  provenanceProposalSha256: string;

  taxonomyRegistrySha256: string;
  contentModuleRegistrySha256: string;
  interactiveModuleRegistrySha256: string;
  buildConfigFingerprint: string;

  validation: {
    schema: "pass" | "fail";
    citations: "pass" | "fail";
    examples: "pass" | "fail" | "not_applicable";
    durableClaimLedger: "pass" | "fail";
    mediaVariants: "pass" | "fail" | "not_applicable";
    build: "pass" | "fail";
    seo: "pass" | "fail";
    accessibility: "pass" | "fail" | "manual_required";
    performance: "pass" | "fail" | "not_run";
  };

  candidateSha256: string;
}
```

`candidateSha256` binds at least:

- MDX/frontmatter
- claim/evidence/source bundle identities
- compact durable material-claim ledger proposal
- citation compilation
- technical example verification
- canonical media source + ingest profile
- deterministic delivery variant manifests/profiles
- content/visual audits
- media/taxonomy/interactive registry proposals
- pre-persistence provenance proposal

Private/public R2 objectがまだ存在しなくてもcandidate identityは確定できる。

## Durable claim ledger proposal

Human approval packageへ入るmaterial claim summaryは、post-cleanup durable provenanceへexport予定の`CompactMaterialClaimBinding[]`と同じsource/evidence semanticsから生成する。

Pre-approval validator must verify:

- every material claim is mapped
- evidence/source refs resolve
- summaries are public-safe
- current draft locator/hash matches

これにより「approval後に初めてtraceabilityを作る」ことを避ける。

## Post-approval operational lineage is not candidate content mutation

`CanonicalSourceStorageReceipt`、`MediaPublicationManifest`、`MediaProtectionReceipt`、`CompactMediaRecoveryBinding`はapproval後のexternal persistence結果であり、human-approved article/media bytesそのものではない。

These artifacts must bind the exact approved candidate and may be deterministically appended to final Publication Provenance **without changing candidateSha256**。

If post-approval operation would require changing article/media bytes, route, rights, profile, or material claim support, approval is stale and a new candidate is required。

## Collection visual optionality

Blog: hero/social card required。

Other collections: hero optional。Media 0件でもdeterministic empty manifestsをuseできる。

## Preview

Preview uses candidate-local canonical/variant adapter. Private source R2/public R2/protected planeをprerequisiteにしない。

## HumanReviewBundle

```ts
interface HumanReviewBundle {
  candidateSha256: string;
  contentId: ContentId;
  renderedPreviewRefs: string[];
  title: string;
  description: string;
  route: string;

  taxonomySummary: string[];
  materialClaims: ReviewClaimSummary[];
  citationSummary: string;
  technicalExampleSummary: string;
  unresolvedLimitations: string[];
  contentAuditSummary: string;

  visualSummary: string;
  mediaDeliverySummary: string;
  plannedPrivateCanonicalSources: string[];
  plannedPublicMedia: string[];

  updateDiffRef?: string;
  isApproval: false;
}
```

Review bundleはapprovalではない。

## HumanApprovalRecord

```ts
interface HumanApprovalRecord {
  schemaVersion: 1;
  candidateSha256: string;
  contentId: ContentId;
  approvedAt: string;
  reviewer: string;
  basis: string;
  confirmed: true;
}
```

AI/Skill/audit stageは生成できない。Human laneのみ。

## Approval invalidation

変更時にapproval stale:

- MDX/frontmatter/route/ContentId
- material claim text/support mapping
- citation compilation
- technical example-bound content
- canonical media bytes/ingest profile
- selected visual/visual audit
- delivery profile/variant bytes
- rights/publication plan/media registry proposal
- taxonomy semantics affecting article
- content audit target

Post-approval provider receipt locatorのdeterministic追加だけではcandidate invalidationしない。

## Persistent media sequence

```text
HUMAN_APPROVED
 -> source storage/reuse + receipt
 -> public publication/reuse + manifest
 -> exact-byte protection + receipt
 -> durable provenance recovery binding
 -> EXPORTED
```

Each external artifact must bind same candidate/approval identity。

## Repository export prerequisite

- valid HumanApprovalRecord
- current compact material claim ledger equals approved proposal
- valid CanonicalSourceStorageReceipt set / not_required
- valid MediaPublicationManifest
- valid MediaProtectionReceipt / empty result
- durable `CompactMediaRecoveryBinding` derived from receipt when media exists
- recovery binding object-set equals publication/protection required object sets
- candidate hash unchanged
- repository base revalidated

Export includes:

- MDX/frontmatter
- Media Registry + canonical source identity
- Publication Provenance including compact SourceRefs/materialClaims/mediaRecovery
- separately approved taxonomy/interactive changes

Export後、working tree bytes/hashをcandidate-derived content + deterministic operational lineageとして再検証する。

AI draftを直接content treeへcopyして後追いapprovalするworkflowは禁止する。
