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
| `.agents/skills/` | 条件付きで再利用する 1 job / semantic role 単位の workflow |
| Skill `references/` | workflow 実行時だけ必要な詳細 reference / research evidence |
| `tools/` / scripts / CLI | deterministic executor / repeatable processing |
| schemas / domain models | AI exchange / artifact machine contract |
| CI / validator | machine-enforceable invariant |
| Issue / PR / Git state | task-specific / changing state |
| ADR | decision provenance |

同じ詳細ルールを AGENTS.md と Skill と canonical doc へ全文複製しない。

## Product context routing

すべての material design / implementation task は `docs/product/product-context.md` の目的に反しないことを確認する。

Blog authoring task は `docs/product/ai-authoring-context.md` の AI-first / human-approval boundary を追加で確認する。

framework の慣習や既存 implementation を、authoring simplicity、content correctness、traceability、delivery efficiency より無条件に優先しない。

## AGENTS.md

root `AGENTS.md` は短い router とする。

最低限:

- repository scope
- `docs/README.md` / product context read-first
- `docs/` と legacy `doc/` の境界
- frontend / content / media / Article Job の最重要 invariant
- available Skills と trigger
- Git / validation rule

architecture の詳細は canonical doc へ route する。

## Agent Skills format

repository-local Skill は Agent Skills open specification の最小形式へ合わせる。

- 1 directory = 1 Skill
- `SKILL.md` required
- frontmatter は `name` / `description` を必須とする
- detailed evidence / templates は `references/` / `assets/` へ分離する
- deterministic processing は Skill の prose ではなく `tools/` / CLI に置く
- progressive disclosure を利用し、SKILL.md に全資料を埋め込まない

## Current bootstrap Skills

現時点で repository に置く Skill は2つ。

### `japanese-technical-blog`

日本語技術記事の research、claim/evidence 整理、outline、draft、revision、editorial review を行う。

Article Job 実装時は authoring stage の bounded Skill として再利用 / 分割を検討する。

### `site-content-publish`

approved article を repository の MDX / frontmatter / taxonomy / normalized asset convention へ組み込み、local validation 可能な状態にする。

Article Job export が実装された後は manual / exceptional publishing workflow として責務を再評価する。

## Target Article Job semantic Skills

AI-first pipeline が採用されたため、単一 article Skill が全semantic roleを持つ構造にはしない。

proposed stage Skills:

- `discover-article-sources`
- `analyze-article-evidence`
- `japanese-technical-blog` または `draft-japanese-technical-article`
- `independent-article-audit`
- `revise-article-from-audit`
- `plan-article-visuals`
- `independent-visual-audit`

image generation は Skill ではなく deterministic executor が provider adapter を呼ぶ stage とする。

human approval は Skill ではない。

この target Skill files は pipeline request / response schema が確定する前に大量作成しない。まず role contract と software schema を正本化し、その後 exact response contract に合わせて Skill を追加する。

## Explicit stage binding first

Article Job stage は当初 fuzzy automatic routing を使わない。

request が exact Skill snapshot を明示し、semantic runner はその Skill と response schema に従う。

これにより「画像を作るべきか」「auditかauthorか」を agent の自由な Skill routing に任せない。

## Skill lifecycle system

`video-evidence-pipeline` 等で使う candidate / eval / promotion governance は反復 workflow が増えた場合に有効である。

Article Job では複数 Skill が予定されるため将来的な導入価値は高いが、stage schemas / provider exchange がまだ proposed の段階で full lifecycle machinery を先行導入しない。

実装・routing evidence が得られた後に:

- positive / negative trigger eval
- stale Skill snapshot detection
- candidate / promotion evidence
- explicit-only -> validated active

を別 ADR / governance update として導入する。

## Media ingest / image generation

HEIC decode、orientation、privacy metadata strip、resize、filename normalization は deterministic media-ingest tool / container を正本にする。

AI image generation も provider call 自体は executor / adapter が所有し、Skill は visual semantic brief だけを生成する。

生成 bytes、provider/model、prompt hash、provenance signal は article artifact model へ記録する。

## Side effects

Skill は permission を拡張しない。

- source / author / audit / visual semantic Skills: structured proposal only
- publish Skill: repository-local file edit / validation within explicit task
- media tool: repository-local normalized derivative generation
- image generation adapter: external API only when job authorization allows
- production deploy、R2 upload、credential operation、merge は separate explicit permission

## Skill evidence

OSS Skill の wording をそのままコピーしない。useful pattern を抽出し、repository policy と研究 evidence に基づいて独自 Skill とする。

source provenance は Skill `references/` と `docs/references/external-sources.md` に残す。
