---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - SEO and discovery policy
  - indexable metadata contract
---

# SEO and Discovery Policy

## Principle

search engine 向けの別コンテンツを作るのではなく、読者に有用な static HTML と明確な URL / metadata / archive を正しく公開する。

SEO authoring surface は簡潔にし、通常記事では content metadata から system が必要な signal を導出する。

主要 content を client-side rendering に依存させない。

## Author responsibility vs system responsibility

### Author

通常記事で入力するのは content semantics を中心とする。

- title
- description
- publication / update date
- category
- tags
- hero image where relevant

### System

通常は自動生成する。

- canonical URL
- `<title>` site suffix / pattern
- Open Graph / Twitter metadata
- BlogPosting / Article JSON-LD
- sitemap membership
- archive membership
- breadcrumb / related link semantics where used

SEO-only manual field を article ごとに増やさない。

## Canonical URL

`https://xpotato.net` を site canonical origin とする。

indexable page は原則として self canonical を original HTML `<head>` に持つ。

canonical override は syndicated / duplicate content 等の例外に限定する。

canonical signal、redirect、sitemap の URL が互いに矛盾しないようにする。

## Title and description

indexable route は内容を識別できる title と description を持つ。

- title / description を page type ごとの boilerplate だけにしない。
- keyword repetition のために本文と異なる title を作らない。
- article title は human-readable な正本を metadata へ利用する。
- search snippet を完全制御できると仮定せず、description は reader-facing summary としても成立させる。

## Open Graph / social metadata

share 用 metadata は canonical page content と一致させる。

preferred image を持つ page は absolute image URL と適切な image dimensions を持つ。

記事ごとに専用 OGP image を必須にしない。hero / representative image がある場合はそれを利用でき、ない場合は site default または将来の build-time generator を利用する。

## Structured data

JSON-LD を使用する場合は page に実際に存在する content / entity だけを記述する。

- site-level WebSite metadata は重複生成を避ける。
- blog article は適切な Article / BlogPosting semantics を使用する。
- rich result を得る目的で存在しない rating、review、FAQ、author attribute 等を捏造しない。
- provider が structured-data feature を変更するため、実装時点の current official docs を確認する。

## Taxonomy and archive SEO

archive は単なる duplicate list ではなく reader discovery page として設計する。

### Category archive

broad topic ごとの恒久入口として static route を持つ。registry description を page intro / metadata に利用できる。

### Tag archive

すべての tag を自動 indexable page にしない。

taxonomy registry の `archive` / `indexable` flag で、

- metadata-only tag
- navigable archive
- search-index target

を分離する。

### Year archive

year archive は chronological discovery 用に生成できる。indexability は content volume / uniqueness / user value を見て policy で変更できる。

### Filter state

query string や client-side combination ごとに indexable URL を増殖させない。

## Sitemap

sitemap は canonical かつ公開対象の route から生成する。

- draft を含めない。
- noindex route を原則含めない。
- redirect source を canonical URL として列挙しない。
- taxonomy registry で indexable でない archive を除外できる。
- URL rename と redirect / sitemap update を同じ変更で行う。

## Robots and indexing

`robots.txt` は crawl policy、`noindex` は index policy として役割を混同しない。

preview / test / duplicate route が public origin 上に存在する場合は indexability を明示する。

404 は actual not-found semantics を返し、soft 404 用の通常ページを返さない。

## Internal links

重要 content は script-generated UI だけに依存せず通常の `<a href>` で辿れるようにする。

- category / tag / year archive
- related article
- project / tool cross-link

を information architecture として利用する。

SEO のためだけの大量 link や keyword-rich anchor の機械生成は行わない。

## Performance relationship

SEO のために performance を犠牲にする client widget を追加しない。

主要 content、metadata、internal links は static HTML に存在し、Core Web Vitals target と両立させる。

## Legacy URLs

旧URLから新 canonical URL へ permanent redirect できるものは redirect を優先する。

legacy identity の ownership は `content-architecture.md` と `operations/deployment-boundary.md` を正とする。

## Validation

representative route で次を検査する。

- title / description
- canonical
- indexability
- OG metadata
- structured data validity where present
- sitemap inclusion / exclusion
- taxonomy archive metadata / indexability
- redirect chain / target
- 404 behavior

## Sources

- Google Search Central canonicalization: https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Google Search Central documentation updates: https://developers.google.com/search/updates
