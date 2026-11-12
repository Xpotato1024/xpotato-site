---
name: site-seo-review
description: xpotato-siteの記事・固定ページ・ツールのSEO入力と実build出力を確認する。title/description、canonical、SNS、構造化データと一覧・検索・feedの整合を扱う。検索順位保証や無関係なSEO実装変更には使わない。
---

# 公開ページのSEOを確認する

[編集入口](../../../docs/operations/content-workflows.md)と[SEO契約](../../../docs/architecture/seo-discovery-policy.md)を読み、対象ContentId、draft/noindex、公開routeを特定する。分類の所属と横断tagを混同しない。

- 記事本文に対応するtitle/descriptionを編集する。title末尾のサイト名、canonical、OG/Twitter、JSON-LD、sitemap/RSS/searchは共通layout/derivationが所有し、frontmatterへ重複追加しない。
- [初稿制作workflow](../japanese-technical-blog/references/first-draft-integrated-workflow.md)の検索意図を初稿で確認する。用語と別名を同じ読者の問いへ結び、例えば「3Dプリンタ 充填率 100 / 3Dプリンタ インフィル 100」を本文の自然な用語説明で扱う。別名の羅列やmeta keywordsは追加しない。
- H1は記事内の問い、検索titleは検索から選ぶ理由を担う。対象schemaが支持する場合のみ自然な`seo.titleOverride`を提案し、H1と異なる表現を選べる。同文でも役割を満たせばよく、違いを強制しない。固定semantic response schemaへ未対応fieldを追加しない。
- authoritativeなページdescriptionは一つにし、詳細/一覧カード、meta description、OG/Twitter、WebPageとBlogPosting JSON-LDで再利用する。meta更新後に古いJSON-LD description等が残っていないか、入力だけでなく同じ候補の実renderを照合する。独立した複数descriptionを手入れしない。
- 通常はfrontmatter `description`を正本として一度更新する。既存の`seo.descriptionOverride`や手書きの構造化データに古い説明があれば不一致として扱い、正規のmetadata所有者へ修正を戻す。override追加で一覧とdetailの説明を分岐させない。preview/draft/noindexで構造化データが意図どおり非出力なら、その不在を欠落扱いにせず、公開予定出力の確認とは分ける。
- title変更で記事IDやURLを変えない。任意のcardDisplay.linesはSNS画像表示だけで、canonical/SEO titleへ改行記号を入れない。social画像は正規Registry・権利・保護来歴と絶対URLを検証する。
- `apps/site/src/lib/discovery/seo.ts`、catalog/discoveryと対象layoutを実際に読む。既存SEO PRの未採用差分を混ぜない。
- build後の対象HTMLでtitle/description、canonical、OG/Twitter、記事日付/更新日、パンくずJSON-LDを確認する。初回updatedDateを捏造しない。`npm run publication:check`で同じdistの公開計画・CSPも照合する。
- 対象detailと一覧の実HTMLを読み、H1、title、全descriptionとWebPage/BlogPosting JSON-LD、hero/social画像の対象を比較する。taxonomy/canonical/noindex/承認済みheroをSEO修正のついでに変更しない。本人限定previewのaccessも保持する。出力が未供給なら未確認と記録し、schema/構造testだけでrender整合をPASSにしない。
- draftはdetail/list/feed/sitemap/search/公開manifestから除外、noindexはdetailと検索露出の区別を確認する。不存在画像リンクや非公開来歴を公開metadataへ出さない。

変更箇所、実出力、未確認のSNS実サービス取得を区別する。検索順位やAI掲載を保証しない。merge・upload・deployの権限はこのSkillから発生しない。
