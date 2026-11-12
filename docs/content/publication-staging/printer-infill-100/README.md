# 3Dプリンタ記事：完成原稿と公開待ちメディア

**このDraft PRは公開前の本文とメディアの照合資料です。現行の公開記事は更新しません。**

レビューSiteで採用された本文を [approved-candidate.mdx](approved-candidate.mdx) に原文のまま保存。SHA-256：02ca3cf6e267eb43e20622d185f574d1e49124af0097495c08c73b3c9fcc5546。既存のContentId、URL、承認済みhero/social、分類・タグ、元の公開日を引き継ぎます。

## 公開予定の変更点

- 本文：既存記事の同じContentIdに対し、SEO titleOverride/description、実スライスに基づく図16点、ArticleEndnote、結びを更新。
- メディア：承認済みhero/socialは正規Registryと一致するので保持します。本文の新しい図は元のCAD/G-codeデータから描画したものですが、候補のobjectKey/activeは正式なR2保存証明ではありません。対象とハッシュは [media-evidence.json](media-evidence.json)。
- ダウンロード：完成した試験片モデルと8条件の3MF/G-code、STEP/STL、描画コードのZIPは個別配布が必要。配信先 /downloads/3d-print-specimens-478fd173c506.zip はこの準備PRだけではまだ本番へ配置されません。
- SEO：「3Dプリンタ 充填率 100」と「3Dプリンタ インフィル 100」を同じ検索意図として説明。H1と内容が一致する検索向けタイトル、共通のdescription、構造化データを照合する候補です。順位保証ではありません。

## 正式化に必要な工程（未実行）

1. 正式更新Article Jobで現行mainのpreimage、権利・根拠・監査と保存許可を確定し、正式producerのpublication.jsonとadmissionをprepareする。承認・receiptを創作しない。
2. admissionを通常PRでmainへ採用。本人のDraft Release assetを経由し、protected manual workflowによりR2の原本・公開・保護の保存と照合を終える。
3. 完了したpublication-resultとchanges.patchからcanonical MDX、media/media-rights/provenanceと正規Registry indexの更新PRを作る。
4. ZIPの本番配信/ハッシュ、SEO/OG/JSON-LD、本文・画像と一覧・分類・タグ、PC・狭幅をビルド・CIで確認した後に通常のmainレビューを行う。

**現状：正式Job承認、R2の実保存、publication admission、canonical export、ZIPの本番配信は未完了です。** この準備PRがマージされただけでは本番記事は変わりません。既存の公開記事の上書き・画像欠落を避けるレビュー用です。

## 固定した実体と検証範囲

[publication-status.json](publication-status.json) は、この掲載待ち原稿の状態と次工程への引継ぎ資料です。公開Registryや承認receiptの代用ではありません。既存mainの本文・media・rights・provenanceのGit blobとSHA-256、hero/socialの既存レコード・既存権利を固定しています。Windows checkoutの改行差はGit bytesのハッシュと分けています。

16図すべての配信ファイルについて、実ファイルのSHA-256・サイズ・寸法を照合し、全画素をdecodeしてEXIF/IPTC/XMP等がないことを確認しました。用語図2点は候補のcanonical master実bytesとも一致しました。残る14点のcanonical source identityはプレビューからの申告値であり、今回確認した原本領域には実bytesがありません。正式prepare前に元の生成・ingest成果物から原本を回収・照合する必要があります。配信WebPをlossless原本と呼び替えません。候補objectKeyは予定値で、live objectの存在を示しません。

[download-inventory.json](download-inventory.json) はZIP本体（982,631 bytes、SHA-256 `478fd173c50665139b325d06d5910331752eb67738a50d03f425804c1e042bb8`）と67ファイルの実測ハッシュ一覧です。ZIPや内部のCAD・G-code・スクリプトは実行していません。バイナリはGitへ追加せず、配布権利と正式な配信経路を未確定として保持しています。

[validation.json](validation.json) に限定検証を記録しています。対象worktreeの既存frontmatter schema、taxonomy、portable MDX/module props、16個のsemantic asset参照、末尾ArticleEndnote、ZIPリンクを検証しました。登録済み一時領域で正規CLIの `article init --content-id e7562440-e0bf-42a9-8a90-d66f4e1a4eb8 --update-kind correction`、`article draft import`、`article validate --level draft` も成功しました。公開フラグだけを一時コピーで `draft:true` にしており、保存する完成原稿は変更していません。この下書き試験は著者属性・正式監査・人間承認を証明しません。

正規 `prepareCiPublicationBundle` は `VISUAL_CONTENT_AUDIT_PREREQUISITES_MISSING` で停止しました。bundle・admission・承認receipt・保存receiptは生成していません。過去のプレビューQAや旧版のprovenanceを、この更新への監査PASSとして流用しません。本文の9出典URLのうち8件は旧compact source identityへ照合できましたが、Autodeskの出典は旧provenanceに未登録です。更新本文のclaim bindingは9件とも正式な根拠・内容監査で再構築します。

依存は既存インストールを読み取り専用で利用し、検証に使った主要packageのversionをこのworktreeのlockと照合しました。実行Nodeは24.14.0で、指定24.22.1とは異なります。全体build・`ci:final`・当該headの公開HTML/SEO・ブラウザ受入れは未実行です。限定検証の成功を、production適格・公開可能・merge-readyとは扱いません。

## 正式exportへの引継ぎ

手順の正本は [content-workflows.md](../../../operations/content-workflows.md) と [article-media-publication-ci.md](../../../operations/article-media-publication-ci.md) です。

1. 実行時のmainへ更新Jobを再bindし、本文・原本16図・ZIPの根拠、権利、変更範囲を固定する。既存hero/socialとそのsource・権利は変更しない。内容監査、図の監査、exact candidateへの本人承認を正式Jobに記録する。
2. 正式producerの `prepare` で完全なbytes・revision preimage・監査来歴を検証し、`publication.json` とそのadmissionを生成する。この資料JSONをadmissionへコピーしない。
3. 通常PRでadmissionをmainへ採用する。別途の本人認可後、本人の非公開Draft Release assetとowner/main/manual/Environment guard付きCIでsource/public/protectedを保存・read-backする。本PRからworkflowを起動しない。
4. 実receiptに基づく `publication-result.json` / `changes.patch` で本文・media・rights・provenanceとcleanup-safe claim/recovery bindingを正式exportする。ContentId・URL・元pubDateは維持し、本文更新のupdatedDateは成功したexport時刻のJSTから決める。
5. ZIPの権利・安全性・正規配布経路を確認し、本文のダウンロード先と実bytesを一致させる。指定toolchainの同一headでbuild、SEO/OG/JSON-LD、一覧・検索・feed・sitemap、PC/狭幅の全画像とリンクを確認し、必須CI/reviewを通す。merge・deployは別の認可を要する。

配置先は `docs/content/publication-staging/` です。Astroのcontent loaderは `apps/site/src/content/` 各collectionだけを読みます。原稿の `draft:false` は承認済み入力bytesの保持であり、公開設定を適用したものではありません。現行のcanonical MDX/Registry、public、runtime、schema、workflowは変更していません。
