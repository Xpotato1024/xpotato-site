---
status: canonical
owner: architecture
last_verified: 2026-10-22
canonical_for:
  - browser tool authoring and responsibility boundaries
---

# ブラウザツールを作り、固定版として組み込む

## 通常書体と固定文言の準備

hostはDemoの `--bt-font-family` で既存の本文書体を渡し、toolkitの通常文・control・dialogはその指定を継承する。単体は端末内書体へfallbackし、コード／commit IDの等幅表記は維持する。toolkitから新しいfont-face、未知のfont URL、global font ruleを追加しない。

unicode-range付き書体の未使用字形は `document.fonts.ready` だけでは事前取得されない。対応toolkitは固定UI文字を初回prepare中に既存FontFaceSetで準備し、ready後の計算・操作で通信を起こさない。host側の閉じた配布説明は `data-bt-font-text` の固定公開ラベルとして明示的に渡せる。対象は4096文字以内とし、入力・結果・任意ページ本文やURLを収集しない。準備失敗時は既存のload-error／retryで復旧する。権限やCSPの拡大を意味しない。

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

hostはsemantic CSS custom propertiesで色を渡せます。色トークン名の正本は browserToolThemeProperties。--bt-text、--bt-muted、--bt-surface、--bt-border、--bt-accent、--bt-on-accent、--bt-danger、--bt-focus をfallback付きで参照します。書体専用の `--bt-font-family` は冒頭節の別のopt-in表示契約であり、この既存色トークン列挙やruntime capabilityを拡張しません。hostは内部selectorを場当たりで上書きしません。token変更時は実際の色の組合せを検査します。

入力と主要操作を先に置き、補助設定はdetailsまたは適用／取消とfocus復帰を備えたnative dialogへ収めます。version/license/対応ソースはhostが操作部の下へ表示します。label・明確なcontrol border・44 CSS px以上のtap領域・focus-visible・主要/補助/取消の階層・disabled表示・long outputの折り返しを確認します。errorはalert、進行状態は穏やかなlive region。画面reader/実機試験をしていない場合はその限界を記録します。

構造を示すsectionやdetailsを角丸カード・影・塗り面の反復で囲みません。[サイトの視覚規約](../design/visual-design-reference.md)に沿い、文字の階層・余白・必要な細罫線で区切ります。input/select/textareaの明確な境界は残し、controlの角は2pxを基準とします。入力controlは16pxまたはユーザーのrem設定以上を保ちます。GUIはhostが明示した本文書体を継承し、単体では端末内fontへfallbackします。固定UI文字のfont準備を初回prepareに含め、結果文字の遅延取得を防ぎます。色・文字寸法・行間でhostと調和させ、ready後通信の検査からfontを除外しません。既存のテンプレートもこの最小表現を使います。

focusの移動は必要な操作だけに限定し、状態更新に伴う移動には preventScroll を用います。サンプル選択やresetで入力へ強制focusしてソフトキーボードを呼び出さないこと。details展開・結果更新・取消を、ページ途中までscrollした状態でも確認します。layout viewportとvisual viewportのscale/位置、横overflowを分けて記録し、user-scalable=noやmaximum-scaleでピンチ拡大を禁止しません。Chrome emulationの成功をiOS実機のautozoom解消と扱わないこと。状態行は状態だけを示し、通信・保存方針はhostの導入説明またはtoolの説明箇所へまとめ、操作付近で重複させません。単体表示でも参照できる説明を保ちます。

### 幅・選択肢・結果表示の受入条件

host の interactive module slot は `min-inline-size: 0` と `max-inline-size: 100%` を持ち、flex/grid の内側で内容の最小幅に押し広げられないようにします。tool 自身も root・入力・選択肢・長い結果を利用可能な幅に収めます。ページ全体の `overflow-x: hidden/clip` で問題を隠したり、ズームやフォーカス表示を失わせたりしません。

長い説明付き選択肢は、ページ内で折り返せる native `details` と通常のボタン等で表示するか、native `select` の短い選択名と説明を分けます。OS が描画する選択ポップアップの幅を通常の CSS で制限できるとは扱いません。選択のみで計算を開始せず、入力へ強制フォーカスしません。

少なくとも 320 CSS px、長い日本語ラベルと長整数、開閉・選択・focus/blur、200% の文字拡大で、document と tool の `scrollWidth/clientWidth` を別々に測ります。native popup、DOM overflow、入力フォーカス時の zoom は区別して記録します。desktop WebKit やモバイル設定のエミュレーションで実 iOS の受入を代替しません。

