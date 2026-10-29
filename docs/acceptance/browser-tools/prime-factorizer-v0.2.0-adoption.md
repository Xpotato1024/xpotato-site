# Prime v0.2.0 の固定版取り込み

Site main `12155a027027177ca29218f024a60dc3ab1f5e26` を基点に、ブログPR123から独立して取り込む。既存 `/tools/prime-factorizer/`、ContentId `bca48f98-c89a-457f-84d8-168f941fe469`、MDX全文、visible hydrationとPrimeだけのCSS読み込みを維持する。merge・本番配信は別承認で、この記録だけでは実施しない。

## 固定入力と取得照合

[正式Release v0.2.0](https://github.com/Xpotato1024/browser-prime-toolkit/releases/tag/v0.2.0) の公開5資産を匿名再取得した。対応sourceは `488ee538855110be3c718e2e03490bb1da53bf12`、Git treeは `2f2689d1ebd225764634877c2fe70a51047db84c`。source ZIPの全2,581ファイルはcleanな独立checkoutとbyte一致した。

| 対象 | SHA-256 |
| --- | --- |
| runtime ZIP（2,144,835 bytes） | `4a5c505d8205ca6ebf1586b36bb0ed58399a4f188c4775ab9492296ba9212b2f` |
| source ZIP（38,135,710 bytes） | `2131c419479bf22509f597d7221a2c99cd44233c1f0dd71b8d8a5bbb3136cfb3` |
| runtime tree（99ファイル／5,802,413 bytes） | `3bc767d94141cf362f184c41f0a55215f5f38ba17aa723a61101ecd6a639d90c` |
| manifest | `15e2b3d3984edc32820811b75cbeaaac4bfe158d2bfd3bbcf49976a70e161e0a` |
| RELEASE-PROVENANCE.json | `738e79f4e3503b395b2827261abd9afb49ed9ca3c50630f7b6d8aec59bcd3713` |
| SHA256SUMS.txt | `0b23e0fcb0a31e35a15a09e54d5649535ab9e7d1c7706b9f99e1e19fa72a7829` |
| browser-acceptance-v0.2.0.json | `6bfa1ff0df70d645352f4137d99322889948313131051222d412519509b1dc8e` |

ZIPのhashと正規化runtime treeのhashは別のidentity。タグ名だけで採用しない。manifestの全file、license/source offer、artifact provenanceの97出力・4recipeと対応sourceを検査する。

## 再利用する配布元の証拠

同じsource/tree/manifest/runtimeに束縛されたNode24.22.1の2 clean build、828試験、Chrome155 GUI22／routing16ケース、main/tag各9 workflow・26jobの成功を再利用する。Siteではtoolkitを再buildしない。配布元のChrome起動失敗2件は対象job各1回の再実行で成功したが、原因は未確定で旧失敗履歴を保持する。

この証拠はSiteでの合成画面・CSP・配信や実機mobileの確認を代替しない。Firefox/WebKitのv0.2.0再検証と実機mobileは未実施。

## 表示と許可範囲

通常は最大309桁かつ1024bit、高精度は100桁かつ332bit、大メモリは121桁かつ400bitの受付範囲。333bit以上は実験的経路で、均衡半素数の完走は未検証。どの上限も完走保証ではない。`2^128` 未満の小入力は共通の通常経路を使う。GNFS実験は含まない。

Worker最大6、WASM最大1,610,612,736 bytes、job最大3,600,000ms、transport最大67,108,864 bytes、input/outputのbyte予算は従来どおり。CSP、通信、storage、provider、資格情報の許可を拡張しない。

## Site固有の変更と確認

公開済みPrime用の明示update操作は旧artifactの完全一致、exact source/review/admission、新しいimmutable releaseIdと履歴衝突拒否を要求する。本文・掲載位置は変更できない。npm lockは隔離したローカル作業場所で生成し、登録の置換・復元では未知の利用者編集を拒否する。新規toolのdraft固定は維持する。

manifestの実験的閾値、直接の `Reflect.ownKeys` によるrecord検査、固定local関数とbase64だけを用いるWorker source合成、hash束縛された配布provenanceを明示的に検査する。静的検査は独立source reviewや実distの通信観測の代替ではない。

ローカルの実Site distを生成CSP付きでloopback配信し、Windows Edge155で18ケース／36操作区間を確認した。32・科学表記・0/1・safe integer超過・`2^127`／`2^128`・309桁1024bitの容易な積をonline/offlineで検査し、1025bit・不正表記・過大指数は前回結果と区別して拒否した。容易な積の完了を一般の半素数の完走保証へ読み替えない。高精度／大メモリの取消、1秒の有限終了、複数island、document lease、unmountと通常navigationのWorker退役も確認した。

全36区間でready後のHTTP／Page・Workerの通信とCSP違反は0、終了後のWorker／Blob URLは0。検出器は許可fixtureとCSP拒否の自己試験も通過した。320／390／1440pxのOS light/dark選好と100%／200%文字拡大で結果と実行条件dialogを24画面撮影・確認し、横はみ出しなし、Siteとtoolの書体一致、dialog取消後のfocus復帰を確認した。200%のdialogは縦スクロールを使い、native selectの説明接尾辞は一行表示の制約を受ける。選択名と全文の説明は保持する。現Siteには独立したdark themeがなく、OS選好を変えても既存色を維持した。実機mobile・Firefox/WebKitのSite受入は未実施。

200%の全6条件で、実キーボードTabによりdialog内の「適用する」へ移動でき、focusによるスクロール後にボタン全体がviewport内へ入ることを確認した。

| 実dist項目 | raw bytes | gzip bytes | 既存上限 raw / gzip |
| --- | ---: | ---: | ---: |
| Prime CSS合計 | 94,264 | 18,716 | 100,000 / 32,000 |
| Prime固有JS | 5,557,045 | 2,031,514 | 6,000,000 / 2,700,000 |
| 検索index | 56,459 | 11,823 | 100,000 / 30,000 |

CSS内訳は共通20,177、記事構造2,399、ContentLayout12,803、Prime用font48,408、tool10,477 bytes。Prime CSSの余裕は5,736 bytes（gzip13,284 bytes）で、予算の引上げはない。tool CSSはPrimeだけに1回読み込み、他routeへ広げない。これは転送サイズの測定で、field表示性能の測定ではない。

Node24.22.1／npm11.19.0でbuild・予算・型を確認した。全体回帰768件のうち766件が初回成功、無変更のArticle Job preview CLI起動2件が8秒timeoutとなり、その2件だけの単独再実行は2件成功した。原因は未確定で、最終CIの結果と区別する。新しい更新transaction・I/O復元・未知編集保全・履歴衝突・provenance改変・CSS/Worker反例は成功した。新checkoutに不足していた既存freeze tagは取得してlegacy検査を再開した。

ローカルの画面は最初の取り込みcommit `5ce9c629197eeba4af9db163e9789e7791f204ad` の実distを用い、文字拡大の受入harnessを追加している。初回PR CIは、元配布物のlicense原文4ファイルの末尾空白でscope停止した。原文は旧版とbyte一致し、既存版と同じ4つのliteral pathだけを `.gitattributes` の書式例外へ追加した。artifact hash照合を省略しない。PRの最終固定headに対する通常CI、実distと独立レビューを最終受入とし、そのrunとverdictをPRに記録する。本番未配信であり、公開URLの新version読み戻しは未実施。
