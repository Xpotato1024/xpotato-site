---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - repository-local agent and Skill governance
---

# Agent and Skill Governance

## Knowledge placement

| Medium | Responsibility |
|---|---|
| `AGENTS.md` | 常時適用する短い規則、product context、read-first、Skill routing |
| `docs/` | stable product / architecture / contract / operation SoT |
| `.agents/skills/` | 条件付きで再利用する1 job単位のsemantic workflow |
| Skill `references/` | workflow実行時だけ必要な詳細reference / research evidence |
| deterministic CLI / packages | pin / validate / artifact / state / local processing |
| typed external operation | R2 publish/protect、provider mutation等の明示side effect |
| CI / validator | machine-enforceable invariant |
| Issue / PR / Git state | task-specific / changing state |
| ADR | decision provenance |

同じ詳細ルールをAGENTS / Skill / canonical docへ全文複製しない。

## Product context routing

material design / implementationは`docs/product/product-context.md`を上位判断基準とする。

framework慣習やlegacy implementationをauthoring simplicity / content durability / delivery efficiencyより無条件に優先しない。

## Article Job stage Skills

production semantic stages:

- `discover-article-sources`
- `analyze-article-evidence`
- `draft-japanese-technical-article`
- `independent-article-audit`
- `revise-article-from-audit`
- `plan-article-visual`
- `independent-visual-audit`

manual/non-pipeline support:

- `japanese-technical-blog`
- `site-content-publish`

## Why stage-specific Skills

- discovery proposalとsource pinningを分離
- authorとauditorのinstruction responsibilityを分離
- visual planner/generator/auditorを分離
- response schemaを狭くする
- exact Skill snapshotをartifact lineageへ固定
- 1 Skillへ調査/authoring/approval/side-effect permissionを集中させない

## Skill invocation

production Article Jobではfuzzy auto-chainしない。

stage requestがexact Skill ID / content snapshotを固定する。

Skill selectionはpermission grantではない。

## Skill lifecycle

implementation時にlightweight VEP-style validationを導入する。

minimum:

- positive / negative routing cases
- required input / forbidden action / response contract eval
- production bindingはvalidated Skillだけ
- Skill content hash / reference bundle hash snapshot
- pending request中のmaterial drift -> stale
- completed artifactをcurrent Skillへ再bindしない

candidate scoring / automatic self-promotionはreal routing evidenceが得られるまで必須にしない。

## Agent Skills format

- 1 directory = 1 Skill
- `SKILL.md` required
- `name` / `description` required
- detailed evidenceは`references/`等へprogressive disclosure
- deterministic processingをSkill自然言語へ埋め込まずpackage/CLIへ実装

## Ownership by role

Semantic Skill:

- source candidate proposal
- evidence candidate / ambiguity
- article draft proposal
- independent finding
- bounded revision proposal
- visual plan
- visual finding

Deterministic executor/package:

- source acquisition/pinning/hash
- request fingerprint / response schema validation
- canonical Article Job artifact write
- state transition
- citation compilation
- technical example extraction/verifier orchestration
- media normalization to private candidate
- candidate materialization
- Astro validation
- human approval record plumbing
- publication/protection receipt validation
- repository export

Typed external operation:

- external AI provider call where authorized
- public R2 media upload/reuse
- protected media copy/reuse
- production deploy
- provider-level redirect mutation

Semantic Skillはこれらside effectを自分で実行したことにしてはいけない。

## Human approval boundary

human approvalはSkillではない。

AI / Skill / convenience runnerはreviewer/confirmを代行しない。

## Source discovery boundary

`discover-article-sources`は候補sourceとrelevanceを提案するだけ。

- URLをcanonical evidenceとして自己承認しない
- fake revision/hashを生成しない
- actual source pinning/fetchはexecutor
- external browsing permissionをSkill自身が拡張しない

## Media ingest / publication boundary

`media-ingest`:

- HEIC decode
- orientation/color
- metadata strip
- resize/encode
- private candidate hash

まで。

Git/R2へ直接publishしない。

public media:

```text
human approval / migration authorization
 -> rights revalidation
 -> public R2 publication
 -> protected recovery receipt
 -> repository export
```

Skillはrights unknown mediaをauthorized扱いにしたり、R2/protection credentialを要求したりしない。

## Technical example boundary

AI code/command executionはSkill capabilityではない。

`packages/example-verifier`のisolated profileだけがbounded executionを所有する。

network/system/external mutation default deny。

## Side effects

Skillはpermissionを拡張しない。

- semantic Skills: structured response proposalまで
- media-ingest: private local derivativeまで
- example-verifier: isolated verification artifactまで
- repository export: approved/protected exact candidateのfeature branch writeまで
- deploy / public R2 write / protected-copy write / provider mutation / merge: separate explicit permission

## Skill evidence

OSS Skill wordingをそのままコピーしない。useful patternを抽出し、repository policy + research evidenceに基づいて独自Skillとする。

source provenanceはSkill references / `docs/references/external-sources.md`へ残す。
