---
status: proposed
owner: content
last_verified: 2026-08-25
canonical_for:
  - SEO and discovery policy
  - indexable metadata contract
---

# SEO and Discovery Policy

## Principle

search engine 向けの別コンテンツを作るのではなく、読者に有用な static HTML と明確な URL / metadata を正しく公開する。

主要 content を client-side rendering に依存させない。

## Canonical URL

`https://xpotato.net` を site canonical origin とする。

indexable page は原則として self canonical を original HTML `<head>` に持つ。

frontmatter に canonical override を許可する場合、SEO component はその値を実際に尊重し、schema だけに dead field を残さない。

canonical signal、redirect、sitemap の URL が互いに矛盾しないようにする。

## Title and description

indexable route は内容を識別できる title と description を持つ。

- title / description を page type ごとの boilerplate だけにしない。
- keyword repetition のために本文と異なる title を作らない。
- article title は human-readable な正本を metadata へ利用する。

## Open Graph / social metadata

share 用 metadata は canonical page content と一致させる。

preferred image を持つ page は absolute image URL、適切な dimensions / content を持つ。

## Structured data

JSON-LD を使用する場合は page に実際に存在する content / entity だけを記述する。

- site-level WebSite / organization-like metadata は重複生成を避ける。
- blog article は適切な Article / BlogPosting semantics を使用できる。
- project / tool へ rich-result type を付ける場合は、その type の current eligibility / required properties を official docs で確認する。
- rich result を得る目的で存在しない rating、author attribute、review、FAQ 等を捏造しない。

Google 等の supported structured-data feature は変化するため、実装時点の current official docs を確認する。

## Sitemap

sitemap は canonical かつ公開対象の route から生成する。

- draft を含めない。
- noindex route を原則含めない。
- redirect source を canonical URL として列挙しない。
- URL rename と redirect / sitemap update を同じ変更で行う。

## Robots and indexing

`robots.txt` は crawl policy、`noindex` は index policy として役割を混同しない。

preview / test / duplicate route が public origin 上に存在する場合は indexability を明示する。

404 は actual not-found semantics を返し、soft 404 用の通常ページを返さない。

## Archive / category pages

category / archive page は reader に独立した discovery value があり、stable canonical URL を持つ場合に indexable とする。

同一内容を query / filter combination ごとに無制限生成しない。client-only filter state を indexable URL として増殖させない。

## Internal links

重要 content は script-generated UI だけに依存せず通常の `<a href>` で辿れるようにする。

related article、category、project / tool link は reader navigation と情報構造を目的とし、SEO のためだけの大量リンクを生成しない。

## Legacy URLs

旧URLから新 canonical URL へ permanent redirect できるものは redirect を優先する。

legacy identity の ownership は `content-architecture.md` と `operations/deployment-boundary.md` を正とする。

## Validation

代表 route で次を検査する。

- title / description
- canonical
- indexability
- OG metadata
- structured data validity where present
- sitemap inclusion / exclusion
- redirect chain / target
- 404 behavior

## Sources

- Google Search Central, canonicalization: https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Google Search Central documentation updates: https://developers.google.com/search/updates
