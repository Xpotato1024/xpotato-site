---
status: proposed
owner: architecture
last_verified: 2026-10-22
canonical_for:
  - prime factorizer fixed release exception
---

# 素因数分解の有限非同期プロファイル

[固定版取り込み](browser-tool-adoption.md)の同期v1を一般に緩和せず、prime-factorizer / prime-factorizer-async-v1 の選定済みGitHub sourceだけを例外とする。公開先は /tools/prime-factorizer/、ContentIdは bca48f98-c89a-457f-84d8-168f941fe469。本人の承認対象はGitHub Release v0.1.0、site PR111→110→組み込みPR、本番受入れ後の旧分解機置換。npm公開や無関係な記事公開は含まない。実施状況と本番配信は別のreceiptで確認する。

## 固定値と資源

sourceは Xpotato1024/browser-prime-toolkit の40桁commit、source tree・lock・manifest・全artifact bytes・2回のclean build hash・独立reviewをpinへ束ねる。AGPL-3.0-onlyと第三者条件、SOURCE_OFFER.md、THIRD_PARTY_NOTICES.md、配布Worker/WASMから対応sourceへのindexを同梱する。実行時依存の自動更新はしない。

入力は正確なBigIntで最大100桁かつ332bit。通常モードは軽い経路を優先し、最大60秒、保守的な自動Worker選択を使う。高難度モードは明示選択で最大6Worker・768MiB・600秒。大メモリモードはさらに明示的な1536MiB予算で最大5Worker・3600秒、coordinator 1024MiBとhelper各64MiBに制限する。manifest上限はmaxWorkers=6 / maxWasmBytes=1610612736 / jobMaxMs=3600000 / maxTransportBytes=67108864。入力16KiB、出力256KiBの上限を維持する。

WASM linear memory上限はJS heap・転送・Chrome RSS・OS空きRAMを含まない。hardwareConcurrency/deviceMemoryは参考値で、未提供は保守fallback。巨大割当で端末限界を探査しない。割当失敗は可能な範囲で安全停止するが、OSによるタブ終了の防止を保証しない。難易度は桁数だけで断定しない。

Document内は複数instanceを含め同時1jobのleaseを共有する。取消・unmount・pagehideで退役を要求し、終了確認前にはleaseを返さない。不明な退役はDocumentをquarantineし、BFCache復帰やremountで解除しない。新しいDocumentでのみ回復する。因子・積・素数確度・残余の検証を維持し、推定素数を確定素数と表示しない。同じ因子は累乗で表示する。

## 通信とCSP

React islandの初期asset取得後は、計算・変換に通信を要しない。Worker sourceとWASMは固定assetに埋め込み、job開始時のremote import/fetchを使わない。system fontを使い結果文字による追加font取得も避ける。file/download/clipboard/storage/PWA/iframe/remote scriptは許可しない。source/licenseリンクは利用者が選ぶ通常navigationである。

CSP例外は検証済みpinが専用routeへ結び付く場合だけ生成する。connect-src none / frame-src noneを維持し、script-srcへwasm-unsafe-eval、worker-srcへblob:を追加する。全route共通のunsafe-evalやunsafe-inlineは追加しない。Cloudflareの同名CSPを重ねてWorkerを誤って拒否しないよう、このrouteだけ既存CSPをdetachし、baselineをすべて含む完全なCSPで置き換える。[公式_headers仕様](https://developers.cloudflare.com/workers/static-assets/headers/)に従い、生成検査と実Wrangler asset engineの検査を併用する。他routeのCSPは変更しない。

JS budget例外も検証済みrouteだけに適用しraw 6,000,000 / gzip 2,700,000 bytesに限定する。Worker/WASMを含む固定初期assetの実測をperformance gateで確認する。

## 受入れと旧実装

旧Number分解モデルは公開islandから撤去し、歴史的入力・出力テストのfixtureとしてのみ保全する。旧Phase7 frozen parity receiptは書き換えない。承認された置換後は旧UIとの同一性を主張せず、固定pin・HTML/island/binding・ソースwrapper・専用CSPを検査するreadiness gateへ切り替える。

実際に配布するdistで、正確な入力/因子表示、オンライン/オフライン、PageとWorkerのCDP request/socket、HTTP trace、CSP、cancel/deadline/unmount/複数instance/画面遷移/Worker終了、有限予算、source/license表示を確認する。観測器には許可同origin Imageと拒否fetch/Worker fetchの自己検査を設ける。初期取得とready後を区別する。390px viewportは表示エミュレーションであり実機スマホ試験ではない。未測定の端末速度や5Worker全工程の改善率を主張しない。
