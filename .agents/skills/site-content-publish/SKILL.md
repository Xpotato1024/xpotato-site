---
name: site-content-publish
description: 内容と根拠が承認済みの公開コンテンツを xpotato-site の MDX、frontmatter、taxonomy、media、route 規約へ組み込み、repository-local validation 可能な状態にするときに使う。記事の調査・論旨作成や production deploy、R2 upload、raw camera media の変換には使わない。
---

# Site Content Publish

## Purpose

approved content を repository の publishing contract に安全に接続する。

記事そのものの research / argument / editorial design と、file placement / metadata / taxonomy / media reference / validation を分離する。

## Read first

1. `docs/product/product-context.md`
2. `docs/architecture/content-architecture.md`
3. `docs/architecture/media-pipeline.md`
4. `docs/architecture/seo-discovery-policy.md`
5. `docs/content/editorial-policy.md`
6. `docs/architecture/frontend-policy.md`
7. `docs/operations/validation.md`
8. task に関係する current collection schema / route implementation

vNext migration 完了前は proposed docs と current implementation に drift があり得る。target schema を旧実装へ無理に書き込まず、不一致を migration debt として報告する。

## Scope

Use for:

- approved article / note / project / tool / page の file placement
- frontmatter 作成・検査
- category / tag registry との整合
- slug / route / archive integration
- normalized local image / R2 logical reference の組み込み
- approved MDX content module import
- local validation

Do not use for:

- topic research
- material fact の創作・補完
- article argument の全面再設計
- HEIC / HEIF 等 raw camera file の decode / normalization
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
- category / tag archive membership
- legacy identity if applicable

を整理する。

existing route と衝突しないことを確認する。

legacy URL metadata を記録しただけで redirect active と報告しない。

### 3. Build minimal frontmatter from schema

current schema を読み、content semantics に必要な required field と allowed registry ID を満たす。

- date を推測で生成しない。
- category / tag typo を fallback に任せない。
- normal article に不要な SEO override を追加しない。
- canonical / OG / JSON-LD / sitemap が system-derived の target なら、author frontmatter に重複させない。
- draft state は user intent / publishing state に合わせる。不明なら勝手に public にしない。

### 4. Place assets by media policy

`docs/architecture/media-pipeline.md` に従う。

- typical article image: normalized web master under `src/assets/content/...`
- passthrough control / non-optimized small file: `public/`
- heavyweight / high-volume / downloadable: versioned R2 logical path

raw `.heic` / `.heif` を通常記事 asset としてそのまま commit しない。

raw camera source しかない場合は、media ingest が未実行であることを required step として報告する。Skill 自身が ad-hoc image converter を即席実装して bypass しない。

R2 upload はこの Skill の side effect ではない。object が存在しない場合は required external step として止める。

### 5. Integrate MDX safely

- ordinary prose / code / image は Markdown / MDX を標準とする。
- caption / gallery / callout / comparison 等は approved typed content module を使う。
- 新規 `LegacyHtml` wrapper を作らない。
- interactive component を埋め込む場合は `docs/architecture/frontend-policy.md` に従い、必要な最小 hydration directive を選ぶ。
- article-only React island を unrelated route へ import しない。

### 6. Validate links, media, SEO derivation and publication safety

- local link / asset path
- external URL where practical
- alt text
- category / tag registry
- archive route
- secret / private hostname / internal URL
- route conflict
- legacy redirect requirement
- SEO override necessity / validity

を確認する。

### 7. Run repository validation

repository が定義する deterministic entrypoint を使う。

vNext implementation 後の expected baseline:

- reproducible install
- Astro / TypeScript check
- production build
- content / taxonomy / route / asset validator
- representative media output validation

local host へ Node を直接 install することを前提にせず、repo-defined container / CI entrypoint を優先する。

### 8. Report, do not deploy

最終報告には:

- collection / route
- category / tags / archives
- changed content / normalized asset files
- validation result
- unresolved media ingest / external asset / redirect step
- draft / public state

を含める。

production deploy は別の明示 task とする。

## Definition of Done

- current schema に適合している、または migration drift が明示されている。
- route / slug / taxonomy conflict がない。
- asset ownership が media policy に適合している。
- raw camera file / raw legacy HTML を新規 publication path に導入していない。
- ordinary image が responsive optimization path に乗る。
- required validation が通っている、または実行不能理由が明示されている。
- publish state を勝手に変更していない。
- deploy / external upload を暗黙に実行していない。

## Stop / escalation

次の場合は無理に publish-ready としない。

- approved article と current schema が material に矛盾する
- raw camera media の ingest tooling が未実装 / 失敗
- route / legacy redirect owner が不明
- required R2 asset が未配置
- public / private boundary が不明
- vNext proposed design と current implementation のどちらへ合わせるべきか task scope から決められない
