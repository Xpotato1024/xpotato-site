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
- draft / verification / audit / visual / candidateはversioned
- pathではなくartifact ID / hashをidentityとする
- human approval前にpublic R2 / site content treeをmutateしない
- media binaryはGitへexportしない
- public delivery R2を唯一のrecovery copyにしない
- responsive mediaはprovider transformではなくexact prebuilt bytesをbaseline artifactとして持つ
- Article Job exportはcompact Publication Provenanceを必ず生成する
- private reasoningは保存要件にしない

## Artifact classes

| Class | Examples | Canonical in job | Git public repo |
|---|---|---:|---:|
| source | SourceRecord, snapshot/artifact refs | Yes | compact refs only through provenance |
| evidence | evidence, ambiguity ledger | Yes | hash/compact refs only |
| authoring | draft, claims, metadata proposal | Yes / versioned | final MDX/metadata only |
| citation | logical markers, compilation manifest | Yes | compiled footnotes in MDX |
| example verification | example records/results/log refs | Yes / versioned | summary hash through provenance |
| audit | extracted claims, findings | Yes / versioned | hash through provenance |
| visual plan | plan set, restrictions | Yes / versioned | No |
| generated raw visual | provider output bytes | Yes / immutable | No |
| normalized media master | photo/hero/social normalized candidate | Yes / immutable | No |
| media variants | AVIF/WebP/fallback responsive outputs + manifest | Yes / immutable | No |
| candidate | exact approval target | Yes / versioned | No |
| preview | build manifest, screenshots | Regenerate / bind | No |
| approval | human approval ledger | Append-only | hash through provenance |
| media publication | public R2 master/variant publication manifest | Yes | Media Registry refs + provenance hash |
| media protection | protected-copy receipt | Yes | receipt hash through provenance |
| publication provenance | compact revision lineage proposal | Yes | Yes |
| definition | schemas, Skills, profiles | Repository SoT | Yes |

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

AI artifact additional lineage:

- semantic role
- provider / model / snapshot where available
- Skill ID / Skill content hash
- request fingerprint / response schema fingerprint
- external API permission mode
- run/context ID if available

## Source / Evidence / Claim

exact semanticsは`../contracts/source-evidence-claim-contract.md`。

SourceRecordはtyped locatorを持ち、private locator / public citation metadataを分離する。

EvidenceRecordはexact SourceRecord hashへbindする。

ArticleClaimRecordはdraft span + evidence IDsへbindする。

## Citation compilation artifact

AI draftはvalidated Source ID logical markerを持てる。

executorはcandidate materialization前にCitationCompilationManifestを生成する。

```ts
interface CitationCompilationManifest {
  targetDraftSha256: string;
  sourceCatalogSha256: string;
  citedSourceRecordSha256s: string[];
  outputMdxSha256: string;
  warnings: string[];
}
```

final public MDXはstandard Markdown footnotes等のportable representationを持つ。

private/noneligible sourceをpublic URLへ変換しない。

## Technical example artifacts

DRAFTED後:

- `TechnicalExampleRecord[]`
- `TechnicalExampleVerificationResult[]`
- verification manifest
- private stdout/stderr artifact refs if applicable

を生成する。

```ts
interface TechnicalExampleVerificationManifest {
  targetDraftSha256: string;
  extractorVersion: string;
  profileRegistrySha256: string;
  resultRecordsSha256: string;
  overallStatus: "pass" | "limitations" | "failed" | "empty";
}
```

`overallStatus=pass`でもproduction suitabilityを証明しない。

## Visual artifacts

exact semanticsは`../contracts/visual-artifact-contract.md`。

VisualPlanSetは0..N planを持つ。

Blog等のcollection policyでrequired visualがある場合のみnon-emptyを要求する。

AI-generated visual output bytes自体をimmutable artifactとしてhashする。

## Media master artifact

`media-ingest-contract.md`に従うprivate normalized master。

masterは:

- exact SHA
- dimensions
- format
- ingest profile/toolchain
- source lineage

へbindする。

## Media variant artifact

