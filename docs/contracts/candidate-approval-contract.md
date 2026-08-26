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
    masterArtifactSha256s: string[];
    variantManifestSha256s: string[];
    deliveryProfileSha256s: string[];
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
- normalized media masters
- deterministic responsive variant manifests
- delivery profiles
- visual/content audits
- registry proposals
- provenance proposal

から決定する。

R2 object / protection receiptがまだ存在しなくてもcandidate identityは確定できる。

## Collection visual optionality

Blogではcollection visual policyによりhero/social card required。

Notes / Projects / Tools / Pagesではhero optional。candidate schema自体をBlog前提にしない。

media 0件でもempty media-set manifestを生成してcandidate hashへbindできる。

## Preview

preview rendererはcandidate-local master/variant adapterを使用する。

public R2 upload / protected copy / Cloudflare Imagesをpreview prerequisiteにしない。

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
  plannedPublicMedia: string[];

  updateDiffRef?: string;
  isApproval: false;
}
```

review bundleはapprovalではない。

`mediaDeliverySummary`は通常、humanにformat binary全部を個別確認させるのではなく:

- master identity
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

AI / Skill / audit stageはこれを生成できない。

implementation CLIのhuman laneでのみ作成する。

## Approval invalidation

次のいずれかが変わればapproval stale。

- MDX / frontmatter
- route / ContentId binding
- citation compilation
- technical example verification-bound content
- selected media master bytes / visual audit
- media variant profile / variant manifest / generated variant bytes
- media publication plan / media registry proposal
- provenance proposal
- taxonomy semantics affecting article
- content audit target

Cloudflare Imagesのoptional cache/transform状態だけが変わっても、baseline prebuilt variant candidateが不変ならhuman approvalを無条件にinvalidにしない。

purely non-semantic build environment changeはapprovalを常に無効化しなくてもよいがpreview validationは再実行する。

## Media publication after approval

human approval後、`public-media-publication-contract.md`に従いexact candidate master + required baseline variantsだけをpublic R2へpublishする。

MediaPublicationManifestはcandidate SHA / approval SHA / media-set manifestへbindする。

media 0件のcandidateではempty successful publication manifestを許可できる。

Cloudflare provider-generated transform outputはapproval/publicationのcanonical object setにしない。

## Media protection before export

public media publication完了後、`published-media-protection-contract.md`に従ってrecovery-protectionを成立させる。

MediaProtectionReceiptは:

- candidate SHA
- approval SHA
- MediaPublicationManifest SHA
- exact published required master/variant object identities
- infra protection policy fingerprint

へbindする。

public media objectが存在するcandidateではprotection receiptなしにrepository exportできない。

media 0件ではdeterministic empty/none protection resultを許可する。

## Repository export

prerequisite:

- valid HumanApprovalRecord
- valid MediaPublicationManifest
- valid MediaProtectionReceipt / valid empty protection result
- candidate hash unchanged
- registry-bound R2 master/variant objects verified
- protection receipt object set matches publication manifest required object set

export:

- content MDX/frontmatter
- media / provenance registry
- separately approved taxonomy / interactive changes

export後、working tree bytesがcandidate-derived outputと一致することを再hashする。

AI draftを直接content treeへcopyして後追いapprovalするworkflowは禁止する。
