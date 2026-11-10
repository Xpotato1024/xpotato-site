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

## Hosted CIで検出した検証処理の修正
採用headの初回CIでは、SIGKILL送信直後に子孫プロセス終了の観測より先にcleanupが返る競合を検出しました。既存のSIGTERM待機2000msと起動期限は維持し、SIGKILL後はliveな同一process groupの消滅を最大1000msだけ観測します。追加のsignalは送りません。Linuxでは未回収zombieをliveと区別し、観測エラーは失敗とします。focused 81件とrelease全539件が成功し、既存の5秒以内の終了検査も維持しています。

二回目CIのHomeメニュー検査では、top属性の更新とdetails.openがstyle計算前に合流し、glassの閉状態が確立しないケースを検出しました。実distで不透明な閉状態を先に確定し、同一JS task内でtopとopenを更新するprobeを3回行うと、glass alpha .78 / panel .136888、終了duration 200ms / 27.377680msの不一致を再現しました。top更新後に閉状態alpha0 / panel0を観測する対照3回では、開始alpha .106 / panel .136888、両者の終了duration 27.377680msが一致します。

検査側で閉状態のcomputed styleとsettled状態を待ち、短い反転transitionの終了検査はcloseと同じtaskでcapture/pauseしてから描画を待ちます。details開始の2フレーム待機、duration一致、200ms以内、同速度fade等の全assertionは維持し、CSS/runtimeは変更しません。修正した実dist検査は12反復72ケース成功し、exit capture後に60ms遅延を挿入した3反復18ケースも成功しました。capture前の同遅延では27ms transitionを見失うことを別途再現しています。
