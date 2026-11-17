---
status: canonical
owner: operations
last_verified: 2026-11-18
---
# 現行機能の検証

通常の検証は現行source、共有契約、現在のcatalog/registry、同じrunで生成した成果物に対して実施します。旧サイト移行の再現・Phaseごとの台帳再生成・過去実装の回帰モデルは必須条件ではありません。

1. pinned toolchain/lock、選択tool、CMS契約を確認する。
2. 単体・契約・権限境界・実装依存方向を検証する。
3. 現行MDX、taxonomy、ContentId、媒体/編集来歴、公開holdを検証する。
4. site/editorを各1回buildし、検索・RSS・sitemap・CSP・公開manifestを生成する。
5. 同じdistにURL・SEO・検索・媒体・JS隔離・ローカル配信・ブラウザ/a11y検査を適用する。
6. 必須並列jobの成功を照合してimmutable artifactを作り、Windows consumerは同じarchiveを再buildせず検証する。

入口はroot package.jsonと[CI](../../ops/ci/README.md)。`site:output:check`は既存distを読むだけでbuildを繰り返しません。`tools:readiness`は現在の選択Releaseと実runtimeの結合を確認します。JSON Schemaは必要な連携時だけ生成し、生成の決定性を一時出力の単体テストで保証します。

## 外部環境

通常CIにprovider資格情報・私有媒体を渡しません。合成GitHub/R2の成功と実GitHub App/R2/iPhone/課金の受入れは別です。本番配信・媒体保存はowner/main/manual/Environment・readbackの条件を維持します。監視の受入れは実際に有効な操作範囲だけで行います。

## 履歴

過去の設計・移行・公開の証拠を再調査する場合は[固定Git版](source-history.md)を使います。履歴テストのために現在のアプリへ旧コード・旧URLの内部import・古い生成物を復活させません。
