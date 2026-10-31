---
status: canonical
owner: architecture
last_verified: 2026-10-22
canonical_for:
  - browser tool source and release adoption
---

# ブラウザツールの固定版取り込み

移管済みPrimeの本人依頼による本文編集は、移管時snapshotを上書きせず、[ADR-0061の編集候補](../design/adr/0061-preserved-prime-editorial-candidates.md)として本文全体のexact hashとdescriptionを別のclosed setでレビューする。候補登録は公開承認ではなく、未知の本文・baseline・identity/publication変更は拒否する。移管config／pin／lock／生成物の検査を維持する。

作成入口・責務・構造・template・Skillは [作成契約](browser-tool-authoring.md)。この文書は固定版の検証・取り込み・更新・差戻しを規定します。初期の「未選定」「builtin」という記録は [history](../history/browser-tool-adoption-foundation-2026-10-15.md) に保持します。

## 現行の共通契約

独立GitHub sourceの40桁commit、source tree、package-lock、配布manifest、file exact-setのbytes/SHA-256、LICENSE/NOTICEを一組でreviewします。通常build/runtimeはGitHub・CDN・latest tagへ接続しません。React island API v1、ESM default、memory、none-after-readyを使い、peer版・runtime/profileの正本は [共有schema](../../packages/content-contracts/src/browser-tool.ts) です。

既定同期profileはfile/download/clipboard/Worker/WASMなし、短いbounded処理、許可されたpermissive license。固定分解機だけ [prime-factorizer-async-v1](prime-factorizer-async-profile.md) を使い、専用repo・Worker/WASM・有限予算・AGPL対応source/第三者条件を検査します。既存公開bytesの互換契約です。新しい共通 bounded-browser-v2 は各toolのWorker/WASM/クリック時clipboardと有限予算を宣言し、source/license/asset/lifecycle検査を維持します。公開CSPは別gateです。

release packageは @xpotato-tool/<toolId>、React/react-dom peersのみ。追加runtime dependency・scripts・browser/imports overrideを拒否します。CSSは .bt-<toolId> 内の単純selector/declarationのみで、global reset・at-rule・url・escapeは不可。不明field/capability、remote/nonliteral import、React以外のbare import、source map、未到達JS、未列挙CSSも拒否します。local module/固定embedded Workerの検査は宣言済み非同期profileで使います。

AST検査は意味上のreviewの補助であり、任意の敵対的JavaScriptを封じ込めるsandboxではありません。通信ゼロはCSPだけから主張せず、実distの操作区間を観測します。

## verify → adopt → select

日常の更新・記事公開・配信の工程と失敗時の再開点は [運用手順](../operations/publication-update-runbook.md) を参照してください。source 照合は pinned Git blob をバイト予算付きの `cat-file --batch` でまとめて読みます。各 object ID / type / size / hash と checkout の全ファイルを引き続き照合し、source review / 2 clean build の証跡、リンク拒否、lock / toolchain / license の条件は変えません。取り込み CLI が配布元 builder を実行することはありません。

sourceはreviewしたcommitと一致するcleanな独立checkout。元commit/tree/blobをGit replacement無効で読み、実checkoutと比較します。originもreviewと照合します。lock・builder・依存・licenseを先にreviewし、秘密のない作業場所で明示的に実行します。同じsourceから異なるclean作業場所で2回buildし、両artifact hashが配布物と一致することをreview recordへ保存します。取り込みCLIはbuild/install/clone/fetchを実行しません。

    npm run browser-tools -- verify --source /reviewed/source --artifact /reviewed/release --review /reviewed/review.json
    npm run browser-tools -- adopt --source /reviewed/source --artifact /reviewed/release --review /reviewed/review.json --vendor vendor/browser-tools --release reviewed-v1
    npm run browser-tools -- select --vendor vendor/browser-tools --pins /reviewed/pins.json --tool tool-id --release reviewed-v1

vendor rootは事前に作成。adoptは <vendor>/<toolId>/<releaseId>/ へstage/renameし、pin JSONを返します。同一IDの異なるbytesを上書きしません。tool lockで同時adoption、symlink/hardlink入力を拒否します。敵対的な別processによる検査中の置換はOS隔離が必要です。

