---
status: canonical
owner: architecture
last_verified: 2026-10-22
canonical_for:
  - browser tool authoring and responsibility boundaries
---

# ブラウザツールを作り、固定版として組み込む

現在の標準入口です。機械的な正本は [browser-tool.ts](../../packages/content-contracts/src/browser-tool.ts)、取り込み検査は [browser-tool-adoption.ts](../../packages/site-validators/src/browser-tool-adoption.ts) です。テンプレートと [作成Skill](../../.agents/skills/create-browser-tool/SKILL.md) は同じ生成・検査コマンドを使います。生成済みsnapshotや説明から権限を増やせません。

## 管理場所と責務

| 管理場所 | 所有するもの | 所有しないもの |
|---|---|---|
| site: content-contracts / site-validators | manifest/pin/review schema、profile、資産・source・ライセンス検査 | 各ツールの計算・固有GUI |
| site: templates / scripts / .agents/skills | source生成、共通開発手順 | 独自loader、remote SDK、公開承認 |
| 独立したツールsource repo | core、GUI、adapter、テスト、再現build、配布物・対応ソース | siteのroute/CSP/registry |
| site: vendor / registry / wrapper | immutableな配布版、pin、明示import、hydration、採用版表示、host theme | GUIをコピーして改造すること |
| site: release pipeline | 検証済みsite artifact、手動配信guard | push/PRを公開許可にすること |

