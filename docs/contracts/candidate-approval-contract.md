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

```ts
interface PublicationCandidateManifest {
  schemaVersion: 1;
  candidateId: string;
  jobId: string;
  jobFingerprint: string;

  baseRepositoryCommit: string;

  article: {
    mdxSha256: string;
    frontmatterSha256: string;
    route: string;
    collection: string;
  };

  evidence: {
    bundleSha256: string;
    contentAuditSha256: string;
  };

  visual: {
    heroAssetId: string;
    heroSha256: string;
    visualAuditSha256: string;
    socialCardSha256: string;
  };

  taxonomyRegistrySha256: string;
  contentModuleRegistrySha256: string;
  buildConfigFingerprint: string;

  validation: {
    schema: "pass" | "fail";
    build: "pass" | "fail";
    seo: "pass" | "fail";
    accessibility: "pass" | "fail" | "manual_required";
    performance: "pass" | "fail" | "not_run";
  };

  candidateSha256: string;
}
```

`candidateSha256`はcandidateを構成するcanonical artifact identityから決定する。

## HumanReviewBundle

```ts
interface HumanReviewBundle {
  candidateSha256: string;
  renderedPreviewRefs: string[];
  title: string;
  description: string;
  route: string;
  taxonomySummary: string[];
  materialClaims: ReviewClaimSummary[];
  unresolvedLimitations: string[];
  contentAuditSummary: string;
  heroOrigin: string;
  visualAuditSummary: string;
  updateDiffRef?: string;
  isApproval: false;
}
```

review bundleはapprovalではない。

## HumanApprovalRecord

```ts
interface HumanApprovalRecord {
  schemaVersion: 1;
  candidateSha256: string;
  approvedAt: string;
  reviewer: string;
  basis: string;
  confirmed: true;
}
```

AI / Skill / audit stageはこれを生成できない。

実装CLIのhuman laneでのみ作成する。

## Approval invalidation

次のいずれかが変わればapprovalはstale。

- MDX bytes
- frontmatter
- hero asset
- social card
- taxonomy registry semantics affecting article
- content audit target
- visual audit target
- route

purely non-semantic build environment changeでapprovalを常に無効化する必要はないが、preview validationは再実行する。

## Repository export

exportはapproved candidateだけを入力にする。

export後、working tree bytesがcandidate manifestと一致することを再hashして確認する。

AI-generated draftを直接`src/content/`へcopyしてから後追いでapprovalするworkflowは禁止する。
