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

full Article Job workspaceをGitへ保存せず、将来のupdate / audit / migrationに必要なcompact lineageだけをcontent revisionと一緒に保存する。

## Required scope

Article Job経由でpublished / updatedされたcontentはprovenance record required。

legacy migration / manual contentもorigin classificationを持てる。

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

    mediaPublicationManifestSha256: string;
    mediaProtectionReceiptSha256: string;
  };

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

media 0件のArticle Jobでもempty successful MediaPublicationManifestとdeterministic empty protection resultを持つため、両hashをrequiredにできる。

## CompactSourceRef

private source bytesを保存しない。

```ts
type CompactSourceRef =
  | {
      kind: "url";
      canonicalUrl: string;
      publisher?: string;
      publishedAt?: string;
      retrievedAt: string;
      snapshotSha256?: string;
    }
  | {
      kind: "github";
      repository: string;
      commitSha: string;
      path?: string;
      blobSha256?: string;
    }
  | {
      kind: "doi";
      doi: string;
    }
  | {
      kind: "repository_doc";
      path: string;
      commitSha: string;
      blobSha256: string;
    }
  | {
      kind: "user_supplied";
      publicDescription: string;
      artifactSha256?: string;
    };
```

credential / private absolute path / source bodyを入れない。

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

private prompt / private reasoningを保存しない。

example verifier、media publication、media protectionはsemantic AI runではないので`aiRuns`へ混ぜずdedicated lineageを持つ。

## Location

```text
apps/site/src/content-registry/provenance/<collection>/<content-id>.json
```

1 ContentId = 1 current provenance record。

historyはGit historyが保持するため1 fileへ全revision appendしない。

## Update use

Article update jobはcurrent provenanceをsupporting inputとして固定できる。

用途:

- previous source discovery seed
- previous source/AI/tool lineage確認
- current content bytes integrity
- last verification/audit identity
- current published media publication/protection identity

past provenanceはcurrent truthではない。

version-sensitive claimは必ずcurrent sourceを再確認する。

## Manual edit drift

MDX/frontmatterが変わったのにprovenance content hashが一致しない場合validatorはdriftを検出する。

解決:

- Article Job updateで再生成
- manual workflowで`origin=manual` recordを作る
- unpublished draftならpublish前に解消

silent stale provenanceは禁止。

## Legacy migration

legacy contentは`origin=legacy_migration`。

legacy tag / old file blob / migration mapping等、確認できるlineageだけを記録し、source provenanceを捏造しない。

legacy mediaをR2へ移行する場合、migration publication/protection receiptへbindできるcompact fieldを実装schemaで共有する。

## Public disclosure

repository provenanceとreader-visible AI disclosureは別policy。

provenance fileの存在自体をweb page表示要件にしない。

## Validation

- contentId resolves exactly one content
- MDX/frontmatter hash matches working revision
- Article Job origin -> candidate/approval/source/evidence/citation/example/audit/media publication/media protection refs required
- media publication manifest hashとprotection receipt hashのcandidate/approval chain一致
- updateDiff hash required when material update contract produces one
- source refs secret-free / private absolute path-free
- AI run refs do not contain prompt/private reasoning
