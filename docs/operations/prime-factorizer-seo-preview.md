# 素因数分解機の検索向け説明と限定プレビュー

この変更は Site の説明・静的 HTML・パンくずの改善であり、toolkit の機能や入力上限、採用版、公開状態を変更しない。

- Content ID `bca48f98-c89a-457f-84d8-168f941fe469`、`/tools/prime-factorizer/`、保護された title／H1「素因数分解機」を保持する。description と更新日・本文の変更は既存の手動改訂 ledger に記録し、移行 baseline は保持する。
- 短い説明では、端末内の整数計算、非送信、コピー、設定・中止という実装済みの能力を紹介する。初回のページ・資源取得まで通信不要とは表現しない。
- 計算例、判定の確度、入力可能範囲と計算完了保証の違いはツールより後ろの初期 HTML に置く。追加の目次や操作説明で入力欄を押し下げない。本文の数値・意味は固定採用版 v0.1.2 の入力 policy・整数 parser・判定／結果検証コードと照合する。
- Tools のパンくずは表示と `BreadcrumbList` で同じタイトル・正規 URL を使う。既存の `WebPage`、canonical、OG、sitemap は Site の通常生成を使う。評価やレビュー、未実装機能は追加しない。FAQ やアプリの検索拡張への適格性を成果として扱わない。
- 本番向け dist は従来の indexable なページを生成する。一方、別ディレクトリに複製する限定プレビューだけに HTML の `noindex,nofollow`、応答の `X-Robots-Tag`、専用 robots を付ける。プレビューの noindex は認証の代替ではない。既存の Tailscale インターフェースに限定する。

確認対象は生成 HTML の本文・見出し・metadata・構造化データ、改訂 ledger、robots と sitemap、内部リンク、狭幅／文字拡大、既存 GUI の操作と公開ファイルの一致。toolkit は `14146f35bba20d04e259ef8b96bfa25ca6af71c3` と既に二回の clean build が一致した成果物を再利用する。限定プレビューは Site ビルドへ候補を直接 mount した参考表示であり、正式な React 採用・実機 iOS 受入や本番反映を意味しない。

順位・競合性能・検索量は測定していない。Google のインデックス・実際のタイトル／スニペット・クエリ別表示／クリックは公開後の別工程で確認する。Search Console への登録・送信や provider 操作はこの変更に含めない。