新規/管理済みtoolは [共通導入](browser-tool-authoring.md#成果物掲載先から導入する) のplan/apply/checkでreview/pinと掲載情報からfile dependency、root lock、static wrapper、module/binding/manifest登録を生成します。既存手動prime登録は保持します。新規active toolはreview済みreleaseIdが必要。現行分解機も固定packageであり、旧Number builtinは歴史fixtureです。全pinのbytesを通常検証で再照合します。

更新は新releaseIdへ追加。差戻しはselectで旧pinの現在bytesを確認してから既知dependency/import/registryへ戻します。version/tagだけを信用せず、過去配布物の再downloadや自動更新を行いません。

## host表示

Demoは選択pinと明示raw importのmanifestから、version・入出力byte上限・license・完全source commitリンクをbuild時に導出します。keyは toolId:releaseId、登録場所は interactive/manifest-sources.ts。元manifest bytesのSHAやidentityがpinと違えば停止します。別の手書きversion表やruntime manifest fetchはありません。

採用版とlicense/対応sourceは操作部の下。source linkは利用者による通常navigationで、計算通信ゼロの区間とは分けます。primeの結合site sourceは実build commitに固定したSITE_SOURCE_OFFERを提供します。旧v0.1.0のmusl補遺も保持します。

## 実施済み版と試験の区別

分解機v0.1.0はPR112で採用済み。source/pin/reviewは公開registryと docs/acceptance/browser-tools/prime-factorizer-v0.1.0-source-review.json に固定されています。GUI新版候補をbuildしてもこのpinは変えません。新版のrelease/adoption/公開は具体的な対象承認と実dist受入が必要です。

既存synthetic fixtureは .local/browser-tool-acceptance、新テンプレートから生成するfixtureは .local/browser-tool-authoring-acceptance だけで動きます。同じharnessで2commit、各版2clean build、append/update/verified rollback、offline install、実Astro wrapper、CSPを検査します。fixture pinは公開registry/通常CLIで拒否し、production distへfixture markerを混ぜません。

release:interactionは両fixtureをfresh Chrome/cacheなしで試験。日本語・UTF-8境界/超過・悪意文字列・reset、2instanceのID/state独立、text escaping、storage/URL、core上限、ready後のPage/HTTP/通信/CSP観測、offline同値、検出器自己試験を確認します。receiptは XPOTATO_RELEASE_TEMP の browser-tool-ready-offline.json と browser-tool-template-ready-offline.json。生成成功は実ツールのsource reviewや公開受入を代替しません。

分解機は別の実dist試験で結果精度、取消/deadline、Worker退役、unmount、document lease、通常移動、offlineを検査します。Firefox/WebKit/iOS等の未実施条件はreceiptに残します。iframe/PWA/remote script/任意自己更新、一般のfile/download等は初期対象外です。

このcheckoutの固定選択は [v0.2.2採用](../acceptance/browser-tools/prime-factorizer-v0.2.2-adoption.md)。[v0.2.1](../acceptance/browser-tools/prime-factorizer-v0.2.1-adoption.md)以前のimmutable bytes・review・pinは履歴として保持する。公開済みPrimeは管理移行済みで、明示的な `--update-published-prime` により新releaseIdとexact public admissionを更新する。toolkit単独の検証、Site実dist、本番の確認は区別する。

v0.2.0の `experimentalAboveBits` は宣言された最大bit未満の正整数だけを認め、該当範囲を実験的と表示する。`Reflect` は直接の `ownKeys` 呼出のみ、合成Workerは個別reviewしたPrime ECM sourceのexact path/name/SHA-256だけを認める。一般の文字列結合Workerを許可しない。CSSコメントはquoted stringを区別して検査し、selector scopeの判定から未知のCSSを消さない。配布 `artifact-provenance.json` はstrict schema・出力exact-set/hash・対応source/recipe bytesを照合する。この記録の自己申告をclean buildや安全性の証明へ読み替えない。