結果の実測時間と設定上限は別の見出し／項目にし、時間の測定区間（初期化・検証・解放・初回準備の扱い）を説明します。Worker/WASM の設定上限を実測使用量と呼びません。因子の判定は native list 等で1因子1項目にし、重複度・未証明の因子・未解決の余因子・停止理由を保持します。コピー操作と開示内容は狭い幅でも十分な間隔を保ち、不要な空白を増やしません。keyboard とアクセシビリティツリーを確認し、実機や読み上げソフト未検証は明示します。

## profileとライフサイクル

| profile | 許可と制限 | 参照 |
|---|---|---|
| 既定の同期v1 | memory、ready後通信なし、Worker/WASM/file/download/clipboardなし。短いbounded処理。schemaのmaxComputeMs以下 | template、synthetic fixture |
| prime-factorizer-async-v1 | 公開v0.1.0用の互換契約。既存bytes/pinと専用repo条件を保持 | [旧版専用profile](prime-factorizer-async-profile.md) |
| bounded-browser-v2 | 各toolのWorker/WASM/クリック時clipboard書込を宣言。有限job/Worker/WASM/輸送量、固定同梱資産。AGPLなら対応ソース/第三者条件必須 | browser-tool.ts / adoption validator |

新規非同期ツールには共通 bounded-browser-v2 を選び、必要なcapabilityだけ宣言します。未使用Worker/WASMの上限は0、embeddedWorkerModules/embeddedWasmModules/workerLoaderModulesは初回ESM graphに到達する同梱moduleのpathです。現段階はembedded source/BASE64 WASMに限定し、別worker URLや別.wasmの実行時取得は扱いません。検査器はliteralを抽出して再解析し、WASM headerと列挙module exact-setを照合します。loaderは列挙しても通常のAPI/通信検査から除外されません。動的なfactory入力がその固定literal由来であることは独立source reviewの責任で、runtimeReviewをreview payloadと全source/release hashへ束縛します。全dataflowの安全性をASTで証明したとは扱いません。clipboardPolicyはuser-gesture-write-onlyで、読取・rich write・自動コピー・execCommandは不可。宣言は許可範囲の上限であり、CSPや実行の安全を自己証明しません。汎用profile追加だけで本番CSPを広げません。同期maxComputeMsと長時間job deadlineは別物です。桁数だけで難易度や完了時間を保証しません。

同期ツールはloading→ready→result/invalidを扱い、stateはinstance内memoryだけ。unmount後にtimer/listener/状態を残さないこと。分解機はunprepared→loading→ready→running→cancelling→result/error/blocked→disposedをsessionが管理します。cancel/deadline/unmountではWorkerを退役させ、退役不明ならdocumentをquarantineして再実行を拒否します。複数instanceでも同documentの計算leaseは1件。BFCache復帰時も同scopeを使います。

readyは必要資産が初回asset graphに含まれ利用可能になった状態。再試行・取消後の再実行も追加通信せず動くこと。WASM上限はJS、転送、ブラウザRSSや空きRAMの上限ではありません。OSのタブ強制終了を防げると表示しません。

## 最小ツールを生成して検査する

siteの指定Node/npmを用い、生成先は存在しないdirectoryを指定します。軽量同期templateが既定で、非同期の最小実例は packages/site-validators/fixtures/bounded-browser-tool（試験専用）を参照します。LICENSE/NOTICEは利用を許可できる内容を準備してください。

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
4. 以下の共通導入コマンドで plan→apply→check。source/reviewと2clean buildの検証は省略しません。releaseIdはappend-only。旧配布物を書き換えず、package/lock/vendor/pin/import/registry/bindingを同じPRで確認。
5. 実distをhostに組み込み、入力境界・不正入力・結果・複数instance・unmount・通常移動、ready後のPage/Worker通信とoffline、非同期なら取消/deadline/Worker退役/有限予算を試験。検出器の自己試験も保持。
6. desktop/mobile表示、keyboard/focus、tap/contrast/長文、source/licenseリンク、build/CIを確認。合成試験と実ツール、emulationと実機、未測定条件を区別。
7. Draft PRへ結果・source/artifact identity・未実施を記載。merge/release/npm/deployは具体的な承認範囲を確認。

テンプレート生成試験は自動testに含みます。従来のsynthetic fixtureのupdate/rollback/CSP試験も維持。分解機の固有GUIとsessionはtoolkit側で検証します。全ツールの一括再実装は不要です。

## 成果物＋掲載先から導入する

共通入口は scripts/browser-tool-install.ts、実装は site-validators/browser-tool-installation.ts。runtimeで未知directoryを探索しません。review済みsource/artifact/releaseと掲載先JSONを渡し、planは読み取りだけ、applyはローカルcheckoutだけを書き換えます。

    npm run browser-tools:install -- plan --source /reviewed/source --artifact /reviewed/release --review /reviewed/review.json --release reviewed-v1 --placement /reviewed/placement.json
    npm run browser-tools:install -- apply --source /reviewed/source --artifact /reviewed/release --review /reviewed/review.json --release reviewed-v1 --placement /reviewed/placement.json
    npm run browser-tools:install -- check

