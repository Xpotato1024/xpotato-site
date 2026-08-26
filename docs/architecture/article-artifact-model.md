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
- public delivery R2を唯一のrecovery copyにしない
- responsive mediaはexact prebuilt bytesをbaseline artifactとして持つ
- Git exportはcompact Publication Provenanceを必ず生成する
- private reasoningは保存要件にしない

## Artifact classes

| Class | Examples | Canonical in job | Git public repo |
|---|---|---:|---:|
| source | SourceRecord, source snapshot refs | Yes | compact refs only |
| evidence | evidence, ambiguity ledger | Yes | hash/compact refs only |
| authoring | draft, claims, metadata proposal | Yes/versioned | final MDX/metadata only |
| citation | logical markers, compilation manifest | Yes | compiled footnotes |
| example verification | records/results/log refs | Yes/versioned | summary hash |
| audit | content/visual findings | Yes/versioned | hash |
| generated raw visual | provider output bytes | Yes/immutable | No |
| canonical media source | privacy-normalized lossless WebP/sanitized SVG | Yes/immutable | hash/profile only |
| media variants | public delivery master + AVIF/WebP/fallback manifest | Yes/immutable | object refs/hash only |
| candidate | exact approval target | Yes/versioned | No |
| preview | build manifest/screenshots | Regenerate/bind | No |
| approval | human approval record | Append-only | hash through provenance |
| canonical source storage | private source-media receipt | Yes | compact source identity + receipt hash |
| media publication | public delivery manifest | Yes | registry refs + provenance hash |
| media protection | exact public-byte protected-copy receipt | Yes | receipt hash |
| publication provenance | compact revision lineage | Yes | Yes |
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

- role
- provider/model/snapshot where available
- Skill ID/hash
- request/response schema fingerprint
- external permission mode

## Source/evidence/citation/example

exact contracts:

- `../contracts/source-evidence-claim-contract.md`
- `../contracts/citation-export-contract.md`
- `../contracts/technical-example-verification-contract.md`
- `../operations/technical-example-profiles.md`

AI citationはfixed Source ID markerからcompileする。

example verification manifestはdraft hash/profile registryへbindする。

## Visual artifact

VisualPlanSetは0..N。

Blog等required visualのみnon-empty requirement。

AI raw visual bytesはjob-private immutable artifact。approved後に永久保存する必須要件ではない。

## Canonical media source artifact

`media-ingest-contract.md` + `media-processing-profiles.md`。

raster canonical source:

- lossless WebP
- exact SHA
- dimensions
- ingest profile/toolchain
- source/provenance lineage
- privacy metadata stripped

これはvisual audit/variant generation/future reprocessingのsource。

raw originalとは別artifact class。

## Delivery variant artifact

`media-variant-generation-contract.md`に従いcanonical sourceからdeterministic生成。

```ts
interface CandidateMediaSetArtifact {
  semanticAssetId: string;
  canonicalSourceSha256: string;
  ingestProfileSha256: string;
  variantManifestSha256: string;
  deliveryProfileSha256: string;
  plannedPublicObjectKeys: string[];
  provenanceRef: string;
  rightsRef: string;
}
```

fixed SVG/social/download等は`not_required` manifest可。

## Candidate binding

candidateは少なくとも:

- ContentId
- MDX/frontmatter
- create/update diff
- taxonomy/module snapshots
- source/evidence
- citation manifest
- technical example manifest
- content/visual audits
- canonical media source hashes/profiles
- delivery variant manifests/profiles
- private canonical source storage plan
- public publication plan
- Media Registry proposal
- Publication Provenance proposal
- repository base/build fingerprint

をbindする。

profile/source/output変更でapproval stale。

## Canonical source storage artifact

human approval後、public delivery publication前に生成。

exact contract=`../contracts/private-canonical-media-storage-contract.md`。

receipt binds:

- candidate/approval
- ContentId/assetId
- canonical source SHA
- storage class
- verified size

provider locator/credentialをGit-visible receiptへ含めない。

failure時public publicationへ進めない。

## Public media publication artifact

valid canonical source storage後だけ生成。

`MediaPublicationManifest` binds:

- candidate/approval
- semantic asset
- delivery master + required variants SHA/public keys
- variant manifest/profile
- uploaded/reused result
- immutable cache metadata verification

Cloudflare transform cache outputはcanonical artifactにしない。

## Media protection artifact

public delivery exact object setをprivate protected recovery planeへbindする。

MediaProtectionReceipt:

- candidate/approval/publication hash
- exact public object set
- protection class/policy fingerprint

provider credential/signed URL/account IDなし。

## Repository export artifact

prerequisite:

- HumanApprovalRecord
- CanonicalSourceStorageReceipt set / `not_required`
- MediaPublicationManifest
- MediaProtectionReceipt / empty protection result

Git export:

- MDX/frontmatter
- Media Registry
- CanonicalSourceRecord compact identity
- Publication Provenance
- separately approved taxonomy/interactive changes

Gitへ含めない:

- raw source
- canonical source bytes
- public variants bytes
- AI raw image bytes
- private source snapshots
- verifier logs
- prompts/private reasoning
- protected bytes

## Publication provenance

exact contract=`../contracts/publication-provenance-contract.md`。

保存するcompact lineage:

- content/candidate/approval hashes
- source/evidence/audit refs
- AI run refs
- example verification hash
- canonical source hash/profile/storage receipt hash
- public media manifest hash
- protected media receipt hash

full job historyはGitへappendしない。

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

`.local/`はGit非管理。

full workspaceは`../operations/article-job-retention-policy.md`に従いdurable Git ref確認後だけexplicit cleanupする。

## Schema SoT

implementationでは`packages/content-contracts` TypeScript/Zodをmachine-readable SoTにしAI exchange JSON Schemaを生成する。