`../contracts/media-variant-generation-contract.md`に従い、masterからdeterministic responsive variantsを生成する。

```ts
interface CandidateMediaSetArtifact {
  semanticAssetId: string;
  masterArtifactSha256: string;
  variantManifestSha256: string;
  deliveryProfileSha256: string;
  plannedPublicObjectKeys: string[];
  provenanceRef: string;
  rightsRef: string;
}
```

fixed SVG/social/download等でvariants不要の場合も`status=not_required` manifestを持つ。

planned public keysはapproval前に計算できるがuploadしない。

## Candidate manifest binding

approval targetは少なくとも:

- ContentId
- article MDX / frontmatter hash
- create/update diff hash where applicable
- taxonomy snapshot
- content / interactive module snapshots
- source / evidence bundle
- citation compilation manifest
- technical example verification manifest
- content audit
- visual plan/audit manifests
- exact media master hashes
- exact media variant manifest/profile hashes
- media publication plan
- Media Registry proposal
- Publication Provenance proposal
- repository base commit
- build/profile fingerprint

をbindする。

exact shapeは`../contracts/candidate-approval-contract.md`。

media profile/variant outputが変わればcandidate hashも変わり、既存approvalはstaleになる。

## Media publication artifact

human approval後のみ生成。

`MediaPublicationManifest`はsemantic assetごとに:

- candidate / approval hash
- master object SHA / public R2 key
- required variant object SHAs / public R2 keys
- variant manifest SHA
- uploaded/reused action
- verification

をbindする。

media 0件ならempty successful manifestを許可する。

Cloudflare Images等optional transform cache resultはcanonical publication artifactにしない。

## Media protection artifact

public media publication後、repository export前に生成する。

exact contractは`../contracts/published-media-protection-contract.md`。

MediaProtectionReceiptはpublication manifestに含まれる全required public objectを対象にする。

receiptにcredential / signed URL / Cloudflare account IDを保存しない。

public R2 upload成功・protection失敗時もcandidate / approval / publication artifactはimmutableで、protectionだけをidempotent retryする。

## Repository export artifact

Article Job export prerequisite:

- HumanApprovalRecord
- MediaPublicationManifest
- MediaProtectionReceipt or valid empty protection result

exportに含む:

- MDX/frontmatter
- per-content Media Registry JSON if media exists
- Publication Provenance JSON **required**
- separately approved taxonomy/interactive registry change if any

含めない:

- photos/screenshots/AI hero binary
- responsive variants
- raw provider output
- private source snapshot
- verification stdout/stderr
- prompt/private reasoning
- protected-copy bytes

## Publication provenance

exact contractは`../contracts/publication-provenance-contract.md`。

Article Job originではrequired。

保存:

- content/candidate/approval hashes
- source/evidence/audit lineage hashes
- compact SourceRefs
- compact AI run refs
- example verification summary hash
- media publication manifest hash
- media protection receipt hash

Git historyがrevision historyを保持するため、1 provenance fileへ全履歴をappendしない。

## Workspace layout

```text
.local/article-jobs/<job-id>/
├─ job.json
├─ sources/
├─ evidence/
├─ authoring/
│  ├─ requests/
│  ├─ responses/
│  └─ drafts/vNNN/
├─ citations/
├─ examples/
│  ├─ records/
│  ├─ results/
│  └─ logs/
├─ audit/content/
├─ visuals/
│  ├─ plans/
│  ├─ generated/raw/
│  ├─ normalized/
│  └─ audits/
├─ media/
│  ├─ normalized/
│  └─ variants/
├─ candidate/vNNN/
│  ├─ article.mdx
│  ├─ registry/
│  ├─ provenance/
│  ├─ local-media/
│  └─ manifest.json
├─ preview/vNNN/
├─ approval/records.jsonl
├─ publication/
│  ├─ media/
│  └─ protection/
└─ manifests/stages/
```

`.local/`はGit管理しない。

## Schema SoT

Article Job schemaは`packages/content-contracts`のTypeScript/Zodをmachine-readable SoTとし、AI exchange用JSON Schemaを生成する。