placementは contentId（本人が割り当てたUUIDv4）、slug、title、description、category、tags、pubDate、hydration（load/idle/visible）、draft:true。未知分類・重複ID・既存page・既存の手動登録をsilent repair/overwriteしません。入力値を掲載情報へ入れません。

config/browser-tools/installations.json が新しい管理対象のpin＋掲載情報の単一源。review JSON原本は docs/acceptance/browser-tools/<toolId>/<releaseId>-source-review.json へ固定保存し、通常checkでpin.reviewSha256と照合します。commandが immutable vendorへ採用し、file dependency、npm所有lock、generated下の静的Astro wrapper/import、module/binding/component/pin/manifest登録、Tools MDXを作ります。React island API v1のまま、GUIはartifactのdefault componentを描画します。個別wrapperやregistryを書く必要はありません。通常buildのci:sourceは生成物のずれを拒否します。apply後、標準の npm ci --ignore-scripts で新しいfile dependencyのnode_modules実体を反映してから検証/buildします。review済み依存がcache済みなら --offline を使えます。これは共通build前処理であり、個別wrapper/registry/package編集は残りません。

npmは --package-lock-only --ignore-scripts --offline --no-audit --no-fund、60秒上限。sourceのbuilderや依存scriptを自動実行せず、remote取得を行いません。applyはnode_modulesを書き換えません。失敗時は掲載/登録/package/lockのpreimageへ戻し、append-onlyで採用済みになったartifactだけは未選択で保持します。同時applyはcheckout lockで拒否。信頼できる単一作業checkoutを用い、敵対processへのOS sandboxと誤認しません。

管理済みtoolの版更新は --replace-artifact <現在のartifact SHA-256> を指定し、新releaseIdと同じContentId/routeを使います。旧artifactは保持します。route変更はredirect設計が必要な別操作。既存手動prime v0.1.0は今回自動移行せず、従来登録を保持します。新規導入と管理済み版更新を省力化したもので、旧手動登録の自動移行機能はありません。

新規pageは必ずdraft。公開へ変えるには受入と、capabilityに適合するCSP・公開source提供を具体的にreviewし、生成器の公開gateを別PRで変更します。applyがmerge/release/deployを実行することはありません。

### 公開済みPrime 0.1.5の明示的な管理移行

通常の新規導入・更新は、既存手動登録と既存pageの衝突を引き続き拒否します。公開済みPrimeだけは、採用済みbaseline `34431d4891e2dd5c3a1634aff0a26dc28161f555` を指定した明示操作で生成管理へ移せます。新releaseの採用や一般的な公開許可ではありません。

    npm run browser-tools:install -- plan --migrate-manual-prime --from-head 34431d4891e2dd5c3a1634aff0a26dc28161f555
    npm run browser-tools:install -- apply --migrate-manual-prime --from-head 34431d4891e2dd5c3a1634aff0a26dc28161f555
    npm run browser-tools:install -- check

planは読み取り専用です。applyはbaselineを祖先に持つ独立site checkoutで、登録・生成物のpreimage、MDX、既存file依存/npm lock、review原本、exact公開admission、vendor hashを照合します。ContentId、route、metadata、本文、draft:false、visible hydration、0.1.5のpin/artifactは保持します。旧0.1.0/0.1.1/0.1.2のpin/vendor/証跡も残します。新しいsource/artifact/release等の引数は併用できず、builder・npm・ネットワークを実行しません。

選択中pinとplacementは installations.json、module/binding/component/manifestの登録はgenerated出力へ移します。既存React入口と4種のAstro wrapperは、asset名・font/readinessの接続を保つため、同じpath・同じbytesを生成管理で検査します。CSSはURL参照専用のStyles wrapperも同じpath/bytesで維持し、記事・他ツールへの漏出を防ぎます。GUI/core/CSSは固定vendorのままです。MDXは生成templateで置き換えず、baselineの全文hashとmetadataを照合します。通常の新規pageのdraft固定と、他のbounded版の公開拒否は維持します。移行済み公開Primeのrelease・本文更新は別のreview済み移行が必要です。

同一入力で全対象が移行後の期待値と一致すれば、plan/applyは `already-migrated` と変更ゼロを返します。既存編集・未知の生成物・重複ContentId/route・link・別installerのlockは拒否します。applyは共有checkout lockを取り、同じdirectoryの一時fileへ書込み・flush後、preimageを再確認してrenameします。途中のI/O失敗では既知の移行前状態へ戻します。復元も同じ置換方式で、未知の編集を上書きしません。disk故障が続く場合や未知状態は成功とせず停止します。

