# 狭幅と結果表示のローカル修正候補

2026-10-24。PR117 と main `d2aaad6ae1970ff638f0c14d54010f04be2a48dd` を合わせたローカル head `0f85b03a3e84c083f08a759bb6e0e3ce6509e733` からの追加差分。PR115/116 は含めない。正式 v0.1.2 の vendor/pin、URL/ContentId/SEO、capability/CSP、資格情報・権限・監視は変更しない。

## 差分

- host の Demo slot に min-inline-size:0 / max-inline-size:100% を追加する。tool の内部を host selector で上書きしない。
- 作成契約と Skill に、長い選択肢・DOM/OS popup/zoom の区別・狭幅/文字200%・実測と上限の分離・因子ごとの semantic row を規定する。
- 同期ツール template の root を縮小・折返し可能にする。計算機能、profile、API許可、依存は変更しない。
- 私的presentation helper は新候補のdetails/buttonに入力のみ・focus保持の期待値を適用する。公開済みv0.1.2をこのflat/focus検査の対象とはしない。このhelperは今回のPlaywright試験で実行したものではない。

toolkit 側の固有GUIは別sourceのローカルcommit `48fe1933b61ba96cb8b25ed63be9b26c3d5831c5`。サンプルをページ内表示へ変更し、実経過／上限を分け、判定を1因子1項目へ変更した。SiteへGUIをコピーしていない。

## 実測

指定Node24.22.1/npm11.19.0、offline cacheのnpm ci --ignore-scriptsを使用。canonical authoring test 3/3（生成sourceのテスト、独立2出力の一致とartifact checkerを含む）、npm run build、Astro check（99 files、error0/warning0/hint2）が成功。

新Site distの実HTML/CSSとtoolkit候補mountを私的ローカルハーネスで結合した。React hydration と既存page scriptはこのハーネスから除外しており、正式な新版採用の受入ではない。desktop Firefox151.0 / WebKit26.5を順番に、320/393/480px・文字100/200%・100桁と長い日本語・開閉/選択/focus/blurで測定し、各25観測すべてtool内の横あふれなし。最後の実計算360では因子3項目と設定開示を表示して画素確認し、393px document=393px、tool client/scroll=346/346px、page error0。

比較対象の正式v0.1.2 Site成果物では、WebKitで実在する最後のサンプルを選択すると393px document=516px、tool client/scroll=346/492pxを再現した。OS popupの寸法は測定していない。

## 未解決・保留

320px/文字200%では既存headerのmobile-navigationがdocumentをFirefox364px/WebKit367pxへ押し出す。toolは240/240pxで収まる。これを利用者のiOS画像の原因と断定せず、Site全体の狭幅受入が完了したとも扱わない。global overflow clippingで隠していない。

実iOS/Android、native popup/keyboard/autozoom、実screen reader、BFCacheは未検証。実iOSの受入をdesktop WebKitで代替しない。正式v0.1.3採用・React結合・最終CI・独立レビュー・固定Production artifact配信・公開画面検証は未実施。Cloudflare設定読取も未完了で、今回の修正のpush/merge/release/deployは保留中。

toolkit v0.1.2 tag CI の初回Native validation失敗、同source再実行成功、原因未確定という履歴を維持する。

独立レビューで、helperの旧select分岐が公開v0.1.2のfocus仕様にも対応するという誤った説明を指摘された。旧分岐を削除し、新しい私的候補を明示的に要求する形へ修正した。正式pinや公開版のfocus仕様は変更していない。
