# Prime v0.2.6の表示API採用

Toolkitの固定source `1ecb32327b8b20cb637cdc3f9080c04adf3a5bff` を共通installerで採用します。Site #172・#174をmergeしたmain `28087c2167948a2edcbfacc963464658214215be` が基準です。本番配信は行いません。

## 固定入力とレビュー
- artifact SHA-256: `5681d64c745747fd70b8eca748ca37e35b892a1d3ae1aa0cb2f588733e2629b4`
- manifest SHA-256: `271dd12c1e5a87d8b80b892c247f2ae32a3796f5e93c15ef90ee3ed1767e8571`
- 独立したclean clone二つで再buildした97ファイルが一致。2660 tracked source blobsとprovenance変換を照合。
- 0.2.5との配布差分はCSS、版、manifest/provenance。数値処理、Worker/WASM、入力・資源制約、mount/session、通信、フォント、licenseはbyte一致を根拠に既存レビューを再利用。
- 詳細なsource/runtimeレビューは `prime-factorizer/v0-2-6-source-review.json`。公開Releaseの照合と最終CIの結果は採用PRに記録します。

## サイトへの適用
入力枠はcontrol、結果枠・区切り・dialogはdivider、summary上下余白は共通disclosure tokenへ接続します。旧版の境界色・summary余白の例外は役割台帳から取り除きます。旧版のimmutable artifactを保持し、ContentId・route・本文は変えません。vendor/wrapper/lockはinstaller生成であり手編集しません。

0.2.6を既存の新UI・結果状態・コピー・Worker検査の版集合に追加します。実distのdesign-role検査で、入力枠とヘルプ区切りの色、summary余白、独立したCSS API上書きと復元を確認します。既存のkeyboard、reflow、heading、axe、PWA検査も維持します。

## 検証と境界
ローカル・最終headのHosted CI・公開Releaseの照合を区別し、結果はPRにまとめます。独立Toolkit側のブラウザ証拠はexact source/runtime payload一致を確認して再利用し、Site固有の実dist検査を代替しません。文字200%はCSS文字拡大であり、実機iOS/Android、実スクリーンリーダー、Safari/Firefox、native browser zoomの新たな受入れではありません。Site merge後も本番配信前で停止します。
