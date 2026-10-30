---
status: proposed
owner: content
date: 2026-10-30
---

# Articlesと自動発行の不変URL（設計確認用）

本人の「URLはArticles/ではないか」「毎回slugを考える手間をなくせないか」に対する案。routing・公開記事・redirectは変更していない。PR123のタグ整理と分離して採否を確認する。

## 現況

2026-10-30 03:23 UTCの匿名GETで、`/blog/`は200で記事なし、`/articles/`は404、`/rss.xml`は200でitem=0。`/sitemap-index.xml`と`/sitemap-0.xml`は200、Blog個別記事のlocは0だった。repositoryのBlog45件もすべてdraftである。

ただし、凍結legacyには公開状態だったBlog44件がある。現行のmigrationは同じContentIdを割り当て、全44件をmedia等のpublication holdにしている。現在の0件だけを理由に旧URLの連続性を捨てない。例：`/blog/2025-10-06/`はContentId `f202daa7-cb5c-4dd3-8b17-7bb6b1feefae`へ対応する。

現在のArticlesはナビゲーション名、内部collectionはblog、公開用sourceは`apps/site/src/content/blog/`。分類は単一の所属、タグは横断属性。画面上の「Articles→工作→3Dプリンタ」は記事URLを同じ深さにする意味ではない。3D記事自体はまだ`tests/fixtures/article-concrete/article.mdx`であり、公開用sourceへ移していない。

## 比較と推奨

| 方式 | 作成と並列処理 | 不変性・追加管理 |
| --- | --- | --- |
| `/articles/123/`の連番 | 全員が最後の番号を読んで+1するだけでは、同時PRで衝突する。atomicな共有採番か、Git上の予約台帳とCAS／直列merge・再試行が必要 | 一度予約／公開した番号を再利用・詰め直ししない。欠番を許す。番号と公開順は分ける |
| `/articles/<UUIDv4>/` | 既存executorの`crypto.randomUUID()`と一意性検査を使用。手動slug・中央DB不要 | 現ContentIdをそのまま使え、第二ID台帳不要。36文字で長め |
| `/articles/<26文字Base32>/` | UUIDの128bit全体を小文字Base32へ可逆符号化。並列作成時も現在のUUID発行を使う | **推奨**。UUIDを途中で切らず同じ全bitを保持するので、符号化による新たな衝突を作らない。内部UUIDも保持する |

3D記事の提案例は `/articles/77arj41r5z8amrn46pdx71mknr/`。Crockford Base32の小文字26文字へ、既存UUID全体を符号化した例である。実装済みURLではない。使用alphabet、leading padding、許容長、decode後のUUIDv4検査、大文字などの非canonical入力の扱いを契約へ固定する。

12文字や16文字への単純な切詰めは採用しない。例えば独立な60bitの乱数を100万件発行すると、birthday近似で衝突確率は約4.3×10^-7となり、ゼロではない。短い別IDを採用するなら、永続的なContentId対応表、発行時とmerge時の重複検査、未公開時の再発行が必要になる。今回の推奨は既存UUIDの全bitを保つため、その追加台帳を避けられる。

ContentIdはtitle・分類・公開日・file名と独立して維持する。公開順はpubDate等で管理し、URL番号を並び替えない。現在のArticle Job初期化にはslug入力が必要なので、採用時はcreate/exportも自動IDへ対応させ、入力欄だけを隠して内部で手動slugを要求し続けない。

## 採用した場合の一体変更

- Blog namespaceを`/articles/`へ揃える。記事は`/articles/<id>/`、分類は例`/articles/category/3d-printing/`、タグは`/articles/tag/fdm/`。taxonomyの祖先pathを記事URLに含めず、カテゴリ／タグのstable IDsも別に保持する。
- `/blog/`一覧は新一覧への301を用意する。既存のカテゴリ・タグ・pagination経路も対応表と同一末尾ルールで扱う。旧44記事のslugはContentId経由で新IDへ結び、再公開とredirectを同時に成立させる。未公開の新3D仮routeは外部公開されたURLとは扱わない。
- 既存redirect graphを検査し、`/blog/prime-factorizer/`→`/tools/prime-factorizer/`等の既存例外を壊さない。公開hold中の記事を、redirect追加の副作用で公開しない。存在しない記事への一括redirectで完成扱いにしない。
- canonical、OG/Twitter URL、Article/BreadcrumbList JSON-LD、本文内部リンク、関連・一覧・検索index・sitemapを同じroute resolverから再生成する。旧URLに別canonical本文を残さず、redirect chainやloopを作らない。
- RSSのGUIDは既に`canonicalOrigin#ContentId`であり維持できる。itemのlinkだけ新routeへ更新し、公開日を変更して新着に見せ直さない。feed `/rss.xml`自体の変更は不要。
- 内部collection名blogやsource folderのrenameはURL変更の必須条件ではない。routingとファイル名／出力pathを分離する。生成・validator・migration evidence・公開前後のread-backまで検証する。

[GoogleのURL指針](https://developers.google.com/search/docs/crawling-indexing/url-structure)は、可能なら読みやすい語を使うことを推奨する。一方、これはcrawlable URLの必須条件とは区別されている。ID URLを禁止する規則として扱わず、編集負担・不変性・人への共有しやすさと比較して選ぶ。URL方式だけで検索順位を保証しない。

この案の採用、URL実装／移行、PR123のmerge、記事公開、deployは未承認の別工程である。現行のrouting契約をこの文書だけで変更しない。
