---
name: site-content-publish
description: 記事・手動コンテンツを既存の共通構造、ContentId、taxonomy、semantic media、SEO、本人限定レビューと正規exportへ接続する内部支援Skill。通常の制作入口はjapanese-technical-blogまたはcreate-browser-tool。調査、監査PASS、本人承認、provider操作、本番deployの代行には使わない。
---

# コンテンツのSite統合

[一貫制作手順](../../../docs/operations/content-production.md)の統合・レビュー・正式出力部分を担当する。[編集入口](../../../docs/operations/content-workflows.md)、[共通構成](../../../docs/content/page-composition.md)、対象のschema/Registryとライフサイクルを確認する。関連Skillを全件連鎖実行せず、必要な工程だけ扱う。

## 入力と正本

対象ContentId、基準revision、既存ID/URL/公開状態、Job/workingPath、本文・媒体・権利、依頼された終了範囲を特定する。記事URLはContentIdから導出する `/articles/<26文字ID>/`。タイトル・タグ変更でID/URLを変えない。

AI記事はprivate Job→監査/本人確認→正規保存→exportを使い、canonical MDXを直接生成しない。真にmanual/legacyの入力にはその来歴を保ち、Article Job通過を捏造しない。ツール実装は独立sourceと正式installer、固定ページは既存content CLIを使う。

## 1. 構成と共通部品

タイトル、lead、主分類、技術/目的タグ、日付、hero、本文、必要なArticleEndnote、descriptionを[共通構成](../../../docs/content/page-composition.md)へ対応させる。主張の追加・根拠変更は元の編集/監査へ戻し、配置作業に紛れ込ませない。

Markdownとactive semantic modulesを使い、font、見出し、図、表、式、asideを共通描画へ接続する。ArticleEndnoteは対象snapshotで利用可能かつ承認済みのmoduleを必要時だけ使う。過去のPR番号で可否を固定しない。任意HTML/CSS/React importやhydration属性を本文へ持ち込まない。

## 2. 分類と発見経路

既存taxonomyのID、kind、aliases、active状態を読み、本文と分類の意味を照合する。必要な新タグは同義語調査後に明示的Registry差分を用意し、通常reviewと共通一覧生成へつなぐ。未登録というだけで作業を終了せず、silent createや汎用語への無言置換もしない。

記事一覧、主分類、割当済みタグ、全タグ索引から同じ詳細へ到達できるか実リンクで確かめる。archive/indexable等の設定を尊重する。生成一覧、search index、feed、sitemapを手編集しない。

## 3. 媒体と配布ファイル

通常raster/rawをGit/publicへ保存せず、正規media工程で処理したものをlogical `media:` refへ結ぶ。R2 URL、object key、raw HEIC、手管理variantsをMDXへ書かない。原素材しかなければ認可済みの制作/ingestを進め、レビュー時はprivate candidateを使う。

数式・構成図・グラフは[技術ビジュアル](../../../docs/operations/technical-visuals.md)、回路/CADは[工学素材](../../../docs/operations/engineering-visuals.md)を参照する。図の元source/データと掲載用出力を対応させる。配布ZIP/CAD/CSV等のhash/MIME/size/権利・内容・実取得は画像とは別に確認する。

永続化は[media公開CI](../../../docs/operations/article-media-publication-ci.md)の認可された経路へ引き渡す。原本/公開/保護のreceiptと実bytes、同じcandidateへのbindingを確認する。権限不明を勝手なuploadや架空receiptで解消しない。

## 4. SEOと実表示

`site-seo-review`で入力と実HTMLのtitle/description/canonical、OG/Twitter、WebPage/BlogPosting、日付、heroと内部リンクを照合する。外部SEO Skillは任意の支援であり必須依存にしない。

一つのdescriptionを一覧/detail/meta/SNS/JSON-LDで再利用し、`seo.descriptionOverride`の残存等を確認する。対応schemaで必要な場合だけ`seo.titleOverride`を使う。metadataを本文へ複製しない。

PCとスマホ幅で実本文、図中文字、数式、表、グラフ、操作、downloadを確認する。単体画像・fixture成功を実記事全体のPASSにしない。draft/noindexで意図的に出ない検索・feed・sitemapと公開予定出力の検査を分ける。

## 5. 本人限定preview

認可済みのレビューSiteへ同じ実Site描画の候補を反映する。対象Site/候補hash/版、認証とnoindex、実URLと内容を確認し、対象外の非公開原稿・テストroute・私有来歴を配布しない。

未認可の公開R2に画像だけ先出しして本人限定と称しない。配布機能が利用できなければ他の準備を継続し、未配布を明示する。ローカル成功をSite反映済みと呼ばない。

## 6. 正式出力と引き渡し

本人確認、実保存・保護、耐久的な根拠/復旧来歴、正規export、必要CI・artifact適格性を既存手順で確認する。公開日を正規処理と合わせ、初回updatedDateを作らない。表記だけの更新に無関係な全面監査を追加しない。

報告は対象ID/route、分類、媒体/添付、検証とpreview、正式出力/実保存、残る本人判断。レビュー準備済み・配備準備済み・配信済みを区別する。このSkillからmerge、production deploy、provider mutation、human approvalの権限は生じない。
