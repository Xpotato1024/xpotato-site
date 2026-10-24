# 記事・ツールの共有と関連記事

Site の記事（Blog／Notes）とツール詳細では、本文の後にページ共有を表示する。toolkit の入力・計算・結果コピーとは別の Site 機能であり、計算状態は読み取らない。

共有対象は表示用ページ名と、Site の HTTPS canonical origin に属する正規の公開 URL だけ。現在のブラウザ URL を使わず、canonical の query／fragment も除く。draft、noindex、記事 preview、private candidate、他 origin・不正 URL は対象外。限定プレビューに複製した既存公開ページでは、共有先は正式公開ページであり候補 UI のプレビュー URL ではない。

X／LINE は通常のリンクで投稿・共有画面を開く。ページ取得やクリック前に外部 SDK・計測・共有数取得を行わない。別タブには `noopener noreferrer` と no-referrer を適用する。端末の共有メニューは安全な環境で API が使える場合だけ表示し、共有結果は送信完了と断定しない。リンクコピーはユーザー操作時の writeText のみで、クリップボードを読み取らない。HTTP・拒否・未対応では同じ公開 URL 欄を開いて選択し、手動コピーできるようにする。JavaScript なしでも X／LINE と公開 URL の表示を利用できる。

参照した公式仕様:

- [X Web Intents](https://docs.x.com/x-for-websites/web-intents/overview)
- [LINE のカスタム共有リンク](https://developers.line.biz/en/docs/line-social-plugins/install-guide/using-line-share-buttons/)
- [W3C Web Share API](https://www.w3.org/TR/web-share/)
- [W3C Clipboard API](https://www.w3.org/TR/clipboard-apis/)

ツールの関連記事は、既存の公開・indexable catalog と taxonomy ranking から Blog／Notes だけを選ぶ。最大4件、同点時は既存の日付・Content ID 順。ゼロ件では見出しや空枠も出さない。素因数分解の記事は既存 topic ID `math` と `prime` を付けると、ツールと共有 topic の重みが既存閾値に達する。記事側も同じ ranking によりツールを候補にできる。未作成・draft・held candidate・noindex の記事をダミーで補わず、新たな本文・記事・分類をこの変更で作らない。

検証では実際の投稿・外部共有の確定を行わず、URL のデコード、API mock、未対応／拒否／取消、公開可否、ゼロ・複数の関連候補、キーボード・狭幅・文字拡大・CSP・クリック前の外部通信を確認する。CSP／Permissions-Policy や provider 設定は拡張しない。正式採用・本番配信は別の承認保留を維持する。
