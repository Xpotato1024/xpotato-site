---
name: site-seo-review
description: xpotato-siteの記事・固定ページ・ツールのSEO入力と実build出力を確認する。title/description、canonical、SNS、構造化データと一覧・検索・feedの整合を扱う。検索順位保証や無関係なSEO実装変更には使わない。
---

# 公開ページのSEOを確認する

[編集入口](../../../docs/operations/content-workflows.md)と[SEO契約](../../../docs/architecture/seo-discovery-policy.md)を読み、対象ContentId、draft/noindex、公開routeを特定する。分類の所属と横断tagを混同しない。

- 記事本文に対応するtitle/descriptionを編集する。title末尾のサイト名、canonical、OG/Twitter、JSON-LD、sitemap/RSS/searchは共通layout/derivationが所有し、frontmatterへ重複追加しない。
- title変更で記事IDやURLを変えない。任意のcardDisplay.linesはSNS画像表示だけで、canonical/SEO titleへ改行記号を入れない。social画像は正規Registry・権利・保護来歴と絶対URLを検証する。
- `apps/site/src/lib/seo.ts`、catalog/discoveryと対象layoutを実際に読む。既存SEO PRの未採用差分を混ぜない。
- build後の対象HTMLでtitle/description、canonical、OG/Twitter、記事日付/更新日、パンくずJSON-LDを確認する。初回updatedDateを捏造しない。`npm run publication:check`で同じdistの公開計画・CSPも照合する。
- draftはdetail/list/feed/sitemap/search/公開manifestから除外、noindexはdetailと検索露出の区別を確認する。不存在画像リンクや非公開来歴を公開metadataへ出さない。

変更箇所、実出力、未確認のSNS実サービス取得を区別する。検索順位やAI掲載を保証しない。merge・upload・deployの権限はこのSkillから発生しない。
