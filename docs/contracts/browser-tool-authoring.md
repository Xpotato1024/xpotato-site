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

同期templateも同じ書体契約を使う。唯一の準備helperは`templates/browser-tool-sync/src/ui/prepare-fonts.mjs`で、許可するexact bytesのSHAは`browserToolFixedFontPreparerSha256`。helper自身が同directoryの`font-text.mjs`をimportし、外部からtextを受け取らない。text moduleは唯一の`export const fontText=Object.freeze({...})`で、重複のないliteral文字列・合計4096文字以下だけを許す。通常UI/coreもこの辞書を使い二重のラベル正本を作らない。準備callはalias/re-exportなしの1か所・初期useEffect・elementとcallbackの2引数だけ。5秒失敗・unmount後の新規load/完了通知抑止・再試行を持つ。このhelper以外の同期moduleにはdocument/timer禁止を維持し、helper改変・入力引数・追加呼出し・再hashしただけの追加APIを拒否する。helper変更時はpolicy・負例・実distを再reviewする。tool IDやPrimeによる分岐ではない。

Workerを所有するtoolはReact unmountだけでなく、通常遷移のpagehideでも計算を中止してWorker/Blobを解放する。bfcacheから戻っても実行中表示だけが残らず、再実行できる状態を保つ。実dist受入れは動作中のページ移動とWorker target消失も確認する。

標準font helperは、上記の固定辞書に加えて、所有Demoの`data-bt-font-text`に明示された固定公開ラベルだけを準備する。合計上限は4096文字のまま。本文や入力欄を走査せず、配布情報の開閉もready後の追加font通信を起こさないことを実画面で検査する。

現在の標準入口です。機械的な正本は [browser-tool.ts](../../packages/content-contracts/src/browser-tool.ts)、取り込み検査は [browser-tool-adoption.ts](../../packages/site-validators/src/browser-tools/browser-tool-adoption.ts) です。テンプレートと [作成Skill](../../.agents/skills/create-browser-tool/SKILL.md) は同じ生成・検査コマンドを使います。生成済みsnapshotや説明から権限を増やせません。

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

専用Toolページでは、activeなprimary bindingの採用版表示をページが所有し、GUIと本文の補足説明を出した後に一度だけ配置します。DOM順と表示順を一致させ、CSSで順序だけを入れ替えません。inline demoは埋込み箇所で採用版を表示します。Primeの入力モード・数値範囲・実行条件はtoolkit GUIで説明し、ライセンス欄へ同じ一覧を重ねません。配布物のbyte上限は入力桁数と区別し、対応ソース・ライセンス全文・再ビルド・サイト組込みソース・追加licenseのリンクを保持します。manifestの固定identityは表示を短くしても検査します。toolkitの新GUIや進捗表示は正本の正式releaseを別途検証・採用し、Site vendorを直接編集しません。

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

共通入口は tools/authoring/browser-tool-install.ts、transaction実装は tools/authoring/browser-tool-installation.ts、読取りcheckerは packages/site-validators/src/browser-tools/browser-tool-installation.ts。runtimeで未知directoryを探索しません。review済みsource/artifact/releaseと掲載先JSONを渡し、planは読み取りだけ、applyはローカルcheckoutだけを書き換えます。

    npm run browser-tools:install -- plan --source /reviewed/source --artifact /reviewed/release --review /reviewed/review.json --release reviewed-v1 --placement /reviewed/placement.json
    npm run browser-tools:install -- apply --source /reviewed/source --artifact /reviewed/release --review /reviewed/review.json --release reviewed-v1 --placement /reviewed/placement.json
    npm run browser-tools:install -- check

placementは contentId（本人が割り当てたUUIDv4）、slug、title、description、category、tags、pubDate、hydration（load/idle/visible）、draft:true。未知分類・重複ID・既存page・既存の手動登録をsilent repair/overwriteしません。入力値を掲載情報へ入れません。

config/browser-tools/installations.json は管理対象のpinとintegration identity/policyの正本。掲載本文・metadataはMDXだけが正本。review JSON原本は docs/acceptance/browser-tools/<toolId>/<releaseId>-source-review.json へ固定保存し、通常checkでpin.reviewSha256と照合します。commandが immutable vendorへ採用し、file dependency、npm所有lock、静的Astro wrapper（components/interactive-renderers）とgeneratedのimport、module/binding/component/pin/manifest登録、Tools MDXを作ります。React island API v1のまま、GUIはartifactのdefault componentを描画します。個別wrapperやregistryを書く必要はありません。通常buildのci:sourceは生成物のずれを拒否します。apply後、標準の npm ci --ignore-scripts で新しいfile dependencyのnode_modules実体を反映してから検証/buildします。review済み依存がcache済みなら --offline を使えます。これは共通build前処理であり、個別wrapper/registry/package編集は残りません。

