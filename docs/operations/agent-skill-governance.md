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
| deterministic CLI | canonical request / import / artifact / state / export |
| CI / validator | machine-enforceable invariant |
| Issue / PR / Git state | task-specific / changing state |
| ADR | decision provenance |

同じ詳細ルールを AGENTS.md と Skill と canonical doc へ全文複製しない。

## Product context routing

すべての material design / implementation task は `docs/product/product-context.md` の目的に反しないことを確認する。

framework の慣習や既存 implementation を、authoring simplicity、content durability、delivery efficiency より無条件に優先しない。

## Skill architecture after Article Job adoption

Article Jobのsemantic stageは1つの巨大なblog-writing Skillへ集約しない。

stage-specific initial Skills:

- `analyze-article-evidence`
- `draft-japanese-technical-article`
- `independent-article-audit`
- `revise-article-from-audit`
- `plan-article-visual`
- `independent-visual-audit`

manual / non-pipeline workflow用:

- `japanese-technical-blog`: 一般的な記事調査・draft / editorial assistance。Article Job production stageでは上記narrow Skillsを優先。
- `site-content-publish`: approved/manual contentのrepository integration支援。Article Job exportのcanonical executorを置き換えない。

## Why stage-specific Skills

- authorとauditorのinstruction responsibilityを分離する。
- visual generatorとvisual auditorを分離する。
- response schemaをstageごとに狭くできる。
- Skill snapshotをartifact lineageへ固定できる。
- single Skillへsource discovery / authoring / approval permissionが集中するのを防ぐ。

## Skill invocation

Article Job production pathではSkillをfuzzy auto-chainしない。

stage requestがexact Skill ID / snapshotを固定する。

human conversational taskではAGENTS routingによりmatching Skillを選べるが、Skill selectionはpermission grantにならない。

## Skill lifecycle

Skill数がArticle Job導入で増えるため、implementation時にはVEP型のlightweight validationを導入する。

initial requirement:

- each Skill has positive / negative routing cases
- response contract / required input / forbidden actionをevalする
- production Article Jobで使用するSkillはvalidated stateだけを許可
- requestにSkill content hash / reference bundle hashをsnapshot
- pending request中のmaterial Skill driftはstaleとして扱う
- completed artifactをcurrent Skillへ再bindしない

ただしcandidate scoring / automatic self-promotion等の高度なlifecycleは最初から必須にしない。反復運用のevidenceが得られたら追加する。

## Agent Skills format

repository-local Skill は Agent Skills open specification の最小形式へ合わせる。

- 1 directory = 1 Skill
- `SKILL.md` required
- frontmatter は `name` / `description` を必須とする
- detailed evidence / templates は `references/` / `assets/` へ分離する
- deterministic processingはSkill本文ではなくCLI / packageへ実装
- progressive disclosure を利用し、SKILL.md に全資料を埋め込まない

## Deterministic vs semantic ownership

Semantic Skillが行う:

- evidence candidate
- article draft proposal
- independent finding
- bounded revision proposal
- visual plan
- visual finding

Deterministic executorが行う:

- source pinning
- request fingerprint
- response schema validation
- canonical artifact write
- state transition
- media normalization
- candidate materialization
- Astro validation
- approval record handling
- repository export

Skillはcanonical filesystem mutation permissionを自分で持たない。

## Human approval boundary

human approvalはsemantic Skillではない。

AI / Skill / convenience runnerはreviewer confirmを代行しない。

## Media ingest

HEIC / HEIF decode、orientation、metadata strip、resize、filename normalization は deterministic `media-ingest` workspace の責務。

記事Skillにplatform-dependent変換commandを埋め込まない。

## Side effects

Skill は permission を拡張しない。

- semantic Article Skills: provider-neutral response生成まで
- media-ingest: repository-local normalized derivative generationまで
- Article executor export: explicit approved candidateのfeature branch writeまで
- production deploy、R2 upload、credential operation、mergeは別permission

## Skill evidence

OSS Skill の wording をそのままコピーしない。useful pattern を抽出し、repository policy と研究 evidence に基づいて独自 Skill とする。

source provenance は Skill `references/` と `docs/references/external-sources.md` に残す。