ローカルの明示復元は次です。既知の移行前/後が混ざった途中状態にも使えますが、対象に追加編集があれば停止します。停止processが残した共有lockは自動削除せず、実行主体の終了と残存fileを確認してから扱います。

    npm run browser-tools:install -- rollback-manual-prime --from-head 34431d4891e2dd5c3a1634aff0a26dc28161f555

これはcheckout内の登録復元であり本番rollbackではありません。commit後の変更取り消しは通常のreview済みGit revertで行います。merge/deploy、CSP、監視、権限、記事公開状態はこの操作で変更しません。

### 管理移行後の公開Prime固定版更新

既存ページの本文・ContentId・route・掲載状態を維持する版更新だけに使う。通常の新規toolのdraft固定を変更しない。

    npm run browser-tools:install -- plan --update-published-prime --source <clean-source> --artifact <formal-release> --review <exact-review.json> --release <new-release-id> --replace-artifact <selected-artifact-sha256>

`apply` は同じ引数で実行する。現在のartifact、公開admission、review、生成物と依存を照合し、履歴と衝突しないimmutable releaseへ追加する。掲載情報の指定・旧manual移行との併用は拒否する。npmのlock生成は隔離directoryでoffline・scripts無効にして行い、checkoutの更新と復元は既知preimage/postimageだけに限定する。途中の未知編集は保全して停止する。旧vendor/pin/review/licenseは残す。続けて固定lockから `npm ci --ignore-scripts`、関係試験・Site build・実dist受入を行う。merge、deploy、本文更新はこの操作の対象外。

## SEOと結果の共通表示

siteのContentLayout/BaseLayoutがtitle、description、canonical、OG、WebPage構造化情報とh1を提供します。pluginはdocument head、URL/historyを変更しません。個別入力・結果をroute/query/metadataへ流しません。生成pageも同じ既存Tools経路を通ります。

pluginは実経過と設定予算を分け、短時間はms/小数秒で表示します。完了の重複を避け、因子別の確度をdetailsへまとめてもprobable/未分解/取消の要約は残します。コピーはクリック時だけ状態付き文字列を渡し、非対応/拒否なら手動選択へ。サンプルは意味・難易度を示し、選択だけで計算しません。

## 2026-10-22 prime 0.1.1の個別公開admission

既存 /tools/prime-factorizer/ は手動登録を維持し、config/browser-tools/prime-public-admission.json のexact pinだけを共通bounded-browser-v2の公開対象とします。対応するreview原本のruntimeReview・source/manifest/artifact/reproducibility/hashを照合します。新規profileの全体公開やCSP拡張ではなく、他のbounded版は引き続きdraftです。旧0.1.0のvendor/pin/ライセンス補遺は保持し、新0.1.1のmusl原文は配布物と公開license pathへ直接同梱します。

2026-10-23の固定版更新では、同じ個別admissionの選択を正式0.1.2へ進めます。0.1.0/0.1.1の履歴を保持し、登録方式・route/ContentId・CSPは不変です。[0.1.2採用記録](../acceptance/browser-tools/prime-factorizer-v0.1.2-adoption.md)にsource/release identity、再利用した証拠、未検証範囲を固定します。

## 2026-10-25 限定候補: 明示する表示・仕様情報の境界

opt-inのtool rootは`data-bt`を付ける。Siteの`.prose`子孫規則はrootと内部を除外する。Tailwind/reset全体のsandboxではなく、toolはscoped CSSで基本の文字組み・段落・リスト・フォームを所有する。hostは既存色tokenと`browserToolTypographyProperties`の書体・body/help/heading/summary size・行高・summary weight・最小操作高だけを渡す。操作高44px、入力16pxの下限はtool側で守る。全レイアウトや数学的制限の任意設定APIではない。

manifestは任意の`uiCapabilities` v1を持てる。整数分解の入力表記上限、モード別の数値範囲・設定時間上限、完了を保証しないことをtool sourceからbuilderが出力する。Siteは選択したmanifestのpin/hash、tool identity、runtime envelopeを検証した`describeBrowserToolRelease`からのみ表示する。文字数とbyte数を同一視せず、UTF-8の保守的なbyte envelopeと個別時間の上限を検査する。旧manifestはそのまま有効で、情報が無い場合はnullとして数値を推定しない。rollbackは選択した旧manifestだけを参照する。説明のために別の最新sourceや別versionの値を混ぜない。

この変更は配布契約への後方互換な追加だけで、既存v0.1.2のvendor・pin・公開物は不変。限定プレビューの未公開候補は正式採用情報と分けて明示する。
