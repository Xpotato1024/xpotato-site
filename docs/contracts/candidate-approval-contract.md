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

candidateはpublic R2 mutation前のapproval target。

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
    heroLocalSha256: string;
    socialCardLocalSha256: string;
    visualAuditSha256: string;
  };

  mediaPublicationPlanSha256: string;
  taxonomyRegistrySha256: string;
  contentModuleRegistrySha256: string;
  interactiveModuleRegistrySha256: string;
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

`candidateSha256`はMDX、frontmatter、local normalized media bytes、registry proposals、audit等のcanonical artifact identityから決定する。

R2 objectがまだ存在しなくてもcandidate identityは確定できる。

## Preview

preview rendererはcandidate-local media adapterを使用できる。

public R2 uploadをpreview prerequisiteにしない。

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
  plannedPublicMedia: string[];
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

implementation CLIのhuman laneでのみ作成する。

## Approval invalidation

次のいずれかが変わればapprovalはstale。

- MDX bytes
- frontmatter
- selected media bytes
- media publication plan
- taxonomy semantics affecting article
- content / visual audit target
- route

purely non-semantic build environment changeはapprovalを常に無効化しなくてもよいが、preview validationは再実行する。

## Media publication after approval

human approval後、`public-media-publication-contract.md`に従いexact candidate mediaだけをR2へpublishする。

MediaPublicationManifestはcandidate SHA / approval SHAへbindする。

## Repository export

repository exportのprerequisite:

- valid HumanApprovalRecord
- valid MediaPublicationManifest
- candidate hash unchanged
- all registry-bound R2 objects verified

export後、working tree MDX / registry bytesがcandidate-derived outputと一致することを再hashして確認する。

AI-generated draftを直接content treeへcopyして後追いapprovalするworkflowは禁止する。
