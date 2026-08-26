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

Full Article Job workspaceをGitへ保存せず、workspace cleanup後もupdate/audit/migration/reprocessing/recoveryに必要な**compact, public-safe lineage**をcontent revisionと一緒に保存する。

Hash onlyでrequired semantic/recovery contextが消える設計にはしない。一方でprivate source body、prompt、reasoning、full external-disclosure inventoryをGitへ長期保存しない。

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

    externalAiPolicyId: string;
    externalAiPolicySha256: string;

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

Article Job originでは`materialClaims` required。Material claim0件はexplicit empty array。

## CompactSourceRef

Durable source identity supports claim mapping without storing private source body。

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

Credential/private absolute path/signed URL/private source body禁止。Private-only source is represented by safe description/hash, never fabricated public URL。

## Durable material claim binding

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

- public-safe proposition summary only
- sourceIds resolve durable CompactSourceRefs
- support semantics cannot be strengthened during compacting
- all material published claims represented exactly once
- transition/non-material prose may be omitted
- changed material text/support => stale provenance

## Compact canonical media source

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

No provider locator in Git。Future reprocessing resolves provider resource through accepted infra adapter/current contract。

## Compact media recovery binding

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

- exact current public/protection required object set
- protectedObjectRef opaque/durable/secret-free
- no credential/signed URL/account secret
- receipt hash alone insufficient before cleanup

## Compact AI run lineage

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

  externalApiUsed: boolean;
  externalDisclosurePolicyId?: string;
  externalDisclosurePolicySha256?: string;
  externalDisclosureManifestSha256?: string;
  externalDisclosureModeSummary?: "none" | "exact" | "derived" | "mixed";
}
```

Rules:

- `externalApiUsed=false` -> mode summary `none`; no disclosure manifest required
- `externalApiUsed=true` -> policy ID/hash + exact request disclosure manifest SHA required
- summary indicates only safe mode class, not which private source/file was admitted
- no private prompt/source body/path/authorization note in durable record
- changing admitted representation/request causes new request/manifest/run lineage

Full ExternalAiDisclosureManifest remains private job artifact. Durable manifest hash proves which exact admitted request artifact set was used without exposing private inputs。

## Location

```text
apps/site/src/content-registry/provenance/<collection>/<content-id>.json
```

One current record per ContentId; revision history comes from Git history。

## Export derivation

Before export success:

1. verify MDX/frontmatter/current route hashes
2. derive `sourceRefs/materialClaims` from validated detailed artifacts
3. validate public-safe redaction/equivalence
4. verify each external AI run request/response + disclosure manifest/policy lineage
5. compact external disclosure lineage without private input inventory
6. verify canonical source storage receipts
7. verify MediaPublicationManifest
8. verify MediaProtectionReceipt
9. derive `mediaRecovery` and exact object-set equality
10. verify final provenance/current Git bytes

AI response itself cannot self-author durable provenance/disclosure authority。

## Update / reprocessing use

Durable provenance is historical/seed state, not current external fact authority。

Update jobs may use:

- previous source identities/material support map
- AI/tool/disclosure policy lineage
- canonical media source identity
- current public/protected media identity

Time-sensitive facts and current disclosure admissions are revalidated for the new job/request。

## Full workspace relationship

ADR-0024 / retention policy make the full private workspace ephemeral after durable conditions pass。

After cleanup, Git + durable media planes still provide:

- material claim -> evidence/source traceability
- AI/tool and safe disclosure policy/manifest lineage
- future media reprocessing source identity
- exact public media recovery entrypoint

Full private prompts/source snapshots/disclosure records/manifests/private reasoning may no longer be available by design。

## Manual / legacy

Manual/legacy origins must be truthful。Do not invent Article Job evidence/disclosure history that did not occur。

## Validation

- ContentId/current content hash match
- Article Job stage/candidate/approval/persistence hashes required
- every material claim support resolves durable source identity
- no private body/path/credential in durable source/evidence summaries
- external AI run has safe policy/manifest lineage when externalApiUsed
- no private disclosure inventory stored in compact AI run
- canonical media source provider-locator-free
- mediaRecovery exact public/protection equality
- protectedObjectRef secret-free
- no prompt/private reasoning
