---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - content model
  - URL and taxonomy semantics
  - legacy content boundary
---

# Content Architecture

## Product relation

日常運用のprimary authoring unitは1本のMDX記事である。詳細な目的は`docs/product/product-context.md`。

Blogのexact frontmatterは`docs/contracts/blog-frontmatter-contract.md`、taxonomyは`docs/contracts/taxonomy-registry-contract.md`、content module APIは`docs/contracts/content-module-contract.md`を正とする。

## Content engine

Astro の current Content Layer / Content Collections を使用する。旧 `src/content/config.ts` 互換 API を target design としない。

implementation migration では current Astro major の推奨 loader / render API へ移行する。

## Collections

vNext の logical collections は次を基本とする。

- `blog`: 公開記事
- `notes`: 学習・技術ノート
- `projects`: 制作物 / project record
- `tools`: browser tool / utility
- `pages`: About 等の長期固定ページ

collection を増やすときは、URL、schema、navigation、ownership が既存 collection と実質的に異なることを示す。

## MDX-first authoring

### Ordinary content

次はMarkdown syntaxを第一選択とする。

- paragraph
- heading
- list
- code block
- table
- ordinary image
- link
- blockquote

通常記事を独自componentだらけにしない。

### Content modules

Markdownで意味を十分に表現できない場合だけapproved moduleを使う。

初期候補:

- `Figure`
- `Gallery`
- `Callout`
- `Steps`
- `Comparison`
- `LinkCard`
- `Details`
- `Demo`

記事ごとにad-hoc layout componentを追加しない。module contract変更はcontent migrationを伴うpublic authoring API変更として扱う。

## Common metadata principle

SEO / archive / OGP等のsystem-derived metadataをfrontmatterへ重複保存しない。

metadataは大きく:

1. author-provided content facts
2. system-derived values
3. exception-only overrides

へ分ける。

## Taxonomy

category / tagはregistry stable IDを使用する。

AI / authorがunknown tagを勝手にregistryへ追加しない。proposalとして別artifactへ出す。

## URL ownership

canonical URL は route implementation と content identity から決定する。

- blog: `/blog/<slug>/`
- notes: `/notes/<slug>/`
- projects: `/projects/<slug>/`
- tools: `/tools/<slug>/`
- pages: root-level page route を基本とする

route 変更時は redirect を同一変更で設計する。

## Redirect classes

application path redirect と provider / zone-level legacy redirect を区別する。

### Application path redirect

同一 site 内の path rename 等。site repository が owner であり、Cloudflare Workers Static Assets の `_redirects` 等へ build artifact として反映できる。

### Legacy query / provider redirect

WordPress の `/?p=...` のような query-string identity、domain-level redirect、zone rule。Static Assets `_redirects` の path rule では十分でないため、Cloudflare provider configuration の owner である `Xpotato-Server` 側で適用する。

content frontmatter の legacy URL field は historical identity の evidence として利用できるが、それだけで redirect が有効になったとみなさない。

## MDX safety / maintainability

新規記事では raw legacy HTML wrapper を標準にしない。

- Markdown / MDX を優先する。
- embedded component は approved module registryを使用する。
- article-specific interactive component は island boundary を明示する。
- generated / imported HTML を `set:html` する経路は legacy migration に限定する。

WordPress importer は active publishing workflow から隔離し、migration-only referenceとする。

## Asset references

- source-controlled optimized image: repository asset pipeline
- passthrough small static file: `public/`
- heavyweight / downloadable asset: R2

詳細は`media-pipeline.md`。

## AI authoring boundary

AI-generated draftは直接content collectionへ書かない。

Article Job private workspaceでsource / evidence / claim / audit / visual / candidate lineageを構築し、人間承認済みcandidateだけをrepositoryへexportする。

詳細は`article-pipeline.md`。

## Content correctness

frontmatter validation だけでなく、CI で少なくとも次を検査する。

- duplicate slug / conflicting route
- invalid category / tag
- broken local asset reference
- required image alt / dimensions where applicable
- canonical URL format
- legacy redirect registry conflict
- draft exclusion
- unknown MDX module
- article hero existence / valid visual audit binding
