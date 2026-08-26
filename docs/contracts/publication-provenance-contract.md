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

full Article Job workspaceをpublic Gitへ保存せず、将来のupdate / audit / migrationに必要なcompact lineageだけをcontent revisionと一緒に保存する。

## Required scope

Article Job経由でpublished / updatedされたcontentはprovenance record required。

legacy migration / manual contentもorigin classificationを持つrecordを作れる。

## Record

```ts
type PublicationOrigin =
  | "article_job"
  | "legacy_migration"
  | "manual";

interface PublicationProvenanceRecord {
  schemaVersion: 1;
  contentId: ContentId;
  origin: PublicationOrigin;

  content: {
    mdxSha256: string;
    frontmatterSha256: string;
    route: string;
  };

  articleJob?: {
    jobId: string;
    candidateSha256: string;
    approvalRecordSha256: string;
    evidenceBundleSha256: string;
    contentAuditSha256: string;
    visualAuditSha256?: string;
    mediaPublicationManifestSha256?: string;
  };

  sourceRefs: CompactSourceRef[];
  aiRuns?: CompactAiRunRef[];

  heroOrigin?:
    | "camera"
    | "screenshot"
    | "diagram"
    | "ai_generated"
    | "deterministic_cover";

  exportedAt: string;
}
```

## CompactSourceRef

private source snapshot bytesを保存しない。

```ts
type CompactSourceRef =
  | {
      kind: "url";
      canonicalUrl: string;
      publisher?: string;
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

private sourceは`publicDescription`だけにできる。

## CompactAiRunRef

```ts
interface CompactAiRunRef {
  role:
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

private prompt / chain-of-thoughtは保存しない。

## Location

candidate:

```text
apps/site/src/content-registry/provenance/<collection>/<content-id>.json
```

1 content ID = 1 current provenance record。

historyはGit history自体が保持するため、1 fileに全revision appendしない。

## Update use

Article update jobはcurrent provenanceをsupporting inputとして固定できる。

用途:

- previous source seed
- prior provider / Skill lineage確認
- last evidence bundle identity
- current content bytesのintegrity check

ただしpast provenanceをcurrent truthとはみなさない。

version-sensitive claimはsourceを再確認する。

## Manual edit drift

MDX / frontmatterが変更されたのにprovenanceのcontent hashが一致しない場合、validatorはdriftを検出する。

選択肢:

- Article Jobでupdateしprovenanceを再生成
- manual workflowで`origin=manual`としてnew provenanceを作る
- draft-only local editならpublish前に解消

silent stale provenanceは禁止。

## Legacy migration

legacy contentは:

```text
origin = legacy_migration
```

を持てる。

source refsが不明な場合は捏造しない。migration tag / old file blob等、確認できるlineageだけを記録する。

## Public disclosure

repository provenanceとpublic webpage上のAI disclosureは別policy。

このrecordが存在すること自体をreader-visible表示要件にしない。

## Validation

- contentId exists / unique
- MDX / frontmatter hash matches working revision
- Article Job originならcandidate + approval refs required
- public mediaを持つArticle Job publicationならmedia manifest ref required
- source refs secret-free
- unknown private path / credential pattern禁止
