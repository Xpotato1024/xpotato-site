# Prime v0.2.2のSite採用と異常停止回帰

基点は公開済みmain `553df18701a9c0f45573d54b236bb9ee7fa0e10d`。PR128の見出し自己リンク削除、PR129のfixture限定runtime境界、PR130の高速性説明・copy/shareを保持し、正式v0.2.2を独立branchで採用する。記事本文・ContentId・route・公開状態を変えず、未公開3D記事を公開しない。実Article provider、画像保存、資格情報・権限の変更は対象外。

## 固定入力とsource／releaseの独立確認

[正式Release](https://github.com/Xpotato1024/browser-prime-toolkit/releases/tag/v0.2.2)の注釈tagは `5e2573b51552f410e724e71b1369acc8ff7ad484`、sourceは `9d36c7d79876ec334751e0d35798a8582c83bacd`、Git treeは `5bb6ff1ed8dab386f954f8bad791b791d1dc1760`。

| 入力 | SHA-256 |
| --- | --- |
| runtime ZIP（2,145,185 bytes） | `a13fc760b77dd9d8cc3c2f6e5358c194565cca129a9aa34837a588491b4fe36e` |
| 対応source ZIP（38,401,711 bytes） | `d2ef3099e3b6e3060f8d83ee3873a8842df7d5c4aeba6cf5e8a101ef5f610149` |
| runtime tree（97 files／5,804,241 bytes） | `8734aeeb4886c2f295db5d00f6fa8b35e6451b8f20aaf16ce5511c661517a26e` |
| manifest（96 records） | `88376ee8f9218b18582bcd9c75b53d753432c43a5a5e72a365081e6ea1be56ae` |
| RELEASE-PROVENANCE | `f95c70a5a2d9b43e23f964aa14e64f1114eaa093c955785678aa084fdfef81b1` |
| browser acceptance JSON | `ec9de55d88655c37184698f8d710550b215be58b267f523c75143e312dbc64de` |

5資産を匿名HTTPSで再取得し、全サイズ・hashを照合した。独立source／releaseレビューはP0/P1/P2＝0/0/0。source ZIPの2,589 files／110,411,365 bytes、Git object、実clean checkout、runtimeの全出力・8 recipes・24 license/source文書を照合した。正規installer用の[固定source review](prime-factorizer/v0-2-2-source-review.json)へidentityと再利用範囲を記録する。

exact source/treeに束縛された上流の2 clean builds、[main CI](https://github.com/Xpotato1024/browser-prime-toolkit/actions/runs/41212229010)・[tag CI](https://github.com/Xpotato1024/browser-prime-toolkit/actions/runs/41214375590)各835試験、GUI23・routing16・host minify後7ケースの証拠を再利用し、Siteでtoolkitを再buildしない。初回Chrome起動失敗2件は各1回の再実行成功と区別し、根因未確定を保持する。

## 採用・回帰の境界

正規installerの `plan/apply --update-published-prime` へ旧artifact `7a57f42e7bbe17defd0d86458f18ebde8e2a257c5d643ec479cb032549e5d0fb` を渡す。旧vendor・pin・review・ライセンスpathは保持し、新vendorは手編集しない。選択pin、admission、dependency／lock、manifest登録はinstallerが生成する。本文は変更せず、既存の移管原文と編集候補の検査を維持する。

上流で切り分けた原因は、runtimeのFunction.toStringによるECM Worker組立てがhost minify後の識別子に依存したこと。v0.2.2はproducer側の固定文字列へ変更し、数値kernel、GMP、依存集合、入力／時間／メモリ上限、proper-divisor検査、取消・退役契約は維持する。新CSP権限・runtime依存・GNFSは追加しない。309桁／1024bitは受付範囲で完走保証ではなく、333–400bitは実験的で均衡400bitの完走を主張しない。

Site実distでは報告入力を通常の有限予算で実行し、分解完了表示、全7因子の確定表示、DOMに表示された因子のBigInt積を検査する。上流の[固定基準](https://github.com/Xpotato1024/browser-prime-toolkit/blob/9d36c7d79876ec334751e0d35798a8582c83bacd/docs/operations/ecm-host-bundle-regression.md)は次のとおり。

```text
11451419198101448524859159549219459514145142112
= 2^5 × 3^2 × 19 × 1051 × 240677 × 9082579814087837 × 910891597356395779
```

ECM Blob Workerの実本文hashも選択vendorの固定文字列と照合し、minifyされたSite bundleでの接続を検査する。Blobは実行ごとに新規生成されたURLで区別し、別ケースの観測を流用しない。既存のオンライン／オフライン、取消・再実行、Worker／Blob退役、複数island、copy focus、通信・CSP観測を維持する。v0.2.1と同じGUI保持契約をv0.2.2にも適用し、旧版のreset検査を他の既存版へ残す。

Site実dist、最終head CI、Production artifact、配信後の実測は別の証拠として対応PRへ記録する。実機iOS/Android、Safari/Firefox/WebKit、OS共有シート、長押し、screen readerは未検証で、desktop emulationや注入APIを実機成功と扱わない。
