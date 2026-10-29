# ブログ公開準備の実装と残る条件（2026-10-29）

対象はDraft PR123と、`tests/fixtures/article-concrete/article.mdx` の3Dプリンタ記事です。記事はcanonical contentへ移していません。PR124のPrime取り込みと独立し、この作業ではReady・merge・deploy・記事公開・storage upload・資格情報／アクセス変更を行いません。

## 実装した共通部分

- C標準SNSカード、表示専用 `cardDisplay.lines` と安全な自動折返し、canonical／SEO titleの分離を維持します。
- accepted Serverの `site-protected-v1:sha256:<sha256>:<ext>` をfull protection receiptとcompact recoveryで受け入れ、object hash・拡張子の対応を照合します。古いstable IDも保持します。opaque refは保存成功や権利の証明ではありません。
- `media-readback.ts` はsource/public/protectedのreceipt・asset/object集合・実bytes・MIME・cache・policy・protected refを検査し、最後にpolicyを再読取します。全体120秒以内、取消あり。共有物理objectは一度だけ読み、metadata衝突は拒否します。
- `media-readback-http.ts` はServer所有sessionから正確なkeyのGETだけを送る具体的HTTP transportです。publicは固定public originで認証情報を送りません。privateはServerが指定したR2 originとexact plane/key grantだけを認め、redirect・未知の応答・過大bodyを拒否します。各読取10秒／24MiB以内、再試行・write・delete・資格情報生成・provider設定APIはありません。
- Serverによるlocator解決・署名・credential scopeとresource policyの確認をSiteへ移管しません。constructor/importは通信せず、現在のSite CLIに実sessionは接続していません。`live`というラベルだけでprovider受入れ済みを返さず、`liveProviderVerified:false`／`productionEligible:false`を維持します。GET試験の成功を保存・保護・公開成功へ読み替えません。

通常のsource-store/publish/protect/exportのlive gateは閉じたままです。現行mockのjournalをhuman laneへ転用しません。readonly transportの追加だけでは、live保存adapterやそのoperation journalが完成したことになりません。

## 非公開の実生成と診断

次のコマンドは私有作業場所だけを使います。実表紙が未確定の場合は明示的なcomposition-onlyです。

```text
npm exec -- tsx scripts/article-concrete-preview.ts --composition-only
npm run article:publication:preflight -- --draft tests/fixtures/article-concrete/article.mdx --route /blog/article-infill-concrete/ --preview .local/article-concrete/preview.json
node scripts/article-concrete-check.mjs
```

WSLの固定Node／画像処理器とWindowsブラウザを使い分ける場合は、operator管理の `ARTICLE_PREVIEW_RENDER_NODE` にWindows Node実行ファイルを指定できます。rendererは固定helperを直接起動し、固定図・font・sanitized iconのinput hashとPNG bytesを照合します。任意のarticle JSONから実行ファイルを選びません。画像処理とSite buildは固定Node24.22.1／npm11.19.0です。

8個の元SVG図は変更せず、公式iconの固定Git blob照合・sanitizationを行ってから私有previewへ合成しました。表紙枠・8図・icon strip・C socialの11 assetsについて、ローカルcanonical identityとPNG delivery identityを生成しています。これは未承認の私有fixtureであり、A/B/Cの保存receiptではありません。表紙枠のaltも「未確定枠」とします。実画像を渡す場合は `ARTICLE_PREVIEW_HERO` を使い、composition-onlyとの併用を拒否します。

C social PNGは1200×630、SHA-256 `473cca7c2d3b6611760a044b8b072b654ad2684097dbc83c99d5626959f4ef7b`。現在のtitleと仮category「ロボティクス」から生成した比較用のidentityで、分類や本文を変えれば再生成が必要です。配置用のheroをSNS画像として流用しません。private previewの予定OG画像へ接続します。`noindex` previewではTwitter画像と公開分類リンクを既存契約どおり抑止し、公開用の共通テンプレートとは区別します。

