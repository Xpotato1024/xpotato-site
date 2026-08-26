---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - repository-side content publication provenance
  - durable AI-published revision lineage
  - cleanup-safe material claim traceability
  - cleanup-safe media recovery binding
---

# Publication Provenance Contract

## Purpose

Full Article Job workspaceをGitへ保存せず、workspace cleanup後も将来update/audit/migration/reprocessing/recoveryに必要な**compact, public-safe, human-readable lineage**をcontent revisionと一緒に保存する。

Hashだけを残して元artifactが消える設計にはしない。Product Contextが要求するmaterial claim traceabilityとpublished-media recoveryを、durable recordだけから開始できることを要求する。

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

  sourceRefs: CompactSourceRef[];
  materialClaims: CompactMaterialClaimBinding[];

  mediaSources?: CompactCanonicalMediaSourceRef[];
  mediaRecovery?: CompactMediaRecoveryBinding;

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

Article Job originでは`materialClaims` required。Material claim 0件ならempty arrayをexplicitに持つ。

Media 0件ではdeterministic empty source-storage/publication/protection resultを使えるためstage hashをrequiredにでき、`mediaRecovery`は`undefined`またはexplicit empty representationのどちらかをimplementation schemaで一意に固定する。

## CompactSourceRef

Durable source referenceはprivate source bodyを保存しないが、claim bindingがexact source identityを指せるよう`sourceId`とrecord hashを保持する。

```ts
type CompactSourceRef =
  | {
      sourceId: string;
      sourceRecordSha256: string;
      kind: "url";
      canonicalUrl: string;
      publisher?: string;
      publishedAt?: string;
      retrievedAt: string;
      snapshotSha256?: string;
    }
  | {
      sourceId: string;
      sourceRecordSha256: string;
      kind: "github";
      repository: string;
      commitSha: string;
      path?: string;
      blobSha256?: string;
    }
  | {
      sourceId: string;
      sourceRecordSha256: string;
      kind: "doi";
      doi: string;
    }
  | {
      sourceId: string;
      sourceRecordSha256: string;
      kind: "repository_doc";
      path: string;
      commitSha: string;
      blobSha256: string;
    }
  | {
      sourceId: string;
      sourceRecordSha256: string;
      kind: "user_supplied";
      publicDescription: string;
      artifactSha256?: string;
    };
```

Credential、private absolute path、signed URL、private source bodyを入れない。

Private-only sourceでも`user_supplied`等のpublic-safe description + hashでidentityを保てる。公開不能なlocatorを捏造してURL化しない。

## Durable material claim binding

Workspace cleanup後も次を回答可能にする:

> このpublished material claimは、どのevidence interpretationとどのvalidated sourceに基づくか？

```ts
interface CompactMaterialClaimBinding {
  claimId: string;
  statementSha256: string;

  locator: {
    headingId?: string;
    blockIndex?: number;
  };

  claimType:
    | "source_fact"
    | "user_experience"
    | "inference"
    | "recommendation"
    | "limitation";

  evidence: Array<{
    evidenceId: string;
    propositionSummary: string;
    propositionSha256: string;
    interpretation:
      | "explicit"
      | "direct_observation"
      | "reasonable_inference"
      | "user_experience"
      | "recommendation_basis"
      | "unknown";
    sourceIds: string[];
    freshnessChecked: boolean;
  }>;

  limitations?: string[];
}
```

Rules:

- `propositionSummary`はdurable/public-safe summary。raw private log/source bodyをcopyしない。
- `sourceIds`は同record内`sourceRefs[].sourceId`へresolveする。
- source_fact/inference/recommendation等のevidence requirementは`source-evidence-claim-contract.md`を維持する。
- transition/non-material proseはdurable material-claim ledgerへ入れなくてよい。
- statement全文をduplicateする必要はなく、current MDX locator + SHAでpublished textへbindする。
- material textが変わればbinding stale。

This is not a reader-visible citation list. Citation outputとinternal durable evidence traceabilityは別semantic。

## CompactCanonicalMediaSourceRef

Private provider locatorをGitへ保存しない。

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

Future reprocessingはこのidentityからinfra source-storage adapterへexact canonical objectを要求する。

## Compact media recovery binding

Full MediaProtectionReceiptがjob workspaceからcleanupされてもrestoreを開始できるよう、valid receiptからsecret-free subsetをexportする。

```ts
interface CompactMediaRecoveryBinding {
  protectionClass: "cloudflare_protected_copy_v1";
  policyFingerprint: string;
  mediaProtectionReceiptSha256: string;

  objects: Array<{
    sha256: string;
    publicObjectKey: string;
    verifiedSizeBytes: number;
    protectedObjectRef: string;
  }>;
}
```

Requirements:

- object set must exactly match required objects in current MediaPublicationManifest。
- `protectedObjectRef` is opaque but durable and secret-free。
- credential、signed URL、account secretを含めない。
- provider bucket/resource nameをsite-wide second SoTとして複製しない。Infra adapterが`protectionClass + protectedObjectRef`からactual provider locatorをresolveする。
- receipt hash alone is insufficient for cleanup eligibility。

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

Private prompt/reasoningを保存しない。

## Location

```text
apps/site/src/content-registry/provenance/<collection>/<content-id>.json
```

1 ContentId = 1 current record。Revision historyはGit history。

## Export derivation

Exporterはfull validated Article Job artifactsからcompact durable recordを生成する。

Before export success:

1. current MDX/frontmatter hashes verify
2. claim ledger + evidence bundle + SourceRecordsから`materialClaims/sourceRefs`をderive
3. private/public-unsafe data redaction validation
4. CanonicalSourceStorageReceipt set verify
5. MediaPublicationManifest verify
6. MediaProtectionReceipt verify
7. `mediaRecovery`をreceiptからderiveしobject-set equality verify
8. final provenance hash/current Git bytes verify

AI response自身がdurable provenanceを自己申告しない。

## Update/reprocessing use

Article update/media reprofile jobはcurrent provenanceをseedにできる。

- previous source discovery refs
- durable material claim support map
- AI/tool lineage
- canonical media source hash/profile
- current public/protected media identity

Past provenanceはcurrent truthではない。Version-sensitive claimはcurrent sourceを再確認する。

## Full workspace relationship

`operations/article-job-retention-policy.md` / ADR-0024によりfull private workspaceはlong-term archive requirementではない。

Workspace cleanup後もこのrecord + durable media planesで:

- published claim -> evidence/source traceability
- content revision identity
- future media reprocessing source
- public delivery exact recovery
- AI/tool lineage summary

を維持する。

## Manual edit drift

MDX/frontmatter/material claimが変わったのにprovenance hash/binding不一致ならfail。

Article Job updateまたはexplicit manual provenance workflowで解消する。

## Legacy migration

`origin=legacy_migration`。

確認できるlegacy tag/file/sourceだけを記録し、存在しなかったevidence provenanceを捏造しない。Legacy material claim ledgerはavailable evidenceに応じてbounded/emptyでよいが、migration statusを明示する。

## Validation

- ContentId resolves exactly one content
- MDX/frontmatter hashes match
- Article Job origin -> candidate/approval/evidence/citation/example/audit/source-storage/publication/protection hashes required
- every material claim has valid locator/hash and support policy
- every claim sourceId resolves exactly one CompactSourceRef
- no private body/credential/path in source/evidence summaries
- canonical media source hash/profile provider-locator-free
- mediaRecovery object set matches publication/protection chain
- protectedObjectRef is secret-free/opaque
- source/public/protection hashes share same candidate/approval chain
- no prompt/private reasoning
