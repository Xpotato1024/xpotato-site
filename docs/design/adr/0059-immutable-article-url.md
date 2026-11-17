---
status: accepted
owner: content
date: 2026-10-30
---

# ADR-0059: Articlesの自動発行・不変ID URL

本人は`/articles/<自動発行ID>/`方式と必要な実装・commit／pushを承認した。実装はPR123の候補で、merge・記事公開・本番deployの認可ではない。Primeの別artifact配信をこのPRへ含めない。

## 決定

内部collectionは`blog`、既存frontmatterのlowercase canonical UUIDv4 ContentIdと原稿fileを保全する。public routeだけを`articleRoute(ContentId)`へ統一する。新規作成は既存`crypto.randomUUID()`で一度発行し、タイトル・分類・日付をURLへ含めない。手動slug入力を必須にしない。

UUIDの全128bitをCrockford Base32の固定alphabet `0123456789abcdefghjkmnpqrstvwxyz`、lowercase26文字、先頭0–7で可逆符号化する。UUIDv4の乱数部分は122bitであり、128bit独立乱数と説明しない。切詰め・大文字・別名・padding文字・非UUIDv4は拒否し、decode/encodeの一致を検査する。第二のID台帳・共有採番・中央DBは追加しない。UUIDの重複、public routeの重複、生成file pathの別ContentId所有は停止する。衝突を別IDへのsilent repairで隠さない。

例：ContentId `e7562440-e0bf-42a9-8a90-d66f4e1a4eb8`は`/articles/77arj41r5z8amrn46pdx71mknr/`となる。3D記事はfixtureのままで、このURLに公開したことを意味しない。

## 同一の生成規則

- catalogのpublic slug/route、Astro getStaticPaths、private candidate overlay schema、planned canonical、OG/Twitter、BlogPosting/BreadcrumbList、検索document、RSS item link、sitemapは同じID由来routeに従う。RSS GUIDは既存の`origin#ContentId`を維持する。公開日をURL移行のために変更しない。
- 新規の内部file名も自動IDを既定とする。既存原稿file名は変えず、`source.slug`（物理path）と`routeRecord.slug`（public ID）を分ける。mock exportはfileSlugを候補hashへ固定し、ID URLと物理path所有権をそれぞれ検査する。mockは通常buildから引き続き拒否する。
- 一覧は`/articles/`、分類は`/articles/category/<stable-slug>/`、タグは`/articles/tag/<stable-slug>/`、年別・paginationも同じprefixへ移す。主分類階層を記事URLの深さへ埋め込まない。Notes・Projects・ToolsのURL契約は維持する。
- 本文sourceとcode literalは書換えない。既知のsame-site旧記事参照はrendererで新URLへ解決し、query／fragmentを保持する。外部source URLは書換えない。

## 旧URLと公開保留

`apps/site/src/content-registry/article-url-history.json`を旧44件の対応表とする。凍結migrationのContentId割当との完全一致を回帰検査し、旧recordを新しい記事identityで置換しない。frozen migration payloadや原稿hashは変更しない。

`currentApplicationRedirects`は実catalogの公開状態で生成する。旧`/blog/`一覧は新一覧へ301。実在する分類・タグ・年別・paginationの旧経路は対応する新経路へ301。空archiveは生成せず、存在しない先へのwildcard redirectを設けない。旧記事44件はhold中なので対応表だけを保持し、実際にpublic detailが生成されるときにだけ301を有効にする。noindexでもpublished detailは存在するため、その互換redirectは成立する。hold解除は別の公開手続きであり、本変更では実行しない。

`/blog/prime-factorizer/`→`/tools/prime-factorizer/`、旧tools分類→`/tools/`を保持する。既存diary/infra/networkの旧分類redirectは新Articles一覧へ直接向け、不要なchainを作らない。sources重複・cycle・canonical routeとの衝突・target不存在は検査で拒否する。

WordPress queryやdomainのprovider ruleはServer所有の別工程。SiteはContentIdから新targetの要件を生成するだけで、provider ruleを変更・有効化しない。

## 検証と公開境界

可逆変換・不正形式・衝突／file所有権、44件のexact対応、公開／noindex／hold別redirect、意味リンクのquery/fragment、更新後のURL不変性を検査する。通常dist、private candidate、実テンプレートの隔離projectionとPC／mobile viewportを別々に確認する。Workers Static Assets local servingでGET/HEAD 301、target200、旧本文なし、範囲外404を検証する。

最終の通常distにはdraftや合成fixtureを含めない。PR123はDraftを維持し、URLの実運用切替はmergeとexact main artifactによる別の本番deploy後にread-backする。このADRのacceptedは公開状態の自己申告ではない。
