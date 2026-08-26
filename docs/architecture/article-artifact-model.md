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
| normalized candidate media | photo/hero/social master | Yes / immutable | No |
| candidate | exact approval target | Yes / versioned | No |
| preview | build manifest, screenshots | Regenerate / bind | No |
| approval | human approval ledger | Append-only | hash through provenance |
| media publication | R2 object publication manifest | Yes | Media Registry refs + provenance hash |
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
    kind: "deterministic" | "semantic_ai" | "image_generator" | "human";
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

exact semanticsは`contracts/source-evidence-claim-contract.md`。

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

exact semanticsは`contracts/visual-artifact-contract.md`。

VisualPlanSetは0..N planを持つ。

Blog等のcollection policyでrequired visualがある場合のみnon-emptyを要求する。

AI-generated visual output bytes自体をimmutable artifactとしてhashする。

## Candidate media

candidate mediaはprivate local normalized bytes。

```ts
interface CandidateMediaObject {
  semanticAssetId: string;
  artifactSha256: string;
  plannedPublicObjectKey: string;
  provenanceRef: string;
}
```

planned public keyはapproval前に計算できるがuploadしない。

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
- exact candidate media hashes
- media publication plan
- Media Registry proposal
- Publication Provenance proposal
- repository base commit
- build/profile fingerprint

をbindする。

exact shapeは`contracts/candidate-approval-contract.md`。

## Media publication artifact

human approval後のみ生成。

MediaPublicationManifestは:

- candidate hash
- approval hash
- semantic asset ID
- object SHA / R2 key
- uploaded/reused action
- verification

をbindする。

media 0件ならempty successful manifestを許可する。

## Repository export artifact

Article Job exportに含む:

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

## Publication provenance

exact contractは`contracts/publication-provenance-contract.md`。

Article Job originではrequired。

保存:

- content/candidate/approval hashes
- source/evidence/audit lineage hashes
- compact SourceRefs
- compact AI run refs
- example verification summary hash
- media publication manifest hash

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
├─ media/normalized/
├─ candidate/vNNN/
│  ├─ article.mdx
│  ├─ registry/
│  ├─ provenance/
│  ├─ local-media/
│  └─ manifest.json
├─ preview/vNNN/
├─ approval/records.jsonl
├─ publication/media/
└─ manifests/stages/
```

`.local/`はGit管理しない。

## Schema SoT

Article Job schemaは`packages/content-contracts`のTypeScript/Zodをmachine-readable SoTとし、AI exchange用JSON Schemaを生成する。
