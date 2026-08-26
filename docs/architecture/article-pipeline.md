---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - Article Job pipeline architecture
---

# Article Pipeline Architecture

## Design goal

中核は「LLMにMDXを1回書かせること」ではない。

**検証可能なsource / evidence bundleからarticle candidateとvisual candidateを構築し、独立監査、preview、人間承認、approved media publicationを経てrepository contentへexportすること**を目的とする。

`video-evidence-pipeline`のstage / artifact / manifest / gate patternを縮小移植する。ただしvideo transcription等の不要domainは持ち込まない。

field semanticsは`docs/contracts/`を正とする。

## Layers

```mermaid
flowchart TD
    A[Job Intake]
    B[Source Discovery / Acquisition]
    C[Evidence Construction]
    D[AI Authoring]
    E[Independent Content Audit]
    F[Bounded Revision]
    G[Visual Planning]
    H[Hero Generate / Ingest]
    I[Independent Visual Audit]
    J[Candidate Materialization]
    K[Astro Preview Validation]
    L[Human Review / Approval]
    M[Approved Media Publication]
    N[Repository Export]

    A --> B --> C --> D --> E
    E -->|P0/P1| F --> E
    E -->|clean| G --> H --> I --> J --> K --> L --> M --> N
```

## 1. Job intake

入力:

- topic / working title
- target collection
- reader outcome / assumed knowledge
- article mode
- user notes / repository refs / local assets
- public / private boundary
- network / external AI permission
- image-generation permission
- public media upload permission policy
- optional target taxonomy / legacy URL hints

出力はvalidated `ArticleJobSpec`とjob fingerprint。

exact contractは`contracts/article-job-contract.md`。

permissionのないexternal operationをsemantic agentが開始しない。

## 2. Source discovery and acquisition

source discovererはcandidate sourceを提案できるが、canonical evidence identityを自分で確定しない。

deterministic executorがsource referenceを固定する。

source type:

- official docs / release notes / standards
- public web page
- GitHub repository file / commit / release
- user-provided notes / logs
- local image / screenshot
- existing repository canonical docs

GitHub sourceは可能な限りcommit SHAへpinする。web sourceはcanonical URL、retrieved time、publisher、必要ならprivate snapshot hashを持つ。

web page全体をpublic repositoryへ複製しない。

## 3. Evidence construction

Evidence analystはfixed source bundleからatomic evidence candidateとambiguityを生成する。

1 evidence record = 1 propositionを基本とし、sourceが支持しない新しい因果関係を合成しない。

class:

- source fact
- user observation / experience
- inference
- recommendation
- unknown / limitation

external factをsource refなしにconfirmedへ昇格しない。

## 4. AI authoring

article authorには次をfixed inputとして渡す。

- job requirements
- selected evidence bundle
- unresolved ambiguity
- editorial Skill snapshot
- taxonomy registry snapshot
- content-module registry snapshot
- interactive-module registry snapshot

出力:

- `draft.mdx`
- `claims.jsonl`
- `metadata-proposal.json`
- `taxonomy-proposal.json`
- `visual-needs.json`
- author run record

AIは`apps/site/src/content/`へ直接writeしない。

## 5. Independent content audit

auditorはfresh contextでtarget draftとfixed evidenceを読む。

author prompt history、private reasoning、author claim ledgerを正解として渡さない。本文からmaterial claimを再抽出する。

severity:

- P0: fabricated fact/source、逆内容、publication safety breach、重大なfalse representation
- P1: material evidence gap、unsupported inference、version/date error、重要要件欠落、misleading instruction
- P2: clarity、redundancy、minor structure/style

P0/P1が残るcandidateはvisual stageへ進めない。

## 6. Bounded revision

revisionはvalidated findingとevidenceに限定する。

new material claimはevidence bindingと再auditを要求する。

automatic semantic revisionは有限回。上限後もP0/P1が残る場合は`BLOCKED`。

## 7. Visual planning

content audit clean後にhero strategyとarticle visual needを決める。

`visual-plan.json`:

- `source_media | ai_generated | deterministic_cover`
- semantic concept
- article relation
- forbidden factual depiction
- safe-area intent
- style profile
- source media refs
- alt / disclosure proposal
- factual inline visual need

plannerはimage bytesを生成しない。

## 8. Hero generation / ingest

### source media

`media-ingest-contract.md`に従いprivate normalized candidate masterを生成する。

### AI-generated

deterministic executorがvisual plan + style profile + hard restrictionsからgeneration requestをcompileし、`ImageGenerationBackend`を呼ぶ。

raw provider outputはimmutable private artifactとしてhashを固定する。

### deterministic cover

site design tokens + article metadataからdeterministicに生成する。

## 9. Independent visual audit

fresh-context vision auditorが:

- relevance
- fake UI / terminal / graph / metric
- garbled text
- unintended logo implication
- crop / composition
- visual quality
- publication safety

を検査する。

image generatorの自己評価だけに依存しない。

## 10. Candidate materialization

deterministic executorがprivate candidate treeを生成する。

- MDX
- resolved frontmatter
- local normalized media masters
- deterministic social card candidate
- semantic Media Registry proposal
- planned content-addressed R2 keys
- compact publication provenance
- candidate manifest

**public R2 uploadは行わない。**

candidate / approval bindingは`candidate-approval-contract.md`、object identityは`public-media-publication-contract.md`を正とする。

## 11. Preview validation

candidateをtemporary materializationしてAstro build / previewする。

preview media adapterはlocal candidate bytesを使う。

checks:

- schema / taxonomy
- route conflict
- SEO metadata
- logical media resolution
- responsive image HTML
- hero / OG
- accessibility
- client JS / performance budget
- representative screenshot

previewはcandidate hash + repository base commit + build fingerprintへbindする。

## 12. Human review and approval

human review package:

- rendered preview
- title / description / taxonomy
- source / evidence summary
- unresolved limitation
- content audit
- hero origin / visual provenance
- visual audit
- planned public R2 media objects
- update diff
- exact candidate hash

AI / Skillはapproval recordを作れない。

## 13. Approved media publication

human-approved exact candidateのlocal normalized mediaだけをpublic R2へpublishする。

```text
candidate media hash
  -> content-addressed object key
  -> upload or verified reuse
  -> post-upload verification
  -> MediaPublicationManifest
```

rules:

- approval前upload禁止
- same keyへのdifferent bytes overwrite禁止
- partial failureはidempotent retry
- registry export前に全required objectをverify

exact contractは`public-media-publication-contract.md`。

## 14. Repository export

prerequisite:

- exact candidate human-approved
- valid MediaPublicationManifest
- base repository state revalidated

export:

- `apps/site/src/content/...`
- `apps/site/src/content-registry/media/...json`
- taxonomy update if separately approved
- compact provenance where configured

**media binaryはGitへexportしない。**

PR creationは別external mutation。merge / deployはArticle Job権限外。

## Convenience runner

低レベルcontractは`prepare -> semantic run -> import`を正とする。

その上に:

```text
site article run <job>
```

を提供できる。

runnerは各stageを同じvalidator / state machine経由で実行し、semantic providerへcanonical write permissionを与えない。

## Implementation boundary

npm workspaces:

```text
packages/article-pipeline/
  src/
    domain/
    stages/
    providers/
    storage/
    cli/

packages/content-contracts/
packages/media-ingest/
packages/site-validators/
apps/site/
```

TypeScript + Zodを第一候補とし、JSON Schemaはdomain schemaから生成する。

HEIC decode等のnative toolchainは`media-ingest`へ閉じ込める。
