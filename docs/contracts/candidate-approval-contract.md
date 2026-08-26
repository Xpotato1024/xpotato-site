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

candidateはexternal media mutation前のapproval target。

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
    bundleSha256: string;
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
    mediaVariants: "pass" | "fail" | "not_applicable";
    build: "pass" | "fail";
    seo: "pass" | "fail";
    accessibility: "pass" | "fail" | "manual_required";
    performance: "pass" | "fail" | "not_run";
  };

  candidateSha256: string;
}
```

`candidateSha256`は少なくとも:

- MDX / frontmatter
- citation compilation
- technical example verification
- privacy-normalized canonical media source
- deterministic responsive variant manifests
- ingest/delivery profiles
- visual/content audits
- registry proposals
- provenance proposal

から決定する。

private/public R2 objectがまだ存在しなくてもcandidate identityは確定できる。

## Collection visual optionality

Blogではhero/social card required。

Notes / Projects / Tools / Pagesではhero optional。media 0件でもempty media-set manifestを生成してcandidate hashへbindできる。

## Preview

preview rendererはcandidate-local canonical/variant adapterを使用する。

private source R2 / public R2 / protected copyをpreview prerequisiteにしない。

previewで実際にapproval対象となるresponsive outputを確認できる。

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

review bundleはapprovalではない。

`mediaDeliverySummary`は:

- canonical source identity/profile
- delivery profile ID/version
- generated width/format set
- representative preview
- warnings

を要約する。

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

AI / Skill / audit stageはこれを生成できない。human laneのみ。

## Approval invalidation

次のいずれかが変わればapproval stale。

- MDX / frontmatter
- route / ContentId binding
- citation compilation
- technical example verification-bound content
- canonical media source bytes / ingest profile
- selected visual / visual audit
- media delivery profile / variant manifest / generated variant bytes
- canonical source storage plan
- public media publication plan / media registry proposal
- provenance proposal
- taxonomy semantics affecting article
- content audit target

optional Cloudflare transform/cache状態だけが変わりbaseline candidateが不変ならhuman approvalを無条件にinvalidにしない。

## Private canonical source storage after approval

human approval後、public media publication前に`private-canonical-media-storage-contract.md`へ従う。

CanonicalSourceStorageReceiptは:

- candidate SHA
- ContentId / assetId
- canonical source SHA
- storage class

へbindする。

required source persistence対象mediaではreceiptなしにpublic publicationへ進めない。

raw camera/AI originalはこのreceipt対象ではない。privacy-normalized canonical masterだけを保存する。

media 0件 / explicit `not_required` classはdeterministic empty result可。

## Media publication after source storage

valid source storage chain成立後、`public-media-publication-contract.md`に従いexact candidate delivery master + required baseline variantsだけをpublic R2へpublishする。

MediaPublicationManifestはcandidate SHA / approval SHA / media-set manifestへbindする。

media 0件のcandidateではempty successful publication manifestを許可できる。

Cloudflare provider-generated transform outputはapproval/publicationのcanonical object setにしない。

## Media protection before export

public media publication完了後、`published-media-protection-contract.md`に従ってexact public object recovery-protectionを成立させる。

public media objectが存在するcandidateではprotection receiptなしにrepository exportできない。

## Repository export

prerequisite:

- valid HumanApprovalRecord
- valid CanonicalSourceStorageReceipt set / valid `not_required`
- valid MediaPublicationManifest
- valid MediaProtectionReceipt / valid empty protection result
- candidate hash unchanged
- public master/variant objects verified
- protection receipt object set matches publication manifest required object set

export:

- content MDX/frontmatter
- media / provenance registry
- canonical source hash/storage-class record
- separately approved taxonomy / interactive changes

export後、working tree bytesがcandidate-derived outputと一致することを再hashする。

AI draftを直接content treeへcopyして後追いapprovalするworkflowは禁止する。
