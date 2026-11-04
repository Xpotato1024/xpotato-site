# 素因数分解計算機の検索向け説明の編集候補

基点mainは `080e2de`。一般的な計算用途を伝えるため、ページ名を「素因数分解計算機」にし、説明の先頭に整数入力から素因数分解の結果を確認できることを置く。既存のブラウザ内高速計算・外部送信しない特色を保持する。計算欄の直前に操作方法と36の短い例を1段落だけ置き、2以上を使い方の対象とする。0・1の挙動、計算アルゴリズム、入力、共有機能は変えない。

詳しい仕組み・最適化は別記事として用意する本人の計画に従い、この記事や未公開リンクは追加しない。未登録か低順位かはSearch Console未検証であり、インデックス障害や順位改善の保証を述べない。

今回のMDX全体のSHA-256は `ce7371740734fcb191040c99af57167bac8ec9fb890f40bb7b711695525f9fc2`。2026-11-04の取り込みでは、main `2850960` の共通ツール経路へ接続する。廃止済みのPrime専用hash whitelist・旧validator配置・移管placementを復活させない。元の移行manifestは保持し、`apps/site/src/content-registry/editorial/manual-revisions-v1.json`の本文/frontmatter hash、編集理由、共通の`titleRevision`を同期する。名称変更のbefore/after、既存の対象path・ContentId・routeと現行本文hashを検証し、他の保護metadata制限は維持する。

ContentId、URL、公開日、公開状態、分類、Demo binding、vendor/pin/admissionは維持する。候補登録やDraft PRはmerge・本番配信の承認ではない。検索用metadata・一覧label・canonical・サイトマップと、PC/390pxの実dist表示を確認し、検証結果はPRへ記録する。スクリーンショットはレビュー用に保存し、Gitには追加しない。
