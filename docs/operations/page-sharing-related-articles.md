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

既存の static-first runtime 検査には、共有 UI・H1・canonical・実際のルート・公開状態が一致する場合だけ `/scripts/page-share.js` を条件付きの共通補助処理として登録する。通常の未登録 script／依存・動的コード・通信・状態収集の拒否は保持する。配信 script はレビュー対象のローカル source と同一バイトで、個別上限は raw 4096 bytes／gzip 1800 bytes。メニュー・コードコピー・検索・React の予算や CSP は拡大しない。非同期コピーの拒否が遅れて届いた場合、利用者が別の入力やモーダルへ移っていれば focus・選択・スクロールを奪わない。

見出しは semantic H2 を保ち、Site 本文用フォントを使う UI 見出しだけ `data-font-family="body"` として font slice 生成にも伝える。実際に表示しない明朝体の共有見出しを検索ページの font CSS へ集めず、本文用の全表示文字は保持する。フォントファイルや Unicode range 自体を削らず、既存 CSS の 100000 bytes 上限も維持する。空の status は余白だけをゼロにし、live region を display:none にしない。

共有先はロゴ・記号と短いラベルを一組にし、計算結果のコピーとは区別する。X／LINE の画像は配布元のバイト列をそのままローカル同梱する。画像自体は装飾扱いとし、操作の名前はテキストで提供する。hover／focus／処理中にロゴの形・色・不透明度を変更せず、操作枠で状態を示す。端末共有とリンクコピーは Site の小さな線 SVG で、実行時の依存・外部画像取得を増やさない。

ブランド資産（取得確認: 2026-10-25、各社の商標。Site の独自ロゴではない）:

- `public/icons/share-x.svg`: [公式 X ロゴ archive](https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-logo.zip) の `logo.svg` を無変更で同梱。白ロゴを黒い余白付き領域に表示する。SHA-256 `dd46f96b6f47fcd33683b79ddfaf3daca1d4f8aeba3c0f2bde1584c69cc699d4`。
- `public/icons/share-line.png`: [公式 LINE Brand icon archive](https://www.line.me/static/logo/top/LINE_Brand_icon.zip) の `LINE_Brand_icon.png` を無変更で同梱。[LINE ロゴ規約](https://www.line.me/en/logo)に従い、縦横比・色・形を保持し、40px 以上・余白付きで表示する。SHA-256 `5e93437eb5ec0dcdece92d1562fcd435d1d521cca5c013d2d9e15b544a1d8a39`。共有リンクの利用条件は上記 Social Plugins 規約・[デザインガイド](https://developers.line.biz/en/docs/line-social-plugins/resources/design-guide/)を参照する。

素因数分解機の Site 本文は、入力・実行条件と重複する長い数値解説や計算例を置かず、結果が未完了・未証明になった人への短い閉じた補足だけにする。入力前は toolkit の欄内上限と実行条件、計算中は状態と中止、結果確認は因子の判定と停止理由を主とする。メタデータ・canonical と初期 HTML の正確性は本文の文字数と別に検証する。
