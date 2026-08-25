---
name: site-content-publish
description: 内容と根拠が承認済みの公開コンテンツを xpotato-site の MDX、frontmatter、collection、asset、route 規約へ組み込み、repository-local validation 可能な状態にするときに使う。記事の調査・論旨作成や production deploy、R2 upload には使わない。
---

# Site Content Publish

## Purpose

approved content を repository の publishing contract に安全に接続する。

記事そのものの research / argument / editorial design と、file placement / metadata / validation を分離する。

## Read first

1. `docs/architecture/content-architecture.md`
2. `docs/content/editorial-policy.md`
3. `docs/architecture/frontend-policy.md`
4. `docs/operations/validation.md`
5. task に関係する current collection schema / route implementation

vNext migration 完了前は proposed docs と current implementation に drift があり得る。target schema を旧実装へ無理に書き込まず、不一致を migration debt として報告する。

## Scope

Use for:

- approved article / note / project / tool / page の file placement
- frontmatter 作成・検査
- slug / route integration
- local image / R2 logical reference の組み込み
- approved MDX component import
- local validation

Do not use for:

- topic research
- material fact の創作・補完
- article argument の全面再設計
- production deployment
- Cloudflare credential operation
- R2 upload
- provider-level redirect mutation

## Workflow

### 1. Classify the content

`blog` / `notes` / `projects` / `tools` / `pages` から最も適切な collection を選ぶ。

existing collection と責務が一致しない場合、agent 判断だけで新 collection を作らない。

### 2. Determine stable identity

- slug
- canonical route
- legacy identity if applicable

を整理する。

existing route と衝突しないことを確認する。

legacy URL metadata を記録しただけで redirect active と報告しない。

### 3. Build frontmatter from schema

current schema を読み、required field と allowed enum / registry を満たす。

- date を推測で生成しない。
- category typo を fallback に任せない。
- canonical field が実装されていない migration phase では、field を置くだけで SEO が変わると主張しない。
- draft state は user intent / publishing state に合わせる。不明なら勝手に public にしない。

### 4. Place assets by ownership

- build-optimized site-owned image: repository image pipeline
- passthrough small static file: `public/`
- heavyweight / distributable: R2 logical path

R2 upload はこの Skill の side effect ではない。object が存在しない場合は required external step として止める。

content-bound R2 asset は versioned / immutable key を優先する。

### 5. Integrate MDX safely

- Markdown / MDX を標準とする。
- 新規 `LegacyHtml` wrapper を作らない。
- existing approved component を使う。
- interactive component を埋め込む場合は `docs/architecture/frontend-policy.md` に従い、必要な最小 hydration directive を選ぶ。
- article-only React island を unrelated route へ import しない。

### 6. Validate links and publication safety

- local link / asset path
- external URL where practical
- alt text
- secret / private hostname / internal URL
- route conflict
- legacy redirect requirement

を確認する。

### 7. Run repository validation

repository が定義する deterministic entrypoint を使う。

vNext implementation 後の expected baseline:

- reproducible install
- Astro / TypeScript check
- production build
- content / route / asset validator

local host へ Node を直接 install することを前提にせず、repo-defined container / CI entrypoint を優先する。

### 8. Report, do not deploy

最終報告には:

- collection / route
- changed content / asset files
- validation result
- unresolved external asset / redirect step
- draft/public state

を含める。

production deploy は別の明示 task とする。

## Definition of Done

- current schema に適合している、または migration drift が明示されている。
- route / slug conflict がない。
- asset ownership が適切。
- raw legacy HTML を新規導入していない。
- required validation が通っている、または実行不能理由が明示されている。
- publish state を勝手に変更していない。
- deploy / external upload を暗黙に実行していない。

## Stop / escalation

次の場合は無理に publish-ready としない。

- approved article と current schema が material に矛盾する
- route / legacy redirect owner が不明
- required R2 asset が未配置
- public / private boundary が不明
- vNext proposed design と current implementation のどちらへ合わせるべきか task scope から決められない
