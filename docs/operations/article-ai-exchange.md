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

AI以外のexample verification、citation compilation、candidate build、media publication/protection、exportもsame state machine下のdeterministic/infrastructure-bound stageとして扱う。

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
site article media protect
site article export
```

`site article run`はlegal next stageを順序実行するconvenience runner。human confirm / upload authorization / infrastructure privilegeを自動補完しない。

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

1. `discover-article-sources`等によるcandidate discovery
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
- verification class決定
- syntax/schema verifierまたはisolated sandbox profileを必要に応じて実行
- host direct arbitrary execution禁止
- network default deny
- result artifact hash + manifest

example 0件でもempty manifest。

## Content audit / revision

fresh content auditはtarget draft + fixed evidence + citation binding + example manifestを読む。

author private reasoning / prompt history / self-evaluationを正解として渡さない。

revisionはvalidated findingに限定。code/command変更でexample result stale。new claimはevidence binding required。

## Visual planning / generation / audit

content audit clean後にVisualPlanSetを作る。

Blog hero required。他collectionでvisual不要ならempty set可。

AI visual raw bytes / source media ingest resultはいずれもprivate candidate artifact。public R2 / Gitへ直接publishしない。

visual candidateごとにfresh independent audit。required visual不足はempty passにしない。

## Citation compilation

`article citations compile`:

- logical Source ID marker parse
- exact SourceRecord resolve
- citation eligibility validate
- standard Markdown footnoteへcompile
- compilation manifest生成

AI-provided URL stringをsource metadataに昇格しない。

## Candidate build

public side effectなし。

- resolved frontmatter / ContentId
- citation-compiled MDX
- example manifest
- taxonomy/media/interactive proposal
- local candidate media + rights/provenance
- planned content-addressed R2 keys
- Publication Provenance proposal
- candidate manifest

をprivate treeへmaterializeする。

## Preview

candidate-local media adapterを使用しAstro check/build、route/SEO/citation/media/hydration/accessibility/performanceを検証する。

public R2 upload/protectionをpreview prerequisiteにしない。

## Human review / approval

review package:

- exact candidate hash
- create/update diff
- rendered preview
- source/evidence/citation summary
- technical example summary
- audit/visual summary
- planned public media + rights summary

`article approve`だけがhuman approval recordを作る。

AI/Skill/convenience runnerはreviewer/confirmを自動補完しない。

## Media publication

`article media publish`は`HUMAN_APPROVED`でのみlegal。

- rights revalidation
- approved exact local media bytes
- content-addressed public R2 key
- upload or verified reuse
- post-upload verification
- MediaPublicationManifest

partial failureはsame approval/candidateでidempotent retry。

media 0件ならempty successful manifest。

## Media protection

`article media protect`は`MEDIA_PUBLISHED`でのみlegal。

site executor自身がCloudflare admin operationを直接実装する必要はない。`published-media-protection-contract.md`に従うtyped requestをinfra-owned operationへ渡し、secret-free MediaProtectionReceiptを受け取る。

validate:

- candidate / approval / MediaPublicationManifest hashes
- exact published object set
- expected SHA/key/size
- accepted protection class / policy fingerprint

protection失敗時:

- repository export禁止
- state=`MEDIA_PUBLISHED`
- public immutable objectを変更せずretry

media 0件ではdeterministic empty protection result可。

## Export

`MEDIA_PROTECTED`後のみlegal。

- candidate / approval / publication manifest / protection receipt再検証
- base repository revalidation
- MDX/frontmatter
- media/provenance registry
- separately approved taxonomy/interactive change

をfeature branch working tree / patchへexportする。

media binary / protected-copy bytesはGitへexportしない。

PR creation / merge / deployは別operation。

## Guide

read-only。

current stateから:

- effective state
- next legal operation
- missing permission
- required request/schema/Skill/profile
- external side effect class
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
- `MEDIA_PROTECTION_FAILED`
- `MEDIA_PROTECTION_MISMATCH`
- `EXPORT_MISMATCH`

retryでconstraintを弱めない。
