# 公開記事画像と配信前検査の接続

通常buildは、公開済みcatalog（noindexの記事も含む）に対応するMedia Registryと`publishedMediaEvidence`を既存の`assertCompactRegistryMedia`で検証し、`dist/_publication-media.json`を毎回生成する。権利許可、正規の保護来歴、canonical sourceと公開・保護object集合の一致が必要。draft・holdは対象外。未確認の素材を一覧へ手書きして公開する入口ではない。

生成物はsource SHAと公開URL・SHA-256・bytesだけの小さなprojectionであり、新しいprovider receiptや人間監査の証明ではない。非公開資料・会話・資格情報・原本・完全なreceiptは含まない。`ci:final`で正規入力から再計算した結果とbytes比較し、改変や古いprojectionを拒否する。

配信側は、既存の成功main run・固定Production artifactのdigest・正規handoff検証を通した後、その成果物内のprojectionだけを読む。source SHA一致、厳密なキー集合、件数・サイズ・重複、固定`https://assets.xpotato.net`とcontent-addressed URLを検査する。その集合にあるliteralなimg/source URLだけを追加で受け入れる。query、hash、別origin、userinfo、相対・正規化alias、未登録画像は拒否し、CSS画像・旧ホーム写真・ローカルUI資産の既存検査は維持する。

projectionのない旧成果物は、従来のローカル画像だけなら扱える。R2参照があれば拒否する。通常buildや配信前の一覧照合はR2資格情報を使わず、保存・公開画像の実bytes照合を代替しない。保存CIの真正な検証結果と、配信後の公開URL・画像確認は別工程として必要。

初回記事では32objectを生成する。512object・1object24MiB・manifest256KiBの上限超過は明示的な停止とし、黙って対象を省かない。この変更で配信の自動起動や認証・権限・保護設定を追加しない。

## 静的配信readbackの内部予算

旧64件はcommit `8fa8336`で手動配信案へ導入された内部定数。リポジトリの仕様・履歴にはユーザー指定の固定64件、Cloudflareの制限という根拠は見つからなかった。69件を省略して合わせず、計画と実行が共有する96件・合計16MiBの予算へ更新する。個別responseの従来上限（通常2MiB、固定Prime chunk6MB）、144 GETのfactory全体上限、各取得10秒、公開後phase120秒は維持する。

固定成果物13120781172の非配信用コピーでの実ファイル計測（R2画像32objectとは別集合）：

|対象|件数|bytes|
|---|---:|---:|
|旧ホーム写真|13|2,804,363|
|UI raster|1|22,239|
|代表HTML|7|63,765|
|font|4|168,168|
|UI SVG|3|2,787|
|その他固定資産|3|38,386|
|Astro CSS|34|1,049,745|
|Astro JS|4|5,580,128|
|合計|69|9,729,581|

96件は現在値に約39%の件数余裕、16MiBは現在bytesに約72%の余裕を持つ有限な予算。最大計画でも対象96＋事前home/alternate3＋事後alternate2＝101 GETで、144回内に43回を残す。通常経路がこの余りを使うことはなく、readerを余分に使った場合も、公開後処理前に全計画＋alternate2回の残予算を確認する。欠落・重複path・不正なhash/bytes・総量超過は配信前に拒否し、実行側でも同じ計画を再検査する。

120秒deadlineは最初の公開targetからalternate2件の完了まで共有し、各GET/streamと次GET直前で検査する。inflightは10秒と残時間の短い方でabortする。redirect・retryは追加しない。最大計画の対象bytes16MiBと事前/事後の5response各2MiBから、公開response全体は最大26MiB（正常経路）に限られる。provider APIの予算・権限は変更しない。実ネットワークが120秒以内に完了する保証ではなく、超過・未知結果は引き続き停止する。

ローカルで実ファイルを使ったfake provider/fetchによる全状態機械検証は、計画69件・74 GETで成功し、未登録画像は拒否した。これはテストであり、実provider通信・deploy・公開後受入の成功ではない。次のmain成果物の正規検証と、本番のfresh preflight/readbackは別途必要。

## ブラウザーの画像CSP

既存Media CSP方針（`docs/architecture/security-privacy-policy.md`）とcanonical `@xpotato/content-contracts/article-media-targets` のpublicOriginに合わせ、generatorとvalidatorへ正規公開画像originだけを接続する。変更はglobal CSPと派生Prime CSPの`img-src`のみ：

```text
before: img-src 'self' data:
after:  img-src 'self' data: https://assets.xpotato.net
```

これはoriginレベルのブラウザー許可。個々の画像の公開可否は、前述のRegistry・権利・保護来歴・固定artifactの完全URL集合で引き続き検査する。CSPだけで未登録pathを承認したとは扱わない。wildcard、https:全体、別origin、port/path付きの追加、private/optional origin、他directiveへのorigin追加は拒否する。他のscript/style/connect/worker/font等のdirectiveは変更しない。

未配信distへ正規generatorのヘッダーを生成し、その`_headers`を実HTTPレスポンスへ適用する127.0.0.1限定サーバーでBraveの指定サイズ1365×900と390×844を確認した。狭幅の実測CSS innerWidthは355pxで、指定値と区別する。R2画像9件が実際に描画され、CSP errorログ0、横はみ出しなし、目次fragment移動を維持。旧成果物のヘッダーと比較し、正規originの追加以外のbytes差分がないことも確認した。これは実機iOS・本番配信の受入ではない。Cloudflare API、設定、資格情報を操作せず、画像は既に公開されたR2配信用URLを通常取得した。
