# 3Dプリンタ記事：完成原稿と公開待ちメディア

**このDraft PRは公開前の本文とメディアの照合資料です。現行の公開記事は更新しません。**

レビューSiteで採用された本文を [approved-candidate.mdx](approved-candidate.mdx) に原文のまま保存。SHA-256：02ca3cf6e267eb43e20622d185f574d1e49124af0097495c08c73b3c9fcc5546。既存のContentId、URL、扉画像の内容、分類・タグ、元の公開日を引き継ぎます。

## 公開予定の変更点

- 本文：既存記事の同じContentIdに対し、SEO titleOverride/description、実スライスに基づく図16点、ArticleEndnote、結びを更新。
- メディア：扉画像は採用済みの構図・内容を保持します。既存公開JPEGを由来の明確なsource snapshotとして取り込み、新しいlossless canonicalを作りました。旧private原本を回収したとは記録しません。socialは現タイトルを正規生成器へ渡して作成します。本文の新しい16図は元のCAD/G-codeデータに基づく実素材です。候補のobjectKey/activeは正式なR2保存証明ではありません。対象は [media-evidence.json](media-evidence.json)、新たな原本検証は [canonical-master-verification.json](canonical-master-verification.json)。
- ダウンロード：完成した試験片モデルと8条件の3MF/G-code、STEP/STL、描画コードのZIPは、内容hashを固定したGitHub Release assetとして配布予定です。旧 /downloads/ は本番実体がないため、[publication-candidate.mdx](publication-candidate.mdx)でhrefを1箇所だけ置換し、[download-href-lineage.json](download-href-lineage.json)に全byte差分と予定URLを記録しました。Releaseの作成・uploadはまだ行っていません。記事merge前に匿名downloadで982,631 bytesとZIPのSHA-256が一致することを確認します。
- SEO：「3Dプリンタ 充填率 100」と「3Dプリンタ インフィル 100」を同じ検索意図として説明。H1と内容が一致する検索向けタイトル、共通のdescription、構造化データを照合する候補です。順位保証ではありません。

## 正式化の工程と残件

1. 正式更新Article Jobで権利・根拠・監査と保存許可を確認する。機能PRのmerge後、実mainのpreimageを正式producerが取得してpublication.jsonとadmissionをprepareする。Jobのbase履歴を改変せず、承認・receiptを創作しない。
2. admissionを通常PRでmainへ採用。本人のDraft Release assetを経由し、protected manual workflowによりR2の原本・公開・保護の保存と照合を終える。
3. 完了したpublication-resultとchanges.patchからcanonical MDX、media/media-rights/provenanceと正規Registry indexの更新PRを作る。
4. ZIPの本番配信/ハッシュ、SEO/OG/JSON-LD、本文・画像と一覧・分類・タグ、PC・狭幅をビルド・CIで確認した後に通常のmainレビューを行う。

**現状：正式AI更新Job・根拠取込み・内容監査inventoryまで完了。独立監査、R2の実保存、publication admission、canonical export、ZIPの本番配信は未完了です。** この準備PRがマージされただけでは本番記事は変わりません。既存の公開記事の上書き・画像欠落を避けるレビュー用です。

## 固定した実体と検証範囲

[publication-status.json](publication-status.json) は、この掲載待ち原稿の状態と次工程への引継ぎ資料です。公開Registryや承認receiptの代用ではありません。既存mainの本文・media・rights・provenanceのGit blobとSHA-256、hero/socialの既存レコード・既存権利を固定しています。Windows checkoutの改行差はGit bytesのハッシュと分けています。

16図すべての配信ファイルに加え、元のingest成果物からcanonical masterの実bytesを回収しました。[原本照合](canonical-master-verification.json)にSHA-256・サイズ・寸法・lossless WebPの確認、全画素decode、private metadata不在の実測結果を記録しています。申告値だった14点も、採用済みRegistryのsource identityと一致しました。配信WebPを原本と呼び替えたものではありません。正式な権利・内容/画像監査と保存receiptは別途必要です。既存hero/socialのRegistry・権利・recoveryは旧公開状態の根拠として保持します。扉画像については公開JPEGから新たなcanonicalを作り、decodeした全画素が元JPEGと一致することを確認しました。新旧canonicalのハッシュは区別します。socialは現タイトルから正規生成し、結果は旧canonicalと同一でした。候補objectKeyは予定値で、live objectの存在を示しません。

[download-inventory.json](download-inventory.json) はZIP本体（982,631 bytes、SHA-256 `478fd173c50665139b325d06d5910331752eb67738a50d03f425804c1e042bb8`）と67ファイルの実測ハッシュ一覧です。ZIPや内部のCAD・G-code・スクリプトは実行していません。バイナリはGitへ追加していません。配布先は内容hashを固定したGitHub Release assetに選定済みです。配布権利の正式記録、Release assetの公開、匿名downloadによるサイズ・SHA-256の照合は未完了です。

[validation.json](validation.json) に限定検証を記録しています。対象worktreeの既存frontmatter schema、taxonomy、portable MDX/module props、16個のsemantic asset参照、末尾ArticleEndnote、ZIPリンクを検証しました。登録済み一時領域で正規CLIの `article init --content-id e7562440-e0bf-42a9-8a90-d66f4e1a4eb8 --update-kind correction`、`article draft import`、`article validate --level draft` も成功しました。公開フラグだけを一時コピーで `draft:true` にしており、保存する完成原稿は変更していません。この下書き試験は著者属性・正式監査・人間承認を証明しません。

