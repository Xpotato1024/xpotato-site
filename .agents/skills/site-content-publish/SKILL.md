---
name: site-content-publish
description: 記事のサイト統合・本人限定レビューと、承認済みのmanual contentを、vNextのContentId、MDX/frontmatter、taxonomy、semantic media、route、interactive registry、provenance規約へ接続するためのSkill。記事調査、raw media変換、R2/Cloudflare操作、production deploy、human approvalの代行には使わない。
---

# Site Content Publish

## 現行の入口と記事URL

通常作業は[4つの編集経路](../../../docs/operations/content-workflows.md)を使う。記事はArticle Jobのprivate原稿→監査/承認→正式保存→exportが正規経路であり、このmanual支援Skillからcanonical MDXを新規生成しない。現行の記事URLは`/articles/<ContentIdの全128bitから導出した26文字ID>/`。slugを新規に考える必要はなく、タイトル・分類変更でもID/URLを維持する。下記の一般的なslug/route説明は記事以外、または明示的なURL移行の扱いであり、旧`/blog/<slug>/`を通常入口に戻さない。

固定ページの下書きは`npm run content -- page create`、ツールは既存installerを使う。SEOは`site-seo-review`、更新は`update-site`を参照する。関連Skillを全件連鎖実行する指示ではない。

## 本人限定の記事レビューSite

記事の新規追加・修正レビューではArticle Jobの正本、ContentId、実Siteコミットを特定し、実リポジトリのAstroレイアウトと共通生成処理で検証する。canonicalの直接編集や公開ステージの遷移は、レビュー用ビルドに含めない。

1. 主題と読者の目的に合わせてタイトル・概要・導入・本文・見出し・根拠・図表と媒体のaltを揃える。SEOの作業では `optimize-site-seo` を使用し、サイト固有の派生処理は `site-seo-review` で確認する。
2. 既存レジストリの主分類と、本文に関係する横断タグを選ぶ。IDとURLを維持し、記事本文・一覧カード・分類別一覧・タグ別一覧・タグ索引を生成し、実リンクで相互にたどれることを確かめる。タグの一覧化はレジストリの設定を尊重し、レビュー専用の確認用一覧を公開設定へ持ち込まない。
3. 実ビルドで記事ルート、Siteトップの入口、見出し・目次、メディアの読込、PC幅とスマートフォン幅を確認する。H1、一覧のタイトルと概要、HTML title/description、canonical、OG/Twitter、構造化データ、画像URLの整合を出力HTMLで検査する。
4. 本人限定プレビューでは認証とnoindexを維持し、記事や画像が本番の検索・sitemap・feed・公開artifactへ混入していないことを確認する。レビューの配布物から、テスト用ルートと対象外の非公開原稿を除外する。正式公開用のcanonical・構造化データ・検索・feed・sitemapは公開候補ビルドの生成処理で別途検査する。
5. ユーザーが更新を許可したレビューSiteは、作業完了ごとに検証済みの版を本人限定でデプロイし、最終状態・実URL・未検証項目を確認する。本番のDeploy・GitHub main・公開範囲の変更は個別の依頼に従う。

## Purpose

Manual/legacy-approved contentを**current lifecycleに違反せず**repository publishing contractへ接続する。

This Skill is not the normal AI-first Article Job replacement。It does not gain source/public/protected storage credentials or bypass Article Job/human/provider gates。

## Read first

1. `docs/architecture/design-status.md`
2. `docs/product/product-context.md`
3. `docs/architecture/content-architecture.md`
4. relevant frontmatter/taxonomy/route contracts
5. `docs/architecture/media-pipeline.md`
6. `docs/contracts/media-asset-registry-contract.md`
7. `docs/architecture/seo-discovery-policy.md`
8. `docs/architecture/frontend-policy.md`
9. `docs/operations/validation.md`
10. provider/media taskなら`docs/architecture/infrastructure-handoff.md`
11. current implementation/schema only after lifecycle permits implementation

If Design=`PRE_FREEZE_REVIEW`, do not write target vNext structures into legacy production implementation as if migration were active。Use this Skill for design/manual-content preparation only within explicit task scope。

## Do use for

- approved/manual content collection classification
- stable ContentId/route/frontmatter/taxonomy planning
- semantic `media:` references to already-authorized/persisted media records
- approved content-module usage
- Interactive Module Registry binding metadata
- manual/legacy publication provenance proposal
- deterministic validation/reporting

## Do not use for

- topic research / evidence invention / argument drafting
- Article Job semantic AI stages
- generating human approval
- HEIC/raw image decode/normalization/variants
- persistent canonical-source storage
- public R2 upload
- protected-media copy
- Cloudflare/DNS/provider mutation
- production deploy/merge
- automatic legacy migration while lifecycle blocked

## Workflow

### 1. Check lifecycle and content class

Read `design-status.md` first。

Choose only an existing collection unless a material architecture change is explicitly requested:

- blog
- notes
- projects
- tools
- pages

If target schema is proposed but implementation migration is blocked, report target mapping without mutating old implementation as if accepted。

