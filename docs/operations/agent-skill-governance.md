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
| `docs/` | stable product / architecture / policy / operation SoT |
| `.agents/skills/` | 条件付きで再利用する 1 job 単位の workflow |
| Skill `references/` | workflow 実行時だけ必要な詳細 reference / research evidence |
| `scripts/` / CLI | deterministic で反復する処理 |
| CI / validator | machine-enforceable invariant |
| Issue / PR / Git state | task-specific / changing state |
| ADR | decision provenance |

同じ詳細ルールを AGENTS.md と Skill と canonical doc へ全文複製しない。

## Product context routing

すべての material design / implementation task は `docs/product/product-context.md` の目的に反しないことを確認する。

framework の慣習や既存 implementation を、authoring simplicity、content durability、delivery efficiency より無条件に優先しない。

## AGENTS.md

root `AGENTS.md` は短い router とする。

最低限:

- repository scope
- `docs/README.md` / product context read-first
- `docs/` と legacy `doc/` の境界
- frontend / content / media の最重要 invariant
- available Skills と trigger
- Git / validation rule

architecture の詳細は canonical doc へ route する。

## Agent Skills format

repository-local Skill は Agent Skills open specification の最小形式へ合わせる。

- 1 directory = 1 Skill
- `SKILL.md` required
- frontmatter は `name` / `description` を必須とする
- detailed evidence / templates は `references/` / `assets/` へ分離する
- deterministic processing が必要になった場合のみ `scripts/` を追加する
- progressive disclosure を利用し、SKILL.md に全資料を埋め込まない

## Initial Skills

初期導入は2つに限定する。

### `japanese-technical-blog`

日本語技術記事の research、claim/evidence 整理、outline、draft、revision、editorial review を行う。

deployment や Git push は責務に含めない。

### `site-content-publish`

approved article を repository の MDX / frontmatter / taxonomy / normalized asset convention へ組み込み、local validation 可能な状態にする。

記事の論旨を独断で大幅再設計したり production deploy / R2 upload したりしない。

## Media ingest is deterministic tooling first

HEIC / HEIF decode、orientation、metadata strip、resize、filename normalization は article-writing Skill の自然言語手順ではなく deterministic media-ingest tool / container を正本にする。

実装後、Agent がその tool を安全に呼び出す反復 workflow が明確になった場合だけ `site-media-ingest` Skill を追加する。

先に Skill を作り、内部で platform-dependent ad-hoc conversion command を毎回再構成する運用にはしない。

## Why not copy the full Skill lifecycle system yet

他 repository で使用している candidate / eval / promotion governance は、多数の Skill と反復 routing がある場合に価値が高い。

この site では初期2 Skill のため、最初から candidate store、score、implicit promotion validator を導入しない。まず open Skill format + explicit routing + review で運用し、Skill が増えるか misrouting が反復した時点で lifecycle system の導入を ADR / governance update として検討する。

これは governance を弱めるためではなく、検証されていない ceremony を SoT 化しないためである。

## Side effects

Skill は permission を拡張しない。

- article Skill: source read / draft edit まで
- publish Skill: repository-local file edit / validation まで
- media-ingest tool: repository-local normalized derivative generation までを将来の標準 scope とし、external upload は別権限
- production deploy、external upload、credential operation は explicit task / permission が必要

## Skill evidence

OSS Skill の wording をそのままコピーしない。useful pattern を抽出し、repository policy と研究 evidence に基づいて独自 Skill とする。

source provenance は Skill `references/` と `docs/references/external-sources.md` に残す。
