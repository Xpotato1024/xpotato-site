---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - Article Job artifact and lineage model
---

# Article Artifact Model

## Principles

- source artifactは取得後immutable
- derived artifactはinputへ遡れる
- semantic AI responseとcanonical job artifactを分離
- draft/verification/audit/visual/candidateはversioned
- pathではなくartifact ID/hashをidentityとする
- human approval前にpersistent media/site contentをmutateしない
- media binaryはGitへexportしない
- raw camera originalをsite long-term storageへ自動保存しない
- privacy-normalized canonical sourceをfuture reprocessing authorityとして分離する
- public delivery mediaを唯一のrecovery copyにしない
- responsive mediaはexact prebuilt bytesをbaseline artifactとして持つ
- full private job workspaceはephemeral; cleanup後に必要なtraceability/recoveryはGit compact lineageへmaterializeする
- private reasoningは保存要件にしない

## Artifact classes

| Class | Examples | Canonical in job | Durable Git |
|---|---|---:|---:|
| source | SourceRecord, source snapshot refs | Yes | CompactSourceRef |
| evidence | atomic evidence/ambiguity ledger | Yes | compact material-claim support ledger |
| authoring | draft, claims, metadata proposal | Yes/versioned | final MDX/metadata + claim support binding |
| citation | logical markers, compilation manifest | Yes | compiled footnotes + hash |
| example verification | records/results/log refs | Yes/versioned | summary/hash |
| audit | content/visual findings | Yes/versioned | hash/limitations summary as required |
| generated raw visual | provider output bytes | Yes/immutable | no |
| canonical media source | lossless WebP/sanitized SVG | Yes/immutable | hash/profile identity only |
| media variants | delivery master + AVIF/WebP/fallback | Yes/immutable | object refs/hash only |
| candidate | exact approval target | Yes/versioned | candidate/approval refs |
| preview | build manifest/screenshots | Regenerate/bind | no |
| approval | HumanApprovalRecord | Append-only | hash/time/reviewer provenance |
| canonical source storage | source-media receipt | Yes | compact source identity + receipt hash |
| media publication | public delivery manifest | Yes | media refs + manifest hash |
| media protection | full protection receipt | Yes | receipt hash + compact recovery binding |
| publication provenance | cleanup-safe revision lineage | Yes | Yes |
| definition | schemas/Skills/profiles | Repository SoT | Yes |

## Artifact envelope

```ts
interface ArtifactRecord {
  artifactId: string;
  artifactType: string;
  contentSha256: string;
  sizeBytes: number;
  relativeStoragePath: string;
  inputArtifactIds: string[];
  producer: {
    kind: "deterministic" | "semantic_ai" | "image_generator" | "human" | "infrastructure_adapter";
    name: string;
    version: string;
  };
  configurationSha256: string;
  createdAt: string;
  warnings: string[];
}
```

AI additional lineage:

- semantic role
- provider/model/snapshot
- Skill ID/hash
- request/schema fingerprints
- external permission mode

## Source / Evidence / Claim

Exact semantics=`../contracts/source-evidence-claim-contract.md`。

During job execution:

- SourceRecord -> exact source identity
- EvidenceRecord -> proposition + exact SourceRefs
- ArticleClaimRecord -> draft span + evidence IDs

Before durable export, exporter converts material claims into `CompactMaterialClaimBinding[]` defined by `publication-provenance-contract.md`。This preserves claim -> evidence interpretation -> source identity after detailed job artifacts are deleted。

Transition/non-material prose need not be kept in durable claim ledger。

## Citation / technical examples

- citation: `../contracts/citation-export-contract.md`
- technical examples: `../contracts/technical-example-verification-contract.md`
- runtime profile: `../operations/technical-example-profiles.md`

AI citation strings are not source authority。Example verification logs may be deleted after durable summary/hash and cleanup eligibility are satisfied。

## Visual / media artifacts

Canonical source:

- privacy-normalized lossless WebP / safe SVG
- exact SHA/dimensions/profile/toolchain/source lineage

Delivery variants:

- generated only after visual audit
- deterministic profile
- exact SHA/size/dimensions/content type

Candidate media set binds canonical source + ingest profile + variant manifest + delivery profile + rights/provenance。

## Candidate binding

Candidate binds at least:

- ContentId / MDX / frontmatter / route
- source bundle / evidence bundle / claim ledger
- cleanup-safe material claim ledger proposal
- citation and technical-example manifests
- content/visual audits
- canonical media source/profile
- delivery variants/profile
- source-storage/publication plans
- Media Registry proposal
- pre-persistence provenance proposal
- taxonomy/module snapshots
- repository base/build fingerprint

Changing material content/support/media/profile makes approval stale。

## Post-approval persistence artifacts

```text
HUMAN_APPROVED
 -> CanonicalSourceStorageReceipt
 -> MediaPublicationManifest
 -> MediaProtectionReceipt
 -> CompactMediaRecoveryBinding
 -> EXPORTED
```

These post-approval operational artifacts must bind the exact candidate/approval. They do not mutate approved content bytes; if persistence requires changing content/media/support, create a new candidate。

## MediaProtectionReceipt versus durable recovery binding

Full MediaProtectionReceipt is a private job artifact and may later be cleaned up。

Before export/cleanup, deterministic exporter derives a secret-free `CompactMediaRecoveryBinding` containing:

- protection class / policy fingerprint / full receipt hash
- each required public object SHA/key/size
- each opaque protectedObjectRef

Object sets must exactly match MediaPublicationManifest and full receipt。

## Repository export

Prerequisite:

- HumanApprovalRecord
- current compact material claim support ledger
- CanonicalSourceStorageReceipt set/not_required
- MediaPublicationManifest
- MediaProtectionReceipt/empty result
- compact media recovery binding when published media exists
- repository base/current candidate validation

Git export:

- MDX/frontmatter
- Media Registry
- compact CanonicalSourceRecord identity
- Publication Provenance including SourceRefs/materialClaims/mediaRecovery
- separately approved taxonomy/interactive changes

Never export:

- raw/canonical/variant media bytes
- full source snapshots
- full AI request/response
- verifier logs
- prompt/private reasoning
- protected media bytes

## Cleanup relationship

`../operations/article-job-retention-policy.md` / ADR-0024。

Cleanup is allowed only after exact durable Git ref contains cleanup-safe provenance and all source/public/protection chains validate. Full detailed evidence/receipts can then be removed from local job workspace without losing required claim traceability or restore entrypoint。

## Workspace layout

```text
.local/article-jobs/<job-id>/
├─ job.json
├─ sources/
├─ evidence/
├─ authoring/requests|responses|drafts/
├─ citations/
├─ examples/records|results|logs/
├─ audit/content/
├─ visuals/plans|generated/raw|normalized|audits/
├─ media/canonical|variants/
├─ candidate/vNNN/
├─ preview/vNNN/
├─ approval/records.jsonl
├─ publication/source|public|protection/
└─ manifests/stages/
```

`.local/` is Git ignored。

## Schema SoT

Implementation uses `packages/content-contracts` TypeScript/Zod as machine-readable SoT and generates AI exchange JSON Schema. Durable provenance schema is part of that machine SoT; prose cannot silently diverge。