preflightはMDX/schema、既存taxonomy、図参照、技術例の抽出、canonical contentの現況、公開registryとprivate previewを区別し、PNGのhash・size・MIME・寸法・集合を照合します。報告はリンク拒否・immutableな私有fileへ保存します。常に `BLOCKED_PUBLICATION` であり、正式候補・監査・human approval・exportの代替入口ではありません。

実行した診断のreport SHA-256は `1a541d755cc5887879542cbd6f17884cfa47b60a56f2bbd60d4a4f4a86a5a0c1`、結果は `BLOCKED_PUBLICATION` です。別の私有入力でMIME・size・余分なobjectをそれぞれ改変し、3ケースとも明示拒否を確認しました。

実Edge155で1440／390／320px幅×文字サイズ100／200%の6条件を確認しました。横はみ出しなし、本文の図9個・画像読込・alt・目次anchorが成立し、axe違反は0件です。PC／スマホ画像とCカード1200×630も目視確認しました。これはviewport検証で、実機モバイル・Safari・実SNSの取得／crop／cache・本番配信の確認ではありません。Cカードと公開テンプレートの既存検証は `blog-social-card.md` に記録しています。

## 3D記事の独立監査

保全commit `01fd6ef51fe4cfc30a002d8fca796456f53ebfc0` の本文SHA-256は `cdb9a6c3b1e5ce1574f95dba78d98e21410bb408ac4136b99bbd1f492841a216`。前監査から本文は100%充填の比較条件を明確にした1箇所、編集メモは図数7→8の1箇所だけ変更しました。旧P2の2件は独立再確認で解消、図の外形・荷重・数値例と出典は不変です。

旧P1の3件は未解消です。

| 対象 | 現在の不足 | 必要な工程 |
| --- | --- | --- |
| 本文14–107／111–115行 | 対象ContentIdの正式source/evidence/material claim/citation記録がない | exact本文に対するArticle Job intake、claim binding、引用コンパイル、独立内容監査。コード抽出0件の正式記録も作る |
| icon図83行／出典117行 | 公式sourceとbytesは固定したが、掲載権利admissionが未確認 | 掲載bytes・変換・creditに対する権利確認。難しければiconを使わず製品名のテキスト表示へ変更する判断 |
| hero／図／socialと公開registry | 私有canonicalとdeliveryは生成したが、実hero・正式visual audit・human approval・保存／保護receiptがない | 同一候補へ固定し、正規pipelineと保存工程を通したcompact registry/provenance export |

canonicalの公開Media Registry／published media evidence／provenanceへ、このfixtureやmock recordを追加しません。記事の日付・route・主分類・関連タグも公開前に確定が必要です。`robotics`と空tagsはschema上有効ですが、この3D記事の最終分類を承認済みとは扱いません。

## Serverと実運用の境界

authorityはSite handoffの固定Server `ab9328c5a58082ac1ec268aa7d5901d838a6a474`、[website architecture](https://github.com/Xpotato1024/Xpotato-Server/blob/ab9328c5a58082ac1ec268aa7d5901d838a6a474/docs/architecture/website-cloudflare.md)、[A/C作成手順](https://github.com/Xpotato1024/Xpotato-Server/blob/ab9328c5a58082ac1ec268aa7d5901d838a6a474/docs/operations/website-r2-ac-creation.md)です。mutable mainをprovider authorityへ置き換えません。

現在の認証済みprovider sessionは未接続です。A/Cの存在・privacy・C whole-bucket Indefinite Lock・expiryなし・Bの既存namespace・writer分離・exact-key child capabilityはfreshな実read-backが必要です。Git inventoryやdesiredだけで存在／不在／受入れ済みを推定しません。A/C作成、C lock、資格情報・権限、source/public/protected uploadはそれぞれ対象・影響・preimageと個別認可を具体化するServer側工程です。この作業で新たなcredentialを要求・取得しません。

実表紙と権利・分類が確定して正式候補が揃った後に、本人の候補承認、別途認可された保存／公開／保護、実bytes・policy read-back、compact証跡のexport、通常PR review、main CIのProduction artifact、承認された手動deploy、公開後の読み戻しへ進みます。PR123のmerge／deploy承認は、この準備指示から導きません。
