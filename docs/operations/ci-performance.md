---
status: canonical
owner: operations
last_verified: 2026-11-21
canonical_for:
  - CI latency measurement and optimization boundaries
---

# CI時間の測定

## 2026-11-21: 記事更新で待つ実時間の短縮

最適化の主指標は、PR更新から必要な結果が揃うまでのwall timeです。各jobの延べrunner時間が増えても、この待ち時間が短くなる変更を優先します。並列処理の個別durationを合計した値は、利用者の待ち時間として報告しません。

記事編集には二つの待ち経路があります。CMSの正式レイアウト確認は `Editor Astro layout preview` の成功したexact commitのartifactを取得し、`vNext CI`の完了を待ちません。公開前のPR検証では、通常CIの全必須jobを待ちます。端末内の即時プレビューはどちらのworkflowにも依存しません。

| 経路 | 改善前の観測 | 主な直列区間 |
| --- | ---: | --- |
| 通常CI [44762048942](https://github.com/Xpotato1024/xpotato-site/actions/runs/44762048942)、source `4db61c8cad4fb0b29f5fb8a4161781c11d81e118` | 11分11秒 | producer604秒。build155秒、WebKit依存導入98秒・実検査37秒、フォント準備17秒、public final218秒 |
| 正式プレビュー [44689953019](https://github.com/Xpotato1024/xpotato-site/actions/runs/44689953019) | 62秒 | scope28秒とreview28秒。両jobでそれぞれ16秒・13秒のnpm ci |

通常CIはproducerの二段階を並列化します。`ci:producer:prepare` は、既存の隔離fixture生成・一回の公開buildと、WebKit導入・その後のChromeフォント準備を同時に開始し、両方の終了を待ちます。次のworkflow stepの `ci:producer:validate` で、同じdistを使うWebKit実検査と従来のpublic final検査を同時に開始します。準備と検査を別stepにすることで、成功したフォント準備の `GITHUB_ENV` が後続Chromeへ渡ります。

必要な検査、同run/attemptのgate、packageの順序は維持します。一方の失敗でも他方の終了・cleanupを待ち、片方だけの成功ではpackageへ進みません。隔離fixtureはprivate rootのlockを共有するため、build側の内部順序を保ちます。WebKitとChromeのreport名・profile・serverは分離されています。中間distの転送や再buildは追加しません。

この変更は、直列だったWebKit導入・フォント準備・WebKit検査を、既存のbuild・public finalと重ねるものです。共有CPUによる各処理の変動を含むため、変更前の98秒・17秒・37秒をそのまま短縮実績とはしません。laneごとの開始・完了・elapsedMsと、CI全体のwall timeを最終PRに記録します。

正式プレビューのscopeはNode標準APIだけでexact base/head・変更path・最大8記事を選択し、npm依存導入をreview jobへ集約します。ContentId・MDX・review contextの検証と正規Astro描画が成功したCLIだけがartifact名を出力します。最大4記事の並列実行、全review成功、exact commit/ContentIdの取得条件は維持します。workflow/helper変更だけならscopeの空matrixをHostedで確認し、通常CIの実Astro review回帰も通します。この空matrixの時間を、記事を実際に描画したプレビュー時間と比較しません。

記事本文やregistryの変更を理由に既存検査を省略する変更は含みません。変更範囲による省略は引き続き[観測段階](ci-change-impact.md)です。

## 2026-11-20: runner固定とWebKit binaryの再利用

`ubuntu-latest`の実行環境が26.04へ移ったため、Linux 7jobを`ubuntu-24.04`へ固定します。WebKit binaryはOS・architecture・Playwrightの固定版をkeyに保存し、実WebKit検査の成功後だけ更新します。cache hitでもOS依存導入と全検査を実行します。任意のcache saveだけは非blockingです。

変更前mainの[run 44741654561](https://github.com/Xpotato1024/xpotato-site/actions/runs/44741654561)では、最初の`carousel-desktop`と次の`carousel-mobile`が20秒のChrome起動期限に達しました。前のsuiteのCDP-readyまで次を起動しないため、最初の失敗を8本の同時起動によるものとは判断できません。Chromeは生存し、最初のstderrは空でした。起動期限・操作assertion・実行数は維持し、自動retryは追加しません。

Ubuntu 24.04の初回[run 44752479609](https://github.com/Xpotato1024/xpotato-site/actions/runs/44752479609)、source `4905f444e124f54e3bc31f3add328059a900892c`は8jobが成功しました。公開画像とWebKitのcacheはともにmissです。全体9分06秒、producer444秒、WebKit依存導入とdownload54秒、実WebKit検査32秒でした。WebKit本体のdownloadはログ上約3秒であり、cacheだけで依存導入54秒をすべて除けるとは扱いません。

このrunでも最初のChromeは13.002秒、独立common-tool jobのChromeは10.006秒かかっています。runner固定だけで初回起動遅延の根因を解消したとは断定しません。warm測定はcacheのexact hit、依存導入、全公開suiteとWindows consumerの成功を確認し、exact source/runと時間をPRへ追記します。単発のcold/warm差には公開画像cacheと共有runnerの変動も含まれ、WebKit cache単独の短縮率や安定性の保証とは区別します。

### 初回Chromeのフォント準備

WebKit cacheがhitした[run 44756247723](https://github.com/Xpotato1024/xpotato-site/actions/runs/44756247723)は8job成功・全体8分13秒でしたが、その後の[run 44757637650](https://github.com/Xpotato1024/xpotato-site/actions/runs/44757637650)、source `c0997dc54a7c536675c5bd92126389cd99d77148`では、独立した`source-validation`内のMermaid描画用Chromeが25秒の起動期限に達しました。Ubuntu固定だけで初回起動の不安定を解消したとは扱いません。この失敗runは性能改善の成功値へ含めません。

[WPTの同時期の修正](https://chromium.googlesource.com/external/github.com/web-platform-tests/wpt/+/653efdcc8a57730af0efe739d599b4062e1525f7)は、Chrome同梱fontconfigとOSのcache形式が異なる場合に初回の全フォント走査でタイムアウトする問題を、Chromeによる事前生成で対処しています。これは今回の初回だけ遅い観測と整合する機序ですが、当該runnerの根因を直接証明したものではありません。

同じinstalled Chromeの一度限りの準備処理を、実検査の前へ追加します。準備だけに120秒の上限を設け、失敗を検査成功へ変換せず、通常の20/25秒の起動期限は維持します。XDGを分離するprofileには、同じjob内で生成したfontconfig cacheだけをコピーします。各profileの所有権、sandbox、操作assertion、公開build回数は変えません。準備時間・cache数・実検査の起動時間と全体wall timeを別々に測定し、準備時間を除外した見かけの短縮率は使いません。

## 測定した現状

変更前の基準mainは`e862538b8cae2249fba7c8fe98a043d7f96b67f5`。以下はGitHub Actions APIのrun/job/step時刻とproducerログによる実測です。完了runのwall timeを作成から最終更新まで、job queueをjob作成から開始までとしました。未完了runのupdated_atを実行時間として扱いません。

| 対象 | 実測wall time | release:produce step | Windows consumer | 主なqueue |
| --- | ---: | ---: | ---: | ---: |
| [PR166最終](https://github.com/Xpotato1024/xpotato-site/actions/runs/42584973975) | 14分18秒 | 12分26秒 | 25秒 | 各job 2〜3秒 |
| [main push](https://github.com/Xpotato1024/xpotato-site/actions/runs/42590081012) | 15分32秒 | 13分37秒 | 20秒 | 各job 3〜7秒 |
| [PR167文書変更](https://github.com/Xpotato1024/xpotato-site/actions/runs/42599805164) | 16分05秒 | 14分18秒 | 24秒 | 各job 2〜3秒 |
| [PR168失敗run](https://github.com/Xpotato1024/xpotato-site/actions/runs/42601315341) | 15分36秒 | 11分42秒、失敗 | 未実行 | producer 2分59秒 |
| [手動production配備](https://github.com/Xpotato1024/xpotato-site/actions/runs/42592439951) | 3分56秒 | buildなし | 別のproduction job 3分21秒 | 33秒 |

取得した直近100workflow run中、完了・成功したvNext CI 12本は10分26秒〜16分05秒、中央値13分47秒でした。PR 8本/main 4本の異なるrevisionを含み、同一sourceの性能比較や長期p95ではありません。

mainのproducerログによる内訳（npm command境界の概算）:

- `ci:source`: 6分32秒。単体test約95秒、型検査約31秒、visual fixture約35秒、publication fixture約177秒を含む。
- 通常の`build`: 約50秒。公開distは1回生成。
- `ci:final`: 6分14秒。browser全体337秒、PWA約13秒を含む。
- browserは既にcarousel245秒とremaining337秒の2本が並行。remaining内の共通Tool検査が約114秒で、private実site fixtureのbuildと操作を含む。
- npm ciは20秒、Lighthouseは23秒。ここだけの最適化で数分は短縮できない。

## 実行順と再利用の境界

feature branchのpush自体ではvNext CIを起動しません。開いたPRのhead更新に伴うpull_request runが起動し、merge後に別のmain push runが起動します。他の検査workflowは並行実行されるため、それぞれのdurationを足して待ち時間としません。

PR166の14分18秒と、その後のmainの15分32秒は合計29分50秒です。人のreview/merge待ちや配備待ちは別です。PR artifactはCandidate、main pushの成功runだけがProduction適格となる現契約を維持します。同じGit treeでも公開footerがsource SHA/commit時刻を使用し、release metadataもrun/event/sourceを固定するため、PRのpackageをmain用に付け替えません。

`result`と`offline-policy`がmainのrequired checksであることをbranch metadataで確認しました。今回の短縮は名前や保護設定を変えず、全gateが完了する条件を維持します。CIはread-only権限のまま、production workflowはowner/main/manual/EnvironmentとProduction artifactのguardを保持します。

## 今回の短縮策

1. 共通Toolを3本目のbrowser suiteへ分離。元のassertion、private worktree、通信禁止、worker終了、viewport、Service Worker設定、例外検査を維持する。
2. source preflight/全単体test後の、型・repository・Astro検査とprivate fixture準備を並行化する。fixture chainと公開build前の完了barrierを維持する。
3. 同じPRの古いheadのrunだけを中断し、不要な計算とqueue競合を減らす。main runは中断しない。
4. 既存npm download cacheをprefer-offlineで使用する。node_modules、test成功、private fixture、dist、release artifactのrevisionをまたぐ再利用はしない。
5. vendor全体の説明READMEのみをprose allowlistへ追加する。PR167の5 Markdownファイルは分類回帰でNOT_APPLICABLEになる。個々のvendor README/実bytes、registry、lock、unknown inputはcoreを実行する。

変更前の各suite時間から算出すると、browserのcritical pathは337秒から約245秒へ、他2例では約110〜137秒の短縮余地があります。source laneは約40〜50秒の重なりが見込まれます。合計約2〜3分の短縮余地は**予測**であり、CPU競合・queue・runner差を含む変更後の実測結果ではありません。vendor READMEだけの変更はfull buildを省けますが、classifier/graph/resultは実行します。

## 変更後の受入れ

- 同じHosted OS/toolchain/lockで全gate成功を確認し、source laneログとbrowser timing artifactの実測値を比較する。cold/warm download cacheとqueueを分け、変更したsourceの差も記録する。
- test失敗、child起動失敗、片方だけ成功、欠損/古い/別suite report、private build数の相違は失敗すること。失敗時も他laneのcleanupを待つこと。
- 公開build=1、packageで再buildなし、Windowsで再buildなし、private fixture漏洩なし、exact source/footer/headers/registry/searchの整合を維持すること。
- PR CandidateをProductionとして取得しないこと。手動配備・provider操作・required check設定変更はこの性能検証に含めない。
- 速度を理由にassertion/timeout/品質閾値、独立review、人の承認、publication holdを緩めない。失敗の自動無視・cache-hitによるPASS扱いもしない。

Lighthouseは非blocking判定でもproducer jobの完了まで実行時間を占めます。現実測は23秒で、別job化はjob開始/installの費用が上回り得ます。8分のtimeout上限を常時8分消費と解釈せず、必要になれば同じdistを使う分離案を再計測します。publication fixtureの連続更新は前段結果を次段が利用するため、依存を無視した並行化はしません。


## 第二段階: 独立jobと実時間シナリオの分割

第一段階のHosted実測は [run 42606925127](https://github.com/Xpotato1024/xpotato-site/actions/runs/42606925127)、head `99ec31d6103a76511e874d2fb563132aed691d49` で13分37秒。変更前mainの15分32秒に対し115秒短縮でした。source361秒、公開build約50秒、browser260秒。各1回の比較であり中央値や保証ではありません。

第二段階はsource tests、完全publication lifecycle、共通Tool private browserを別checkoutで同時実行し、producer側に実際の隔離fixture生成・公開build・公開browserを残します。別jobで同じ検査を完遂し、release package前の同run/attemptの明示barrierで統合します。独立job側のHEAD変更やworktree作成はproducerへ干渉しません。

- 原理上の待ち時間は直列 `source + build + final` から `max(source tests, publication lifecycle, common Tool, producer isolation + build + public final)` へ変わります。
- publicationの5更新を公開build前のcritical pathから外します。初回private候補と保存/export/cleanupは本物を維持し、隔離を単なる架空canaryに置き換えません。完全5更新は同runの必須jobで残します。
- carouselはdesktop/mobileを分けます。実時間のautoplay・pause/resume検査を早送り・短縮しません。
- 事前の概算は6〜8分台ですがrunner待ち・競合・remaining browser次第です。Hosted変更後値はexact headのrun完了後にPR本文へ追記し、予測を実測と混ぜません。
- latencyのため別runnerを増やすので、合計runner時間は同じ比率で減りません。初回publication fixtureの一部重複とinstall約3回分が増えます。実測では経過時間とjob総秒数を別に報告します。

### 再利用とcacheの限界

unit suiteは既にVitestの標準並行実行です。独立job化後にcritical pathでなければ、さらにshardを増やしてinstall/job待ちを払う意味は小さくなります。

npm download cacheは利用しますが、広範なAstro `.astro` cacheの復元や別revisionのtest PASSは導入しません。Astroのcontent cacheはintegration/Markdown処理変更の全依存を同じkeyで表せず、private候補は別root/cache/collectionなので、そのまま共有できません。現在の公開buildでもcontent storeだけでVite/MDX bundleやmedia integrationが省略されるわけではありません。

source test再利用には対象propertyに影響するsource、validator、toolchain/lock、fixture、実行環境、Git source identityと前回成功の信頼性が一致する必要があります。PR artifactはmain artifactへ昇格させず、footerのcommit SHA/dateを含む公開bytesはmain sourceでbuildします。依存を証明できない成功cacheやchanged-fileだけによるskipは行いません。許可済みprose-onlyのNOT_APPLICABLEは別扱いです。

### 受入れ・失敗注入

- 全既存source gateと5更新、全browser assertionの実行をgraph regressionで照合。
- APIの違うrepo/source/workflow/attempt、未完了・失敗・取消・重複/欠損job、HTTP/JSON/timeoutはpackage前に停止。
- browserの欠損/古い/別suite report・exit失敗・余分なprivate buildを拒否。public-only reportは全suite PASSと名乗らない。
- 公開build1回、Windows0回、全1272 unitとrelease回帰、real fixture隔離とstaged public checksをHosted同headで確認。
- PRとmain、権限、required `result` / `offline-policy`、manual deploy境界は維持。Ready化・merge・deployは別操作。


## 第二段階の実測と最終の限定改善

[run 42610958226](https://github.com/Xpotato1024/xpotato-site/actions/runs/42610958226)、head `03ea952a31c3a8576c86c60df749c0bf2befaac0` は全5workflowが成功し、vNext全体 **8分58秒** でした。元main15分32秒から394秒、約42.3%短縮して、本人指定の5〜10分へ到達しています。

vNext job合計は905秒（scope14 / source131 / publication127 / common Tool125 / producer483 / Windows22 / result3）。元main914秒とほぼ同じ、第1段階803秒からは102秒増です。待ち時間を優先し、job総時間は参考・容量管理に用います。これは課金額ではありません。公開repositoryの標準GitHub-hosted runnerの無料条件とlarger runner等の課金条件を混同しません。

公開browserはdesktop133秒/mobile125秒へ分かれましたが、remaining247秒が支配的でした。そのため最後の限定改善では、既存のprivate preview・2種browser Tool・cold Prime案内/表示/計算/axeをtools suiteへ移し、remainingの公開UI操作と並行化します。元のassertionと待機期限をそのまま残し、継承していたviewport、motion、online、Service Worker状態を各独立Chromeに明示します。

さらに公開派生画像23個（candidate metadata込み約4.17 MiB）だけをexact-key cacheへ保存します。元画像やcanonical masterは保存せず、既存validatorで毎回全bytes/recipe/profile/toolchainを検証します。localのcold生成hook約30秒に対し既存cache readerは起動込み0.44〜0.92秒でしたが、Hostedのrestore時間・cold/warm実測とは別です。公開build全50秒を短縮できるとは扱いません。

coldは画像生成を含む通常run、warmは同じinput keyの復元runとして別記し、queueも分離します。main integrationは別sourceで新しいProduction artifactを作り、PR Candidateを昇格させません。test成功のcacheは使わず、cold/warmとも全検査・公開build1回を維持します。今後の最終head測定はPR本文でexact run/attemptへ紐付けます。


### warm試験で見つかった起動信頼性

最終分割のcold [attempt 1](https://github.com/Xpotato1024/xpotato-site/actions/runs/42612978648/attempts/1) は7分25秒で成功しました。同headのwarm [attempt 2](https://github.com/Xpotato1024/xpotato-site/actions/runs/42612978648/attempts/2) は画像cacheのexact hitと公開build約9秒（cold約50秒）まで成功しましたが、4 Chromeが同時に20秒のport-file待機で停止しました。stderr空・process aliveで、共有path競合などの根因は断定していません。操作assertionへ到達せずpackageも作っていないため、warm全体成功とは扱いません。

これに対し、独立XDG領域とCDP-readyまでの起動順制御を追加します。起動後の4本並行操作、Chromeの20秒期限、全assertionは維持し、成功するまでの盲目的retryは導入しません。合成IPC検査・異常終了cleanup・独立レビューの後、変更headのHosted warm runで受入れを確認します。cold旧headと修正後warm headの違いを記録し、単一の同条件benchmarkと混同しません。


## 2026-11-14: 製品試験をリリース元へ戻す

変更前 [PR209 run 43570076019](https://github.com/Xpotato1024/xpotato-site/actions/runs/43570076019) は開始から完了まで702秒（11分42秒）、producer628秒でした。[main run 43566801265](https://github.com/Xpotato1024/xpotato-site/actions/runs/43566801265) は613秒（10分13秒）、producer563秒。合計runner秒数ではありません。

PR209のpublic browserは308.581秒で、remaining204.908秒の終了後にtools101.788秒が続いていました。mainでも294.363秒（remaining208.188秒、tools84.083秒）。Primeの製品deadline検査を同じrunnerの他のbrowserから隔離するための直列待ちでした。

同じアプリsourceの直近main [run 43571208352](https://github.com/Xpotato1024/xpotato-site/actions/runs/43571208352) は669秒（11分09秒）、producer615秒でした。

現行pinはPrime v0.2.6、source `1ecb32327b8b20cb637cdc3f9080c04adf3a5bff`、artifact `5681d64c745747fd70b8eca748ca37e35b892a1d3ae1aa0cb2f588733e2629b4` です。[公開Release](https://github.com/Xpotato1024/browser-prime-toolkit/releases/tag/v0.2.6)と[exact source CI](https://github.com/Xpotato1024/browser-prime-toolkit/actions/runs/42797970871)を照合しました。15 job成功、test jobの955 test成功・失敗0。unsafe integer/scientific notation/invalid/1024-bit、確定・未証明・不明の表示/copy、real ECM serialization、有限資源・Worker lifecycle・browser通信/中止、native/WASM検証を含みます。全ての歴史的acceptance scriptが自動実行されるという意味ではありません。上流Releaseは自動publisher gateによる強制保証ではありません。今回新規に確認したのはRelease APIのtarget source・公開時刻・asset metadataとexact-source CI/logです。Release ZIPを新たにdownloadして再照合したとは主張せず、配布bytesのidentityは既存のsource/release reviewと選択pin/全file hash検査を再利用します。

Siteはこの保証と既存のexact source/release admissionを利用し、製品matrixを通常CIから外します。`prime-site-smoke` はホスト接続だけ、Worker payload bytesは全登録tool共通の静的検査に移します。製品deadlineを観測しなくなるため、toolsは他のhost suiteと並行実行できます。Site PWAとbuild-once/package/Windowsの条件は不変です。

変更後の測定はPRにexact head/runとともに記録します。OS/toolchainは揃えますが共有runner、queue、cache、source差がある単発比較で、同じ物理machineのbenchmarkや固定の速度保証とは呼びません。

初回候補 `c76f9ff` のrun43572734594はsource/publication/commonと公開UI3suiteが成功しましたが、新smokeでWorker constructor直後のtarget一覧を一度だけ評価して失敗しました。生成とCDP観測の準備を同時とみなさず、起動時停止なしのattach/detach通知を待つよう修正します。失敗runの経過時間を成功した短縮実測として扱いません。

## 2026-11-14: 件数増加に備えた変更範囲の観測

[変更範囲に応じたCIの準備](ci-change-impact.md)で、記事更新の影響領域をshadow reportへ記録します。全既存検査は継続し、未知・共有・registry・tool変更はfull扱いです。今回の追加による時間短縮はまだありません。依存の対応と失敗注入を確認してから、別変更でPR限定の選択実行を検討します。

### 支配的なpublic UI suiteの分割

PR211で全検査とshadow artifactの実行を確認した後、`remaining` から連続したhome/navigation/copy操作を `home-navigation` へ分離します。design-role/article/search/footer/contact/tagは `remaining` に残します。移したassertion・viewport・待機期限は維持し、新profileの入口では旧search終了時のdesktop/network/motion/Service Worker状態を明示します。公開Chromeは5suite、Common Toolを含むlocal全体は6suiteとなります。ready通知による起動順制御と、全child終了・全fresh reportを要求する集約は維持します。

まだskipは行いません。mainもPRも同じ全検査と一回の公開buildを使います。追加Chromeの資源競合があるため、単純に旧時間を二分して短縮率を主張せず、exact Hosted runのwall time・各suite時間で確認します。