分解機sourceは [browser-prime-toolkit](https://github.com/Xpotato1024/browser-prime-toolkit)。GUIは src/site/mount.js・tool.css、adapterは src/site/index.js、状態は session.js と document-scope.js、core/Workerは下層が所有します。site wrapperはpackageとCSSの再exportです。GUIをsiteに複製しません。

共通仕様・生成器・Skillをsiteへ置くとschema変更と検査を同じPRで扱えます。独立SDK repoなら複数hostへの配布・独立releaseに有利ですが、現状は仕様/検査の同期とrelease依存を増やします。今はrepoを増やしません。複数hostが実際に必要になった時に一体で抽出を検討します。

## 推奨source構造

| path | 役割 |
|---|---|
| src/core/convert.mjs | React/DOMに依存しないboundedな処理、入力精度と出力モデル |
| src/ui/Tool.mjs | label、入力→実行→結果、error、instance別状態 |
| src/adapter/index.mjs | ESM default React component。hostとの唯一の入口 |
| styles/tool.css | .bt-<toolId> に限定した固有GUI、semantic tokenのfallback |
| test/core.test.mjs | UTF-8上限・境界・Unicode・正しい結果 |
| scripts/build.mjs | local sourceだけから決定的なflat配布物へ変換 |
| manifest.base.json | canonical schema/defaultから生成されたprofile snapshot |
| authoring-contract.json | 生成元schemaのhash。更新元ではなく由来の記録 |
| package.json / package-lock.json | private source package、固定toolchainとReact peers、review済みlock |
| LICENSE / NOTICE | 作成者が指定した利用許諾・帰属。生成器は権利を創作しない |

非同期ツールは src/core、src/worker、src/session、src/ui、src/adapter 等へ分けられます。既存分解機を名前だけ合わせるために一括移動しません。配置より責務境界と検査が優先です。

配布物は tool.mjs（default adapter）、ui.mjs、core.mjs、tool.css、package.json、LICENSE、NOTICE、browser-tool.json。source/test/buildは配布runtimeへ混ぜません。sourceは別途固定commitで提供します。一般profileの親directory import禁止に合わせ、builderが既知3moduleだけflatに変換します。

## hostとの境界

API v1はESM defaultのReact component。React/react-domの版はcanonical export browserToolReactPeersを参照します。React以外のbare runtime import、remote script、任意loader、自己更新は不可です。共通CSS等を同梱する場合もbuild時に固定してmanifest/hashへ含めます。

hostはroute・hydration・registry・採用版を決めます。instanceId/localeは任意の表示用props。省略時もuseId等でlabel IDが衝突しないこと。hostから未検証の計算関数、URL、資源hardcapを注入しません。

hostはsemantic CSS custom propertiesで色を渡せます。名前の正本は browserToolThemeProperties。--bt-text、--bt-muted、--bt-surface、--bt-border、--bt-accent、--bt-on-accent、--bt-danger、--bt-focus をfallback付きで参照します。hostは内部selectorを場当たりで上書きしません。token変更時は実際の色の組合せを検査します。

入力と主要操作を先に置き、詳細設定はdetailsへ、version/license/対応ソースはhostが操作部の下へ表示します。label・明確なcontrol border・44 CSS px以上のtap領域・focus-visible・主要/補助/取消の階層・disabled表示・long outputの折り返しを確認します。errorはalert、進行状態は穏やかなlive region。画面reader/実機試験をしていない場合はその限界を記録します。

## profileとライフサイクル

| profile | 許可と制限 | 参照 |
|---|---|---|
| 既定の同期v1 | memory、ready後通信なし、Worker/WASM/file/download/clipboardなし。短いbounded処理。schemaのmaxComputeMs以下 | template、synthetic fixture |
| prime-factorizer-async-v1 | 固定repoの分解機専用。Worker/WASM、有限job/輸送/役割別memory、AGPL対応ソース | [専用profile](prime-factorizer-async-profile.md) |

分解機の例外を任意ツールへ流用しません。別asyncツールは必要性・source/license・資源上限・CSP・実dist受入を審査する新profileから始めます。同期maxComputeMsと長時間job deadlineは別物です。桁数だけで難易度や完了時間を保証しません。

同期ツールはloading→ready→result/invalidを扱い、stateはinstance内memoryだけ。unmount後にtimer/listener/状態を残さないこと。分解機はunprepared→loading→ready→running→cancelling→result/error/blocked→disposedをsessionが管理します。cancel/deadline/unmountではWorkerを退役させ、退役不明ならdocumentをquarantineして再実行を拒否します。複数instanceでも同documentの計算leaseは1件。BFCache復帰時も同scopeを使います。

readyは必要資産が初回asset graphに含まれ利用可能になった状態。再試行・取消後の再実行も追加通信せず動くこと。WASM上限はJS、転送、ブラウザRSSや空きRAMの上限ではありません。OSのタブ強制終了を防げると表示しません。

## 最小ツールを生成して検査する

siteの指定Node/npmを用い、生成先は存在しないdirectoryを指定します。LICENSE/NOTICEは利用を許可できる内容を準備してください。

    npm run browser-tools:author -- create --directory /absolute/new-tool --id text-counter --title 文字数 --license MIT --license-file /absolute/LICENSE --notice-file /absolute/NOTICE

生成器はGit操作・依存取得・repo作成・公開を行いません。生成先で内容を編集し、lockを作って依存をreviewします。

    npm install --package-lock-only --ignore-scripts
    npm ci --ignore-scripts
    npm test
    npm run build -- /absolute/fresh-release

site checkoutで同じ正本を使います。

    npm run browser-tools:author -- check --artifact /absolute/fresh-release

checkはschema、exact-set、bytes/hash、package/peer、transitive ESM、scoped CSS、API禁止事項を既存validatorで検査します。sourceの正当性、runtimeの通信ゼロ、独立review、取り込み承認は証明しません。AST検査はセキュリティsandboxではありません。

## review・配布・組み込み

1. 独立GitHub source repoのcleanな固定commitとlockを用意。source tree/blobと実checkoutの一致を確認。
2. 同一sourceから異なるclean directoryで2回buildし、同一artifact hashを確認。未知のbuilderを検査器が自動実行しない。
3. core/input/output、ライセンス、dependency、資産、lifecycleを独立review。review payloadを人が確定し、sourceCommit/tree、lock、manifest、配布hashを固定。
4. [固定版取り込み](browser-tool-adoption.md) の verify→adopt→select。releaseIdはappend-only。旧配布物は書き換えない。package/lock/vendor/pin/import/registry/bindingを同じPRで確認。
5. 実distをhostに組み込み、入力境界・不正入力・結果・複数instance・unmount・通常移動、ready後のPage/Worker通信とoffline、非同期なら取消/deadline/Worker退役/有限予算を試験。検出器の自己試験も保持。
6. desktop/mobile表示、keyboard/focus、tap/contrast/長文、source/licenseリンク、build/CIを確認。合成試験と実ツール、emulationと実機、未測定条件を区別。
7. Draft PRへ結果・source/artifact identity・未実施を記載。merge/release/npm/deployは具体的な承認範囲を確認。

テンプレート生成試験は自動testに含みます。従来のsynthetic fixtureのupdate/rollback/CSP試験も維持。分解機の固有GUIとsessionはtoolkit側で検証します。全ツールの一括再実装は不要です。
