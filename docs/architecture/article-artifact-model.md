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
- derived artifactはinput artifactへ遡れる
- semantic AI responseとcanonical job artifactを分離する
- draft / audit / visual candidateはversioned
- pathではなくhash / artifact IDをidentityとする
- human approval前にpublic R2 / site content treeをmutateしない
- media binaryはGitへexportしない
- final repository exportはapproved candidate + verified media publicationからのみ生成
- private reasoningは保存要件にしない

## Artifact classes

| Class | Examples | Canonical in job | Git public repo |
|---|---|---:|---:|
| source | docs snapshot, GitHub ref, user notes | Yes | No |
| evidence | evidence records, ambiguity ledger | Yes | No |
| authoring | draft, claims, metadata proposal | Yes / versioned | No |
| audit | extracted claims, findings | Yes / versioned | No |
| visual plan | strategy, concept, restrictions | Yes / versioned | No |
| generated raw visual | exact provider output bytes | Yes / immutable | No |
| normalized candidate media | hero / photo / social card master | Yes / immutable | **No** |
| candidate | MDX + frontmatter + registry proposal + media plan | Yes / versioned | No |
| preview | build manifest, screenshot refs | Regenerate / bind | No |
| approval | human approval ledger | Append-only | Optional compact provenance only |
| media publication | R2 object publication manifest | Yes | Registry references only |
| definition | schemas, Skills, profiles | Repository SoT | Yes |

## Artifact envelope

material derived artifact:

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

AI artifactは追加lineage:

- role
- provider / model / snapshot where available
- Skill ID / content hash
- request fingerprint
- response schema fingerprint
- external API permission mode
- context / run ID if available

## Source record

article jobがどの版をevidenceとしたかを表す。

- GitHub: repository + commit SHA + path + blob hash
- official docs: canonical URL + retrieved time + response/snapshot hash where retained
- local note: source artifact hash
- photo/screenshot: source artifact hash + normalized evidence derivative if used

source bodyをpublic repoへ転載することはrequirementにしない。

## Evidence record

```ts
interface EvidenceRecord {
  evidenceId: string;
  proposition: string;
  sourceRefs: string[];
  class: "source_fact" | "user_observation" | "inference" | "recommendation" | "unknown";
  confidence: "high" | "medium" | "low" | "not_available";
  reviewStatus: "unreviewed";
}
```

## Claim record

```ts
interface ClaimRecord {
  claimId: string;
  text: string;
  draftSpan: { start: number; end: number };
  claimType: string;
  evidenceIds: string[];
}
```

auditorはauthor claim ledgerを正解として受け取らない。

## Visual plan

visual planはimage promptではなくsemantic artifact。

```ts
interface VisualPlan {
  strategy: "source_media" | "ai_generated" | "deterministic_cover";
  concept: string;
  styleProfileId: string;
  forbiddenDepictions: string[];
  altProposal?: string;
}
```

executorがprovider requestをcompileする。

## Image generation record

output bytesがidentity。

保持:

- generation request hash
- compiled prompt hash / private prompt ref
- provider / model / snapshot
- parameters
- candidate index
- raw output SHA / dimensions / media type
- provenance signal observation
- moderation result
- visual audit ref
- selected / rejected status

same requestからsame bytesを期待しない。

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

public object keyはcontent hashからapproval前に計算できるが、uploadはしない。

## Candidate manifest

approval targetとして少なくとも:

- article MDX hash
- resolved frontmatter hash
- taxonomy snapshot hash
- content / interactive module registry snapshot hash
- source bundle hash
- evidence bundle hash
- content audit hash
- visual audit hash
- exact local candidate media hashes
- planned media publication hash
- repository base commit
- build/profile fingerprint

をbindする。

## Media publication artifact

human approval後にのみ生成。

MediaPublicationManifestは:

- candidate hash
- approval record hash
- semantic asset ID
- object SHA / R2 object key
- uploaded/reused action
- verification result

をbindする。

R2 object自体はGit artifactではない。

## Repository export artifact

repository exportに含む:

- MDX
- frontmatter
- per-content Media Registry JSON
- approved taxonomy change if any
- compact publication provenance if configured

含めない:

- photos
- screenshots
- AI hero binary
- responsive derivatives
- raw provider output

## Publication provenance

full Article Job workspaceはprivate。

optional compact repo-side provenance:

- candidate hash
- Article Job ID
- human approval hash
- evidence/source bundle hashes
- hero origin
- generated hero provider/model identity
- R2 media publication manifest hash

private source body、credential、provider response全文、prompt全文をpublic sidecarへ要求しない。

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
├─ audit/content/
├─ visuals/
│  ├─ plans/
│  ├─ generated/raw/
│  ├─ normalized/
│  └─ audits/
├─ media/
│  └─ normalized/
├─ candidate/vNNN/
│  ├─ article.mdx
│  ├─ registry/
│  ├─ local-media/
│  └─ manifest.json
├─ preview/vNNN/
├─ approval/records.jsonl
├─ publication/media/
└─ manifests/stages/
```

`.local/`はGit管理しない。

## Schema SoT

Article Job schemaは`packages/content-contracts`のTypeScript/Zodをmachine-readable SoTとし、provider exchange用JSON Schemaを生成する。
