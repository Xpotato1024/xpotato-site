# Siteヘッダーの狭幅・文字拡大修正

2026-10-24。Site local head `4dfec02c63fafbdc55d54501e0728bbf2912a444` からのhost専用修正。toolkit `037468b7aabe2f88789c9ce933ef91811506ac3c`、既存vendor/pin、route/ContentId/SEO、CSP、依存、資格情報・権限・監視は変更しない。PR115/116を含めない。公開と、拒否されたrelease準備ブランチへのマージは保留した。

## 原因と修正

旧headerはbrandが縮まないflex項目で、320px/文字200%では検索・メニューがviewport外へ押し出された。正式v0.1.2 Siteの固定成果物からheaderを分離した私的ハーネスでは、document幅がFirefox364px、WebKit367pxになった。長いメニュー文言も2列の最小幅を押し広げた。native popoverの上端68px固定では、文字拡大で高くなったheaderに重なる。

mobile headerを折返し可能にし、brandの最小幅を抑え、横に収まらない操作群を次の行へ回す。ロゴ・検索・メニューの44px領域と文字サイズを保持する。長いメニューはminmax(0,1fr)の列内で折り返す。headerの実際の下端を既存scriptで測り、native popoverの開始位置・メニューの最大高さ・scroll paddingへ反映する。ResizeObserver、resize、pageshow、開く直前の更新で追従する。global overflow clipping、ズーム禁止、文字の切捨てを追加しない。

## 検証

- `scripts/verify-header-reflow.mjs` は別途固定したPlaywright Core1.61.0で実行する任意のrunner。実buildのheader HTML/CSS/menu scriptを用い、私的HTTPハーネスでcontentのinteractive islandと他のpage scriptを除外する。toolkitの計算試験やhydration受入とは分ける。
- desktop Firefox151.0 / WebKit26.5を順番に、280/320/360/393/480/760/768/1180px、文字100/200%の各16条件。旧成果物では各16条件が不合格（文字拡大時のheaderと長いメニューの横幅）。修正後は各16条件成功、page error0。最初の非分離probeにはload timeout等もあり、製品不具合の根拠として流用していない。
- 修正後の320px/文字200%はdocument/headerともclient=scroll=320px。brand35.2pxの文字と44pxの操作領域を保持し、header高は約145.6pxへ自然に伸びる。閉状態・native/fallback開状態・長い日本語と80桁連続文字、末尾リンクの可視範囲、Enter/Space、Escapeとfocus復帰を確認する。
- 開いたままの文字100→200%、幅変更、480px高のviewport、1181pxへ移る際の閉鎖、戻っても自動再開しないこと、連打と領域外クリック、reduced motionを確認する。
- 指定Node24.22.1/npm11.19.0でbuildとAstro checkが成功（99 files、error0/warning0/hint2）。変更ファイルの構文・UTF-8/LFとdiffを確認した。CSP設定ファイルは変更していない。生成_headersと旧Production成果物との差はstyle hash1件の削除だけで、directiveや許可元の追加はない。byte一致とは扱わない。

実行例（PLAYWRIGHT_MODULEとPLAYWRIGHT_BROWSERS_PATHは既存の固定runtimeを指定）:

    node scripts/verify-header-reflow.mjs --dist apps/site/dist --out /private-output/header-report.json

## キーボード条件と限界

Firefoxではリンク間のTab巡回を実操作する。Windows WebKit fixtureはSiteを使わない2リンクとbuttonだけの最小対照でもTab/Alt+Tabがリンクを省略した。WebKitのリンク巡回を成功とは呼ばず、リンクのrole・programmatic focus・スクロール後の可視範囲だけを確認する。Enter/Spaceによるnative control操作とEscape復帰は両engineで確認する。OS/Safariの鍵盤設定差の参考は[Appleの公式ショートカット説明](https://support.apple.com/guide/safari/keyboard-shortcuts-and-gestures-cpsh003/mac)。このMac向け説明をWindows fixtureや実iOSの検証結果に置き換えない。

実iOS/Android、物理keyboard、実screen reader、BFCacheは未検証。script無効時の文字拡大に伴う動的メニュー位置補正も保証していない。正式v0.1.3採用・最終CI・固定Production artifact・公開画面の受入は未実施。v0.1.2 tag CIの初回Native validation失敗／同source再実行成功／原因未確定の履歴は維持する。
