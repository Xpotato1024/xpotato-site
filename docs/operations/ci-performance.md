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
