---
status: canonical
owner: operations
last_verified: 2026-11-09
canonical_for:
  - CI latency measurement and optimization boundaries
---

# CI時間の測定

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
