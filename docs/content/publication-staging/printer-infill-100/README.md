# 3Dプリンタ記事：公開差分のレビュー用候補

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
