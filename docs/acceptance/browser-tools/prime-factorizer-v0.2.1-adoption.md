# Prime v0.2.1 のSite取り込み

PR125の操作GUI・補足説明の後へライセンスを一度だけ置く変更に、正式v0.2.1を追加する。main基点は `9e1a2443bbcced4970325d0b595723ff19138b5c`、既存UI差分は `7c5899eccee3014e7b968933030fe9136a9a2159`。記事本文・ContentId・route・公開状態を変えず、未公開3D記事fixtureを正式記事へ昇格しない。

## 固定入力と独立レビュー

[正式Release](https://github.com/Xpotato1024/browser-prime-toolkit/releases/tag/v0.2.1) のsourceは `d963bc2f9e097c7c5ce1758dfd047407e2df9b7f`、Git treeは `25efe7ca592db4432a008f5f1d5cc47268aacdff`。

| 対象 | SHA-256 |
| --- | --- |
| runtime ZIP | `3bcaefe5f1fcedce9ff23d62f023c304f16dae514d391e72c57f8a1eb7a17598` |
| source ZIP | `db62050afb71f183a2a7f3bfa08a6c2615b238a3e1f074ecb6dc4ba66072ddac` |
| runtime tree（99 files / 5,804,019 bytes） | `7a57f42e7bbe17defd0d86458f18ebde8e2a257c5d643ec479cb032549e5d0fb` |
| manifest | `37b51248eb98e9db77c59ced6eca4e1e6871c121cd2dc7a532ebf24895d2611d` |
| RELEASE-PROVENANCE | `1c87d7917624e0c76f1b1ea4400b2f95958e611dd2cd455ef63535537551ac21` |

公開5資産の匿名取得とhashを確認し、独立source/artifactレビューはP0/P1/P2＝0/0/0。source ZIPの2,583 files / 109,774,276 bytesから公開Git treeをメモリ上で再構成して一致した。runtime99 files・manifest98件・対応source/recipe101件の不一致は0。Site installerのplanも実source checkoutと配布物を照合して成功した。任意のmetadataキャッシュ保存を照合成功の根拠には使わない。

同じsource/tree/runtime/manifestに束縛されたNode24.22.1の2 clean build、[main](https://github.com/Xpotato1024/browser-prime-toolkit/actions/runs/41157509159)／[tag](https://github.com/Xpotato1024/browser-prime-toolkit/actions/runs/41158529218) の各9workflow初回成功・primary各832試験、GUI23／routing16ケースを再利用する。Siteではtoolkitを再buildしない。

## 採用と回帰の境界

正規installerの `plan/apply --update-published-prime` で、旧artifact `3bc767d94141cf362f184c41f0a55215f5f38ba17aa723a61101ecd6a639d90c` を指定して採用した。v0-2-0は保持し、v0-2-1のvendor bytesは手編集しない。pin・public admission・source review・履歴・file dependency・npm lockはinstallerが生成する。

kernel・routing・session・入力/資源上限・依存・API・license宣言はv0.2.0と同一。GNFSは含まない。通常309桁/1024bitは受付範囲であり完走保証ではない。333〜400bitは実験的で、400bit均衡半素数の完走は未検証。

受入harnessは旧版のreset試験を維持し、v0.2.1では待機進捗、入力編集と入力例での前回結果表示、コピー応答とfocusを確認する。OS clipboardの書込みは注入adapterで代替し、実OS clipboard対応とは扱わない。CSP・Page/Worker/HTTP観測、Worker/Blob退役、cancel、有限時間、複数islandの検査は維持する。

## Site実dist受入

Site `0c98901a0087662b335a2d51274e6524ed07c625` の実distでEdge155受入が完了した。オンライン／オフライン計18入力ケース、invalid時の前回結果、入力例、コピー成功／失敗時のfocus、通常／実験的経路の取消、有限時間終了、複数island、React unmount、画面遷移後のWorker退役を確認した。49操作区間すべてでPage/Worker/HTTP通信0・CSP違反0、区間終了後のactive Worker／Blob URL残留0。Worker内fetch拒否と観測器の自己検査も通過した。

幅320/390/1440px × OS light/dark選好 × 文字100/200%で、初期待機・結果・設定dialogの36画面を記録した。横overflowなし、200%の設定dialogはkeyboardで適用操作へ到達できた。狭幅の初期待機画面では進捗、二つの補足説明、その後の採用版／対応ソースとライセンス表示を確認した。OS選好によるhost配色の自動切替は主張しない。

最初の受入実行は、旧harnessが複数islandの両方へready状態を要求し、新版の前回結果保持によりtimeoutした。新しいislandはready、既存islandは非実行状態であることを要求する待機へ修正して全体を再実行した。失敗した初回を成功とは扱わず、通信・退役・独立IDの検査を緩和していない。配信されるvendorは変更していない。

toolchain、installer check、関連40試験、全workspace typecheck、build、repository/static validation、performance checkは成功した。Prime CSSはraw 93,223 / 100,000 bytes、gzip 18,508 / 32,000 bytes（余裕6,777 / 13,492 bytes）。route全JSはraw 5,563,077 / gzip 2,033,813 bytes、search indexはraw 56,459 / gzip 11,823 bytes。予算は変更していない。21ページの出力とsearch/RSS/sitemap等に3D記事のContentId・route ID・タイトルの混入0、当該記事routeの生成なしを確認した。

独立Site差分レビューで、新版musl公開ファイルの欠損（P1）と対応ソース案内の旧版記載（P2）を確認した。選択vendorの原文を同じbytesでpublicへ追加し、現行source案内をv0.2.1へ更新した。受入harnessもhrefだけの検査から、実dist原文比較とHTTP 200／本文bytes比較へ強化した。修正後のbuild・実dist受入・独立再確認を別途行い、未実行段階で解消済みとは扱わない。

受入JSONと36画面は非追跡の `.local/prime-ui-validation/` に保存する。最終headのCIと独立Site差分レビューは後続で確認する。

実機iPhone/Android・Safari/Firefox/WebKit・OS操作・screen readerは未検証。OS light/dark選好と狭幅/文字拡大のdesktop emulationを実機検証へ読み替えない。本番未配信であり、Production artifact選択・手動配信・公開後readbackは別工程。
