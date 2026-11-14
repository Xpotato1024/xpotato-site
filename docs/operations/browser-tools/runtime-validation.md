---
status: canonical
owner: operations
last_verified: 2026-10-15
canonical_for:
  - registry-derived Tool route and build asset validation
---

# 登録ツールのroute・asset検証

公開catalog（noindexでもdetailを配信するToolを含む）、semantic DemoのAST参照、active primary binding、React module registry、明示component IDから許可routeとhydrationを導出します。初期はTools内のprimary toolだけです。未登録island、欠落・重複binding、未知hydration/framework、sourceのDemoとの不一致を拒否します。

security/static validatorは最終HTMLのmodule marker、island数、hydration/export、同一originの生成component/renderer URLとbootstrapを検査します。CSPは既存baselineを維持し、登録Tool routeだけに `connect-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'` を追加します。検索・通常navigationの経路は維持します。

`phase8-runtime.ts` が最終HTMLの属性をparse5で、生成JSのimport/export/dynamic literalをASTで解析してtransitive graphを読み、実bytes・gzip・hashを計測します。通常の文字列やコメントは依存と誤認せず、非literal import・外部依存・query aliasは拒否します。Phase 8と性能検証は同じgraphを使い、search/Reactの重複と未許可routeへのruntime漏れを拒否します。複数Tool間のReact共通chunkは許容します。既存menu・fenced-code copyは個別の厳密なmarkup/依存/予算検査を維持し、copyはcode routeの性能予算へ含めます。予算自体は変更しません。

`_headers` の生成・validator・最終dist試験配信器は同じpath rule parserを使います。実装対象は生成するpath＋wildcard＋加算headerのsubsetで、未対応構文は拒否します。一致した全ruleのCSPを結合して保持し、cache headerをHTML等へ平坦化しません。100 rule・2000文字/行の上限も検査します。HTTP wireの複数policyと、既存実ブラウザ試験でTool fetch拒否・検索成功を確認します。

これは固定版Toolを追加する前の検証基盤です。独立repoのrelease manifest/全file hash/license/React peer照合・vendoring・実ツール採用・ready後通信ゼロ/offline受入れは後続です。CSPは任意コードのsandboxでも、入力非送信の完全な証明でもありません。既存素因数分解のPhase 7 parityと挙動、旧44記事hold、手動Production artifact承認は維持します。

### 配布元の製品検証とSiteの接続検査

[ADR-0077](../../design/adr/0077-tool-release-validation-ownership.md)に従い、製品の数値・入力境界・engine/時間予算・複数Worker・copy状態のmatrixは配布元の検証済み固定版に委ねます。Siteの通常CIはそれらを再実行しません。新しい版の採用前にexact sourceと配布元の成功証拠を確認し、hash-bound source/release reviewへ結び付けます。未確認版をtag名だけで信用しません。

`checkInstalledToolsReadiness` は全登録toolのpin/manifest/file bytes、実route、CSP、licenseと対応sourceを検査します。さらに、manifestが宣言する固定Worker文字列を静的に読み、実routeから到達する最終bundleの文字列hashと照合します。Worker内のWASMを含むpayload bytesの変化・欠落は失敗し、任意の配布コードをvalidatorで実行しません。

Primeの実ブラウザは `prime-site-smoke.mjs` のみです。hydrateと採用版、licenseのHTTP配信、代表1入力、hostのpage/Worker CSP、Astro unmountと通常navigation、ホストCSSのdesktop/320px・文字200%接続を確認します。製品deadlineの完全分解を要求せず、Workerをdebuggerで起動時停止しません。PWAと共通installerのsynthetic fixtureはSite所有のため維持します。

旧 `prime-tool-interaction.mjs` は明示的な個別診断用で、通常CIからは到達しません。2026-11-14以前にその観測負荷が製品の時間予算を消費した事実と、個別失敗runの原因未確定は歴史的な記録として扱い、製品の保証を緩める根拠にはしません。