npmは --package-lock-only --ignore-scripts --offline --no-audit --no-fund、60秒上限。sourceのbuilderや依存scriptを自動実行せず、remote取得を行いません。applyはnode_modulesを書き換えません。失敗時は掲載/登録/package/lockのpreimageへ戻し、append-onlyで採用済みになったartifactだけは未選択で保持します。同時applyはcheckout lockで拒否。信頼できる単一作業checkoutを用い、敵対processへのOS sandboxと誤認しません。

管理済みtoolは掲載状態やruntime種別に関わらず同じinstallerで更新します。toolId別の操作flagはありません。

    npm run browser-tools:install -- plan --source <clean-source> --artifact <fixed-artifact> --review <review.json> --release <new-release-id> --replace-artifact <selected-artifact-sha256>

新規だけ `--placement <placement.json>` を指定します。新規MDXは必ずdraftです。以後の本文・SEO・分類・日付の正本はそのMDXであり、release更新で再生成しません。登録JSONはContentId、slug、hydrationとhostの表示・法的提供policyだけを持ち、紹介文を重複管理しません。更新はContentId/route/掲載状態を維持し、配置指定を拒否します。

公開するpinは `config/browser-tools/public-admissions.json` にsource/release reviewと一致するexact pinを登録します。公開済み版の更新では `--admission <new-exact-pin.json>` が必要です。sync/Worker/WASMすべて同じ検査を通り、bounded版には独立runtimeReviewと固定Worker/WASM/予算の検査を追加します。admissionはmanifestにない能力やCSPを許可しません。本文の公開変更、merge、deployは別の明示承認です。

新規AGPL組込みは `--display <policy.json>` でsite対応ソースofferの実pathを指定し、実体を検査します。追加ライセンス表示はartifactの宣言済み原文だけを共通生成器でpublicへ投影します。toolが能力説明を所有する場合も同policyで指定し、特定tool名で分岐しません。ライセンス条件を理由に非AGPLへ架空offerを作りません。

planは読取りのみ。applyは固定artifactを採用し、全tool共通のwrapper/registry/依存/lockを更新します。CSSはURL参照で、そのtoolのrouteだけが読み込みます。npm lockは隔離directoryでoffline・scripts無効に生成し、全preimageを再照合して置換します。I/O失敗は既知postimageだけを復元し、未知の編集は上書きせず停止します。重複ID/route、未知生成物、immutable review/artifactの再利用衝突、symlink、別installerのlockは拒否します。旧pin/reviewとGitに固定したartifactは復旧用に保持し、実復元後のselectも検証します。通常のGit revert/PRで選択を戻し、本番rollbackを暗黙実行しません。

旧manual Prime移行の実装・閉じた本文hash whitelistは現役経路から撤去しました。必要な歴史の再現は固定Git revisionで当時の実装を利用します。旧runtime profileやcomposed Worker例外はexactな歴史artifactの検証・復旧に限定され、新candidateでは選択できません。現在のPrimeも汎用bounded版と同じ入口です。

## SEOと結果の共通表示

siteのContentLayout/BaseLayoutがtitle、description、canonical、OG、WebPage構造化情報とh1を提供します。pluginはdocument head、URL/historyを変更しません。個別入力・結果をroute/query/metadataへ流しません。生成pageも同じ既存Tools経路を通ります。

pluginは実経過と設定予算を分け、短時間はms/小数秒で表示します。完了の重複を避け、因子別の確度をdetailsへまとめてもprobable/未分解/取消の要約は残します。コピーはクリック時だけ状態付き文字列を渡し、非対応/拒否なら手動選択へ。サンプルは意味・難易度を示し、選択だけで計算しません。

## 2026-10-25 限定候補: 明示する表示・仕様情報の境界

opt-inのtool rootは`data-bt`を付ける。Siteの`.prose`子孫規則はrootと内部を除外する。Tailwind/reset全体のsandboxではなく、toolはscoped CSSで基本の文字組み・段落・リスト・フォームを所有する。hostは既存色tokenと`browserToolTypographyProperties`の書体・body/help/heading/summary size・行高・summary weight・最小操作高だけを渡す。操作高44px、入力16pxの下限はtool側で守る。全レイアウトや数学的制限の任意設定APIではない。

manifestは任意の`uiCapabilities` v1を持てる。整数分解の入力表記上限、モード別の数値範囲・設定時間上限、完了を保証しないことをtool sourceからbuilderが出力する。Siteは選択したmanifestのpin/hash、tool identity、runtime envelopeを検証した`describeBrowserToolRelease`からのみ表示する。文字数とbyte数を同一視せず、UTF-8の保守的なbyte envelopeと個別時間の上限を検査する。旧manifestはそのまま有効で、情報が無い場合はnullとして数値を推定しない。rollbackは選択した旧manifestだけを参照する。説明のために別の最新sourceや別versionの値を混ぜない。

この変更は配布契約への後方互換な追加だけで、既存v0.1.2のvendor・pin・公開物は不変。限定プレビューの未公開候補は正式採用情報と分けて明示する。
