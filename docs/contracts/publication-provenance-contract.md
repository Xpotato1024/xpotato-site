---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - repository-side content publication provenance
  - AI-published revision lineage
---

# Publication Provenance Contract

## Purpose

full Article Job workspaceをGitへ保存せず、将来update/audit/migration/reprocessingに必要なcompact lineageだけをcontent revisionと一緒に保存する。

## Record

```ts
type PublicationOrigin = "article_job" | "legacy_migration" | "manual";

interface PublicationProvenanceRecord {
  schemaVersion: 1;
  contentId: ContentId;
  origin: PublicationOrigin;

  content: {
    mdxSha256: string;
    frontmatterSha256: string;
    route: string;
    updateDiffSha256?: string;
  };

  articleJob?: {
    jobId: string;
    candidateSha256: string;
    approvalRecordSha256: string;

    sourceBundleSha256: string;
    evidenceBundleSha256: string;
    citationCompilationSha256: string;
    technicalExampleVerificationSha256: string;
    contentAuditSha256: string;
    visualAuditSha256?: string;

    canonicalSourceStorageReceiptSetSha256: string;
    mediaPublicationManifestSha256: string;
    mediaProtectionReceiptSha256: string;
  };

  mediaSources?: CompactCanonicalMediaSourceRef[];
  sourceRefs: CompactSourceRef[];
  aiRuns?: CompactAiRunRef[];

  exampleVerification?: {
    manifestSha256: string;
    profileRegistrySha256: string;
  };

  visualOrigins?: Array<
    | "camera"
    | "screenshot"
    | "diagram"
    | "ai_generated"
    | "deterministic_cover"
  >;

  exportedAt: string;
}
```

media 0件ではdeterministic empty source-storage/publication/protection resultを使えるため各stage hashをrequiredにできる。

## CompactCanonicalMediaSourceRef

private provider locatorをGitへ保存しない。

```ts
interface CompactCanonicalMediaSourceRef {
  assetId: string;
  canonicalSha256: string;
  format: "webp" | "svg";
  width?: number;
  height?: number;
  ingestProfileId: string;
  ingestProfileSha256: string;
  storageClass: "private_canonical_media_v1";
}
```

future reprocessingはこのidentityからinfra source-storage adapterへexact canonical objectを要求する。

bucket name/signed URL/account IDは不要。

## CompactSourceRef

private source bodyを保存しない。

```ts
type CompactSourceRef =
  | { kind: "url"; canonicalUrl: string; publisher?: string; publishedAt?: string; retrievedAt: string; snapshotSha256?: string }
  | { kind: "github"; repository: string; commitSha: string; path?: string; blobSha256?: string }
  | { kind: "doi"; doi: string }
  | { kind: "repository_doc"; path: string; commitSha: string; blobSha256: string }
  | { kind: "user_supplied"; publicDescription: string; artifactSha256?: string };
```

credential/private absolute path/source bodyを入れない。

## CompactAiRunRef

```ts
interface CompactAiRunRef {
  role:
    | "source_discovery"
    | "evidence"
    | "author"
    | "auditor"
    | "reviser"
    | "visual_planner"
    | "visual_auditor"
    | "image_generator";
  provider?: string;
  model?: string;
  snapshot?: string;
  skillId?: string;
  skillSha256?: string;
  requestSha256?: string;
  responseSha256?: string;
}
```

private prompt/reasoningを保存しない。

## Location

```text
apps/site/src/content-registry/provenance/<collection>/<content-id>.json
```

1 ContentId=1 current record。revision historyはGit history。

## Update/reprocessing use

Article update/media reprofile jobはcurrent provenanceをseedにできる。

- previous source discovery refs
- AI/tool lineage
- canonical media source hash/profile
- current public/protected media identity

past provenanceはcurrent truthではない。version-sensitive claimはcurrent sourceを再確認する。

canonical media source retrieve時はexpected SHAをverifyし、missing sourceを別imageでsilent replaceしない。

## Full workspace relationship

`operations/article-job-retention-policy.md`によりfull private workspaceはlong-term Git/R2 archive requirementではない。

workspace cleanup後もこのcompact record + durable media planesで:

- content revision identity
- future media reprocessing source
- public delivery/recovery
- AI/source/tool lineage summary

を維持する。

## Manual edit drift

MDX/frontmatterが変わったのにprovenance hash不一致ならfail。

Article Job updateまたはexplicit manual provenance updateで解消する。

## Legacy migration

`origin=legacy_migration`。

確認できるlegacy tag/file/mappingのみ記録しsource provenanceを捏造しない。

migrated mediaはcanonical source storage/publication/protection receiptsへbindできる。

## Validation

- ContentId resolves one content
- MDX/frontmatter hashes match
- Article Job origin -> candidate/approval/evidence/citation/example/audit/source-storage/publication/protection refs required
- canonical media source hash/profile valid and provider-locator-free
- source/public/protection hashes share same candidate/approval chain
- no private absolute path/credential/prompt/private reasoning
