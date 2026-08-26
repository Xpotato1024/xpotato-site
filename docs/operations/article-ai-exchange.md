---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - Article Job AI prepare / run / import operations
---

# Article AI Exchange Operations

## Purpose

Article Jobのsemantic AI stageをprovider-neutralで再実行・監査可能なexchangeとして扱う。

AIはcanonical workspaceへ直接writeしない。deterministic executorがrequestを固定し、responseをstrict validationしてartifactへ昇格する。

AI以外のexample verification、citation compilation、candidate build、media publication、exportも同じstate machine下のdeterministic stageとして扱う。

## Common semantic exchange

```text
prepare
  ↓
request.json
Skill snapshot
response schema
  ↓
semantic runner
  ↓
private response.json
  ↓
import
  ↓
strict validation
  ↓
canonical versioned artifact
```

## CLI target shape

exact binary nameはimplementation時に固定する。

```text
site article init
site article guide
site article source ...
site article evidence prepare|import
site article author prepare|import
site article examples assess
site article audit prepare|import
site article revision prepare|import
site article visual-plan prepare|import
site article image generate|import
site article visual-audit prepare|import
site article citations compile
site article candidate build
site article preview
site article review
site article approve
site article media publish
site article export
```

`site article run`はlegal next stageを順序実行するconvenience runner。human confirm / forbidden side effectを自動補完しない。

## `article init`

AI callなし。

create:

- new job ID
- new ContentId
- normalized ArticleJobSpec

update:

- existing ContentId resolution
- prior-state bundle
- update kind
- route-change permission

共通でfingerprint / permissionを固定する。

## Source stage

source discoveryは:

1. candidate discovery
2. deterministic acquisition / pinning

に分離。

search/AIが返したURLをそのままevidenceへ昇格しない。

SourceRecordはtyped locator、content/snapshot hash、public citation eligibilityを持つ。

GitHubは可能な限りcommit SHAへpinする。

## Evidence exchange

prepare input:

- fixed SourceRecords
- user notes
- required claims
- ambiguities
- evidence Skill snapshot

import validation:

- 1 proposition / record
- exact SourceRef hash
- interpretation class
- freshness status
- ambiguity preservation

## Author exchange

prepare:

- ArticleJob requirements
- selected evidence
- taxonomy registry snapshot
- content module registry snapshot
- interactive module registry snapshot
- editorial Skill snapshot

response:

- draft MDX
- claim ledger
- metadata/taxonomy proposals
- visual needs

citationはfixed Source ID logical markerだけを生成可能。URL/titleをcitationとして自由生成しない。

## Technical example assessment

`article examples assess`はAI Skillではない。

- MDX ASTからmaterial code/command/config/output blocksを抽出
- verification classを決める
- syntax/schema verifierまたはisolated sandbox profileを必要に応じて実行
- host direct arbitrary executionは禁止
- network default deny
- output/result artifactをhash
- verification manifestを生成

example 0件でもempty manifestを生成する。

## Content audit exchange

fresh context。

request:

- target draft
- fixed evidence/source catalog
- citation bindings
- technical example verification manifest
- job requirements

含めない:

- author private reasoning
- prompt history
- author self-evaluation

responseはP0/P1/P2 findingをtarget span + evidence/requirementへbindする。

## Revision exchange

validated findingだけを対象にする。

code/command block変更時はexample verification stale。

new material claimはsource/evidence bindingを要求する。

revision budget上限でP0/P1残存ならBLOCKED。

## Visual planning exchange

content audit clean後。

VisualPlanSetを返す。

Blog heroはrequired。他collectionでvisual不要ならempty plan set可能。

plannerはimage bytesを生成しない。

## Image generation / media ingest

### AI-generated

executorがVisualPlan + provider/style profileからImageGenerationRequestをcompile。

raw bytesをprivate immutable artifactとしてhashしnormalizeする。

### source media

`packages/media-ingest`のdeterministic contractへ渡す。

いずれもpublic R2 / Gitへ直接publishしない。

## Visual audit exchange

visual candidateごとにfresh vision audit。

visual 0件ならexecutorがempty audit manifestをdeterministic生成できる。

required Blog hero不足はpassにしない。

## Citation compilation

`article citations compile`はdeterministic。

- draft logical Source ID markerをparse
- exact SourceRecordをresolve
- citation eligibilityを検証
- standard Markdown footnoteへ変換
- compilation manifestを生成

AI-provided URL stringをcitation source metadataとして採用しない。

## Candidate build

public side effectなし。

- resolved frontmatter
- current ContentId
- compiled citation MDX
- technical example manifest
- taxonomy/media/interactive registry proposal
- local candidate media
- social card candidate where required
- planned content-addressed R2 keys
- Publication Provenance proposal
- candidate manifest

をprivate candidate treeへmaterializeする。

## Preview

candidate-local media adapterを使用する。

- Astro check/build
- route / SEO / structured data
- citation / footnote
- media responsive HTML
- hydration
- accessibility
- performance checks

R2 uploadをpreview prerequisiteにしない。

## Human review / approval

review package:

- exact candidate hash
- create/update diff
- rendered preview
- source/evidence/citation summary
- technical example verification summary
- audit / visual summary
- planned R2 media

`article approve`のみhuman approval recordを作る。

requires:

- exact candidate hash
- reviewer
- basis
- explicit confirm

AI/Skill/convenience runnerはconfirmを自動補完しない。

## Media publication

`article media publish`は`HUMAN_APPROVED`でのみlegal。

- approved exact candidate media bytes
- content-addressed immutable R2 key
- upload or verified reuse
- post-upload verification
- MediaPublicationManifest

partial failureはsame approval/candidateでidempotent retry。

media 0件ならempty successful manifestを生成できる。

## Export

`MEDIA_PUBLISHED`後のみ。

- candidate / approval / media manifest再検証
- base repository revalidation
- MDX/frontmatter
- media/provenance registry
- separately approved taxonomy/interactive change

をfeature branch working tree / patchへexportする。

media binaryはGitへexportしない。

PR creation / merge / deployは別operation。

## Guide

read-only。

current stateから:

- effective state
- next legal operation
- missing permission
- required request/schema/Skill/profile
- stale artifact
- blocking finding

を表示する。

不整合時に成功pathを推測しない。

## Initial error classes

- `INVALID_JOB_SPEC`
- `CONTENT_ID_NOT_FOUND`
- `CONTENT_ID_AMBIGUOUS`
- `PERMISSION_DENIED`
- `SOURCE_PIN_FAILED`
- `REQUEST_FINGERPRINT_MISMATCH`
- `RESPONSE_SCHEMA_INVALID`
- `SOURCE_REF_INVALID`
- `EVIDENCE_BINDING_INVALID`
- `CITATION_SOURCE_INVALID`
- `EXAMPLE_VERIFICATION_BLOCKED`
- `SKILL_SNAPSHOT_STALE`
- `CONTENT_AUDIT_BLOCKED`
- `VISUAL_AUDIT_BLOCKED`
- `RESOURCE_BUDGET_EXHAUSTED`
- `CANDIDATE_STALE`
- `APPROVAL_REQUIRED`
- `APPROVAL_STALE`
- `MEDIA_PUBLICATION_FAILED`
- `EXPORT_MISMATCH`

retryでconstraintを弱めない。