### 2. Resolve stable identity separately from route

Every vNext content entry has stable UUIDv4 ContentId。

For existing vNext content:

- preserve same ContentId
- route/title/file rename does not create new identity

For new manual content after implementation gate opens:

- use repository-defined ContentId generator
- never use slug/date/legacy numeric ID as ContentId

Blog route is derived from immutable ContentId。Other collection slugs follow their route contract。An explicitly requested route rename requires redirect handling。

### 3. Build minimal frontmatter

Use collection contract only。

Rules:

- no manually duplicated canonical/OG/JSON-LD/sitemap/search metadata
- no hero/object/component/provider path in normal frontmatter
- taxonomy only existing stable registry IDs
- unknown taxonomy becomes explicit proposal, not silent new term
- do not invent date/publication state
- no arbitrary provider/SEO fields

### 4. Media: semantic refs only

**Do not place normal article/project/site photographic/raster media in `src/assets/content` or `public/`.**

vNext normal media model:

```text
raw input
 -> private canonical media processing
 -> approved canonical source storage
 -> public delivery objects
 -> protected exact copy
 -> Git Media Registry/provenance
```

This Skill only integrates media already represented by a valid/authorized Media Registry record or an explicitly approved migration/manual media transaction completed outside the Skill。

MDX authoring:

```md
![説明](media:semantic-asset-id)
```

Never write:

- direct site-owned R2/custom-domain URL as semantic source
- object key
- `r2:/...`
- raw `.heic/.heif`
- manually maintained AVIF/WebP variants

If only raw/unpersisted media exists, stop and report required media workflow。Do not improvise an ad-hoc converter/uploader。

### 5. Integrate MDX/modules

Use plain Markdown first。Approved semantic modules only when needed。

結論は読者の判断/次の行動で閉じる。必要な短い来歴・方法・限界は、対象snapshotで利用可能かつ承認済みの場合だけ任意のArticleEndnoteへ分ける（別Draft PR #182）。重要な条件・安全は本文に残す。未提供moduleを任意JSX/HTMLで補わない。新しい主張や承認範囲を変えるなら元の内容reviewへ戻す。

Do not:

- add new LegacyHtml wrapper
- add arbitrary runtime component imports
- put React source path/hydration directive in Tool/Blog MDX

Interactive content binds stable Interactive Module Registry ID。Runtime framework/hydration is registry/runtime implementation responsibility, not content authoring metadata。

### 6. Provenance / traceability

For Article Job content, use Article Job export path instead of this Skill to ensure cleanup-safe material claim/source/recovery lineage。

For truly manual/legacy content after implementation exists:

- create/update explicit manual/legacy Publication Provenance according to contract
- do not pretend manual content came through Article Job
- do not invent evidence history
- preserve known source/legacy identity only

If material claims need evidence review, route back to research/Article Job rather than manufacturing provenance。

### 7. SEO/discovery derivation

Validate that content-derived system can generate:

- canonical
- social metadata
- structured data
- archives/pagination/RSS
- related content
- MiniSearch document eligibility

Do not hand-maintain generated search index/archive/feed records in content source。

`site-seo-review`の担当範囲で検索別名、H1とschema対応時の`seo.titleOverride`、一つのdescriptionが詳細/一覧/meta/OG/Twitter/WebPage・BlogPosting JSON-LDへ一致して出ることを実renderで確認する。taxonomy/canonical/noindex/承認済みheroと公開権限は維持する。

### 8. Validate

Use repository deterministic validation when implementation gate is open。

Check at least:

- ContentId uniqueness/binding
- route/redirect
- frontmatter/taxonomy
- `media:` resolution + rights/provenance
- content module/interactive registry
- citation/provenance semantics applicable to origin
- SEO/discovery derivation
- no raster/raw/provider URL leakage
- no unexpected client runtime

Normal validation does not require remote media downloads/provider credentials。

### 9. Report; no deploy/provider mutation

Report:

- lifecycle status
- collection + ContentId + route
- taxonomy
- semantic media/interactive bindings
- provenance origin
- validation result
- unresolved media/provider/redirect/migration step
- draft/public intent

Do not claim R2/DNS/redirect/deploy happened unless a separate authorized operation actually did it。

## Definition of Done

- work is compatible with current lifecycle/task scope
- stable ContentId and route are not conflated
- frontmatter/taxonomy contracts satisfied
- no normal raster media added to Git
- semantic media refs resolve valid registry or are explicitly blocked pending external workflow
- no React path/hydration directive embedded in content
- manual/legacy provenance is truthful; Article Job provenance not forged
- deterministic validation passes where implementation exists, or unavailable step is explicitly bounded
- no approval/provider/deploy side effect was silently performed

## Stop / escalation

Stop rather than improvising when:

- Design/implementation gate does not permit requested migration write
- content identity is ambiguous
- unknown taxonomy/route owner
- only raw/unpersisted media exists
- media rights/provenance not authorized
- interactive module binding is missing
- manual content needs factual research/evidence work
- provider counterpart is still Proposed/blocked for required operation
- target vNext design conflicts materially with current implementation
