# iOS Braveのコピー・共有のSite側調査と修正候補

基点は公開済みmain `6bf8bae4ddabe23c2d20f52a83fa24e5e0628f65`、toolkit v0.2.1。既存PR128/129・toolkitのimmutable vendor／pin／lockを変更せず、別branchのDraft PRとして提出する。本PRのmerge・deployは対象外。

## 確認できた事実と未確定の原因

公開HTTPSレスポンスは200、iframeは0。実Permissions-Policyはcamera等8機能の拒否で、clipboard-write／web-shareの拒否設定はない。CSPは従来のconnect-src 'none'・frame-ancestors 'none'を保持する。現行のURLコピー・共有と固定toolkitの結果コピーは、クリック処理内でAPIを呼び、その前にfetch・permission query・awaitを挟まない。Navigator／Clipboardのreceiverも維持している。

一方、SiteのURLコピーと端末共有は共通busyを使用していた。clipboard promiseが未解決の間は端末共有を押してもAPIへ到達しない。これは独立して再現できるSiteの不備だが、実機Braveで発生した原因そのものと断定しない。端末OS／Brave版・実URL・表示されたエラーは未取得で、iOS実機は未検証。

## 修正範囲

- コピーと共有の待機状態を分離。同じ未解決操作の自動再送はしない。ネイティブAPIには取消し手段がないため、タイマーで成功／失敗を偽装しない。応答待ちでも公開URL欄・X・LINEは利用できる。
- 遅延応答が後の操作や明示的な手動選択のfeedbackを上書きしない。コピー拒否・API不在／その他失敗・共有AbortErrorを区別し、共有の取消しから勝手にコピーへ進まない。
- コピー失敗時は公開URL欄を選択するが、利用者が移したfocusは奪わない。その後の明示click・長押しでブラウザが選択範囲を変えても、Siteから全選択を強制し直さない。clipboard read／execCommand／権限変更／UA判定は追加しない。
- Tool紹介文へWebAssembly・並列計算による高速性を記載。最速・特定桁数での完走時間は保証せず、従来の上限・未証明／未完了解説を保持する。
- 結果コピーの本体は固定toolkitが所有する。SiteでGUIやコピー文字列を複製せず、既存の結果本文選択fallbackと、HTTPS本番・手動コピーの案内を補う。結果APIが使えない実機で自動コピーが必ず成功するとは扱わない。

## 一次資料との照合

- [WebKit Async Clipboard](https://webkit.org/blog/10855/async-clipboard-api/)：secure contextとクリック内の書込みが必要。HTTP確認ページとHTTPS本番は同じ条件ではない。
- [WebKit bug 222262](https://bugs.webkit.org/show_bug.cgi?id=222262)：データ準備のawaitをAPI呼出し前へ置くとactivationを失う事例。本Siteにはそのawaitは見つかっていない。
- [W3C Web Share Recommendation](https://www.w3.org/TR/web-share/)：transient activation／Permissions Policy、キャンセルや共有先なしのAbortError、OSへの引渡し後の完了保証の限界。share promiseのresolveを相手への送信完了とは表示しない。
- [Clipboard API draft 2026-06-24](https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/)：現在のworking draft。実ブラウザの対応や権限の同一性を保証する根拠には使わない。

## 検証と実機確認

関連3ファイル80試験は成功（新規18件）。同じ新回帰ケースを固定mainの実スクリプトへ適用すると「コピー待機中にshare APIが0回」で失敗し、修正スクリプトでは成功した。比較後に修正bytesを同一hashへ復元した。実dist画面・予算・独立レビュー・最終head CIの結果は対応PRへ記録する。合成API試験はnative iOSの動作証明ではない。

head 1e4cbddの初回CIは、移管本文の不一致を正しく拒否して停止した。今回の本文hash `721418924289fcee6e5bacdf37c9d1cdd06c57b896af36f028b31b3db43b438d` だけを別の編集候補として扱う[ADR-0061案](../design/adr/0061-preserved-prime-editorial-candidates.md)を追加した。元のmigration hash／placement、vendor／pin／lock／公開admissionを上書きせず、未知の編集とidentity/publication変更は引き続き拒否する。source候補を人間の公開承認記録と扱わない。

最初の実dist試験では、新設したclick時の全選択が320pxのtrusted click後にブラウザのcaretへ戻ることを確認した。click既定動作の取消しだけでは保持されなかったため、その追加機能を撤去した。失敗直後の選択・focus保全、手動操作後の古い通知抑制は維持する。強制的に選択を再設定するtimerやpointer/contextmenuの阻害で隠さない。実機の長押しCopy UIは未検証として残す。

実機ではHTTPS本番／確認ページの区別、iOSとBrave版、結果・URLコピーの成功／拒否時の表示と長押し、共有シートの開閉と再試行、コピー待機中の共有、X/LINEの行先を確認する。X/LINEの自動投稿や第三者宛送信は検証で行わない。