初回staging時点では、正規 `prepareCiPublicationBundle` が `VISUAL_CONTENT_AUDIT_PREREQUISITES_MISSING` で停止しました。その時点の旧provenanceには9出典URLのうち8件のcompact source identityがあり、Autodeskは未登録で、更新本文のclaim bindingも未作成でした。現在は9出典すべてを含むsourceと本文claimの束縛を作成し、正式existing_ai更新Jobへ取り込み済みです。独立監査は未実施で、bundle・admission・承認receipt・保存receiptも生成していません。過去のプレビューQAや旧版のprovenanceを、この更新への監査PASSとして流用しません。

初回staging時は、依存を既存インストールから読み取り専用で利用し、検証に使った主要packageのversionをこのworktreeのlockと照合しました。実行Nodeは24.14.0で、指定24.22.1とは異なります。全体build・`ci:final`・当該headの公開HTML/SEO・ブラウザ受入れは未実行です。限定検証の成功を、production適格・公開可能・merge-readyとは扱いません。

## 現在の正式入力準備

[formal-input-preparation.json](formal-input-preparation.json)に、更新対応CLIを使うためのprivate入力準備を記録しています。9件の公式出典、12件の実データ・生成記録、39件の本文claimと106件の正確な引用範囲を結び、source/evidence schemaとローカル検証を通過しました。承認済み原稿は保全し、言い回しを変えずにダウンロードURLを1箇所だけ束縛した公開候補を用意しています。Autodeskは公開検索が返した公式ページの抜粋を取得し、HTTPによる全文取得とは区別しています。

320/390/1440pxのネイティブAstro表示では16図が読み込まれ、横はみ出しはありません。全体3枚と拡大27枚のWebPを作り、全画素decodeとcanonicalの一致を検証しました。画像内文字のサイズをCSSから代用せず、captionの実測値と画像内文字の目視レビューを分けて記録します。共通24図・figureTypography・画像に重ならないアニメーション操作UIを統合したcommit a2fa4cf108bbd2b7301088cb6651953faf32c2a3で公開候補を新たにrenderし、本文・source/canonical・画像bytesの束縛とschemaを確認しました。旧Jobとimmutable intakeは保全し、新しい描画記録から別の正式existing_ai更新Jobを作成しました。source/evidence import、examples inspect（0件）、audit prepare、content inventoryまで実行済みです。[開示対象の一覧](content-audit-disclosure-inventory.json)は42 artifacts・3,070,798 bytesを固定していますが、開示許可や監査PASSではありません。独立監査、exact disclosure grant、R2保存は未実行です。

上の限定検証とNode 24.14.0の記録は初回staging時点の履歴です。今回の準備はNode 24.22.1を使用し、更新CLIは隔離したnpm 11.19.0でtoolchain checkを通過しています。通常initを人間著者として用いた履歴は、新しいAI更新Jobの来歴へ流用しません。

## 正式exportへの引継ぎ

手順の正本は [content-workflows.md](../../../operations/content-workflows.md) と [article-media-publication-ci.md](../../../operations/article-media-publication-ci.md) です。

1. 既存Job・intake・監査記録のbaseとSHAを保ち、本文・原本16図・ZIPの根拠、権利、変更範囲を確認する。扉画像の既存公開由来・権利を引き継ぎつつ、新canonicalは別のハッシュとして記録する。内容・図の正式監査を実行し、必要な外部開示のexact grantとprotected publication環境の認可を尊重する。
2. 正式producerの `prepare` で完全なbytes・revision preimage・監査来歴を検証し、`publication.json` とそのadmissionを生成する。この資料JSONをadmissionへコピーしない。
3. 通常PRでadmissionをmainへ採用する。別途の本人認可後、本人の非公開Draft Release assetとowner/main/manual/Environment guard付きCIでsource/public/protectedを保存・read-backする。本PRからworkflowを起動しない。
4. 実receiptに基づく `publication-result.json` / `changes.patch` で本文・media・rights・provenanceとcleanup-safe claim/recovery bindingを正式exportする。ContentId・URL・元pubDateは維持し、本文更新のupdatedDateは成功したexport時刻のJSTから決める。
5. ZIPの権利・安全性・正規配布経路を確認し、本文のダウンロード先と実bytesを一致させる。指定toolchainの同一headでbuild、SEO/OG/JSON-LD、一覧・検索・feed・sitemap、PC/狭幅の全画像とリンクを確認し、必須CI/reviewを通す。merge・deployは別の認可を要する。

### 更新元コミットと二記事の実行順序

機能PR #185・#186がmainへ入った後、作業branchとprivate入力を保全し、cleanな同じworktreeを検証済みmain SHAへ切り替えます。Jobやimmutable intakeは移動・書換えせず、全content/registryのfingerprintと対象記事の旧MDX・media・rights・provenanceが一致することを確認します。正規prepareはその時点の実main commitを更新元として記録し、CIが祖先関係と旧4原本を再検証します。Jobの作成時baseと監査画面は履歴として保持されます。

**3Dプリンタ記事とMuJoCo記事の両publication packageをprepareしてから、どちらかのcanonical記事をmainへ反映します。** 先に一方の記事を更新すると全content/registryのfingerprintが変わり、未prepare側のJobが失効します。コードやadmissionだけの変更では監査を作り直さず、現行rendererのQAを別途行います。content/registryが変わった場合は正規CLIのstale判定を尊重し、baseやhashを手書きで付け替えません。

配置先は `docs/content/publication-staging/` です。Astroのcontent loaderは `apps/site/src/content/` 各collectionだけを読みます。原稿の `draft:false` は承認済み入力bytesの保持であり、公開設定を適用したものではありません。現行のcanonical MDX/Registry、public、runtime、schema、workflowは変更していません。
