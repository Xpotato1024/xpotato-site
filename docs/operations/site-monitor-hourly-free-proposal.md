---
status: proposed
owner: operations
last_verified: 2026-10-12
---

# 毎時Workers観測と外部未着通知の無料運用候補

現在の監視停止・未解決incidentを保持し、Workersの毎時観測とHealthchecks.ioの未着検知へ簡素化する設計候補。実装・稼働・無料枠適合・メール到達は未検証。採用判断は[ADR-0047](../design/adr/0047-hourly-free-observation-proposal.md)、この文書は運用契約候補であり既存gateの実行認可ではない。

## 範囲と最小構成

- Siteとは別の監視専用WorkerをFreeのCronで毎時起動する候補。HTTP公開route・workers.dev公開・新serverは不要。UTCの毎時指定でよく、正確なnominal H、端末CLI hook、600秒連続coverageを要求しない。
- 1回で公開応答/期待bodyと必要なdeployment・version・設定・domain・route・preview非公開を点検し、最後にHealthchecksの**一つのcheck**へ正常pingまたはfailureを一回送る。実行されない/完了できない場合は未着になる。
- HealthchecksはSimple Period 1h / Grace 2hの候補。最後に受理された完了から約3hで未着扱い。開始pingは使わない。毎時成功や即時failureは次回の観測結果であり、メールの到達上限保証ではない。[check設定](https://healthchecks.io/docs/configuring_checks/) / [cron監視](https://healthchecks.io/docs/monitoring_cron_jobs/)
- 初期構成に複数check、KV/D1、公開status、新しいGitHub監視workflow、全history再走査、64 GET台帳、2h collector、restart receiptを足さない。既存毎時read-only報告へ接続/変更しない。
- 自動復旧、provider書込、公開許可、production deploy、旧incident解除を行わない。旧Actions有限試運転の証拠を新方式の成功証拠へ転用しない。

Cron設定の反映は最大15分かかる。Cloudflare内部からの公開URL GETは外部利用者と同じ経路の独立証明ではない。同zone Worker間fetchには制約があり、Custom Domainで対象に届くことを受入時に確認する。[Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/) / [Workers制限](https://developers.cloudflare.com/workers/platform/limits/)

## 点検契約とbaseline

baselineは本人が承認した**実際にdeploy済みの状態**を固定する。未公開のmainや最新commitへ自動追従しない。予定release後のbaseline更新は実deployとのread-back照合を経て本人が採用する。秘密・provider raw応答・private設定projection・識別子を公開Gitや通知へ保存しない。

公開点検は承認済みrootのstatus/body digestと、必要なworkers.dev/version previewの非公開性を合わせて最大3 GET。管理API点検は現在のcheckerの必要な投影と取得前後の一致を再利用する候補で、bindings修正や過去field調査を追加しない。欠落・取得中変化・ページ上限超過をPASSへ丸めない。

管理APIは対象account/zone/Workerを読む専用の最小権限tokenで、publisherの書込tokenを兼用しない。**公開応答だけの案**は管理tokenを使わずconfiguration=NOT_CHECKEDと明示する別scope。完全な構成integrity監視のNORMALとして採用しない。token/ping capability/baselineの設定と読取は将来の本人承認後のみ。

## 状態と一つのcheckへの信号

| 観測 | 表現 / Healthchecksへ送る信号 |
| --- | --- |
| checkがNew/未ping、または通知先未検証 | 監視初期化未受入 / サイトの正常を意味しない |
| 公開PASS・構成PASS・取得前後一致・全点検完了 | NORMAL / 正常POST |
| 公開status/body/preview不一致 | SITE_RESPONSE_FAIL / failure POST。構成UNKNOWNならそのsubstateも保持 |
| 公開PASSだが承認済み構成との差分 | CONFIG_DRIFT / failure POST。サイト停止とは断定しない |
| 管理API 401/403/429、timeout、不正JSON、oversize、必要field欠落、pagination未完了 | UNKNOWN_CONFIG / failure POST。公開PASSでUNKNOWNを消さない |
| crash/CPU超過/未起動/途中終了で最終信号なし | 観測結果未着 / HealthchecksがPeriod+Grace後に検知。サイト停止とは断定しない |
| ping timeout、非200、200でもbodyが厳密なOK以外 | DELIVERY_UNKNOWN / 再送しない。受理確認のない成功を記録しない |
| Healthchecks停止・メール配送障害 | NOTIFICATION_UNKNOWN / 本人の受領未確認。期限内通知の保証なし |

正常endpointと同じcheckのfailure endpointを使う。送信はPOSTだけ、redirect追従なし、content-based status判定なし、Only POSTを有効化、Auto Provisionは無効。HTTP 200でも `OK (not found)` / `OK (rate limited)` は受理証拠にならない。[ping API](https://healthchecks.io/docs/http_api/) / [failure](https://healthchecks.io/docs/signaling_failures/)

通知bodyは128 bytes以内の固定ASCII理由enumだけ。secret、ping URL、token、raw設定、baseline、ログ、private ID/URL、例外文字列を送らない。ping URLは第三者が状態を変えられるcapabilityとしてprivate secretに扱い、Gitやconsoleへ出さない。管理用Healthchecks API keyは初期構成に不要。

次回の完全PASSでcheckがUpへ戻っても、過去incidentの解決/解除にはならない。Healthchecks Hobbyistの100件/checkはrolling履歴で永続auditではない。既存incident資料を保持し、新incidentの日時・理由・復旧・本人のclose判断は非秘密の運用記録へ手動で残す。rolling履歴やWorkers Logsのみを長期保存と称さない。[料金](https://healthchecks.io/pricing/)

## 追加費用0円を成立させる条件

公式Free枠はCPU 10ms/invocation、128MB、subrequests 50、同時外部接続6、account共有100,000 requests/day（UTC日次）、Cron 5/account。ネットワーク待機はCPU外だがJSON decode/比較/hashはCPUに含む。[制限](https://developers.cloudflare.com/workers/platform/limits/)

現行sourceの照合基準はSite main `d3399dd132ada88c34c27c0eb7410035bcea958a` の [checker](../../scripts/release/site-integrity-monitor.mjs)。CF GET成功経路は `11 + Z + P1 + P2`（route取得Z=0/1、前後deployment各P=1..8ページ）で、Z=1なら通常14/最大28。契約hard capは32。現在の有限scopeは公開3 GET。8sampleの汎用scopeなら公開10 GETなので初期scopeには採らない。

| 設計上限の試算（通常毎時24起動、再実行なし） | 1起動 | 1日 |
| --- | ---: | ---: |
| CF管理API GET | 32 | 768 |
| 公開URL GET | 3 | 72 |
| Healthchecks最終POST | 1 | 24 |
| Worker外向きsubrequests合計 | 36 | 864 |
| Cron自身 + 対象も同account Workerの場合の公開3回（保守的なrequest計上） | 4 | 96 |
| GitHub API / KV / D1 | 0 | 0 |

外向きCF API GET768回はincoming Worker request768回ではない。redirectもsubrequestとして数えるため自動追従を禁止する。31日なら744 Cron/最終POSTであり月720回固定ではない。独自retry/backfill/manual catch-upを作らず、1 GETは10秒/1MiB、全観測と最終ping合わせ120秒、ping10秒/小さなACK上限、接続は最大6。最終pingに時間/予算を残し、点検を省略したNORMALは禁止。

これは静的上限試算でありFree適合の実測ではない。現行CLIのnode:crypto/Buffer/clone/canonicalizeをそのままWorkerへ移せない。必要な点検を保ったWorker互換の比較を別途実装する必要がある。最大35MiBの取得データとdecode/複製は10ms/128MBを超え得る。実Workerで全分岐と上限payload/8ページを測り、CPU上限超過0・最大CPU<10ms・余裕目標8ms以下・メモリ/接続/時間/36subrequests以内を確認するまで成立とは言わない。成立しなければ導入を止め、必要点検を満たす縮小案を再検討する。有料upgradeで解決しない。

実accountのplan・監視Workerのusage model・他Worker共有使用量・Cron空き・課金される関連機能は未確認。Paid planの最低月額$5を新規に必要とする案は不採用。既存Paid accountでもこの追加分が0円と証明できなければ保留する。Logs/保存等の料金も導入直前に再確認する（公式料金には2026-12-01の観測料金変更予告がある）。[Workers料金](https://developers.cloudflare.com/workers/platform/pricing/)

Healthchecks Hobbyistは$0/月・20 checks、初期1 checkでよい。未登録なので既存plan/契約・無料email利用条件・宛先・通知設定を本人が確認する。無料継続が成立しなければ保留し、別account分割や有料契約へ進まない。新server、AI定期run、paid保存を足さない。[料金](https://healthchecks.io/pricing/) / [通知設定](https://healthchecks.io/docs/configuring_notifications/)

## 残余リスクと停止

Cron欠落やCloudflare広域障害は外部Healthchecksの未着で気付ける候補だが、Healthchecks自身の停止やemail遅延との同時障害を排除できない。メール受領の厳密な上限時間は約束しない。独立外部からのHTTP probingも初期構成にはない。[信頼性](https://healthchecks.io/docs/reliability_tips/)

遅延/重複invocationをexactly-onceとは称さない。一周期(1h)を超えたscheduledTimeや開始から120秒を過ぎた結果を正常送信しない。controller.noRetry()とlocal scheduled試験は再試行抑制の候補だが、productionの重複なし保証は未検証。永続stateなしでは古い成功と新しいfailureの全体順序を厳密に証明できない。これが必須なら採用保留とし、理由/無料性/最小追加stateを別判断する。台帳を自動追加しない。[Cron試験](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

本人の停止操作はCron停止とcheckの明示Pauseを対にし、停止理由を記録する候補。Pause後のpingで勝手に復帰しない設定を確認する。停止は過去incidentを消さない。[check設定](https://healthchecks.io/docs/configuring_checks/)

## 最小受入試験（すべて今後の候補、今回未実行）

新checkは未pingのNewから始まる。作成だけで約3h未着通知が成立したとしない。最初の実Worker結果の受理と通知設定を本人が確認して監視を受け入れる。第一周期で結果未着なら初期化未受入として停止/確認する。試験用の正常pingをSite正常の証拠へ転用しない。[check状態](https://healthchecks.io/docs/)

1. 合成/mock：公開PASS+構成PASSのみNORMAL、公開不一致/構成drift/API拒否・timeout・oversize・bad JSON・途中変化・未完paginationはfailureまたはUNKNOWN。公開PASS+API UNKNOWNが緑にならない。
2. signal境界：正常/failが同じcheck、一回のみ。ACK200/OK、200/not found、rate limited、redirect、timeoutを区別し、secret/raw/body例外出力0、通信retry0、120秒停止とping予算確保。
3. Worker互換：same-zone Custom Domainの公開GETと期待body、preview非公開、最小read-only権限、32+3+1制限、最大payloadのCPU/メモリ、未起動/crash/遅延/重複で古い成功を送らない。追加stateが必要かを判定。
4. 外部通知：本人が承認したcheckで正常/fail/未着/Pause/復帰と本物のemail受領を確認する。未着はPeriod1h+Grace2hを待つ。spam/宛先/継続reminderを確認し、HC記録だけを受領証拠にしない。
5. 約24hの自然運転：各観測の最小理由・CPU/上限・受理ACK・本人受領を照合し、課金増0とUNKNOWN消失なしを確認。24h連続正常だけで全障害検知や通知SLAの証明とはしない。history collector/600秒gap/端末hook不要。

## 本人が決める導入順と承認境界

1. このProposed候補の範囲（構成APIあり、または別scopeの公開だけ）、無料上限、約3h未着、通知と順序の残余リスクを採用するか判断する。今回のDraftは設計審査だけ。
2. 採用後の別許可で、secretを読まず実account/料金/共有余力と必要権限を本人が確認し、Worker互換実装とmock試験を行う。無料性/CPUに成立見込みがなければ停止する。
3. 本人がHobbyist accountの登録要否、通知先email、異常中の継続reminder要否・頻度を決める。初期1 checkのPeriod/Grace/POSTのみ/自動作成無効/Pause挙動を設定する。ping capabilityとread-only tokenは本人承認したsecret配置へ渡し、公開Gitへ置かない。
4. 正確な候補source・deploy先・実deploy済みbaseline・read/送信scope・無料枠・試験期間・停止/rollbackを本人が承認してから、監視Workerのみ導入/外部通知試験/約24h trialを行う。Site deployや既存gate解除は別権限。実測/実受領後に通常運用の可否を判断する。
5. 停止時は監視Cron/check Pauseと理由を揃え、credentialを不用意に参照しない。秘密rotation/削除や旧incident closeは本人の別判断で行う。

[CP-01 Gatus候補(Server Draft73)](https://github.com/Xpotato1024/Xpotato-Server/pull/73)はproduction_ready/delivery_enabled=falseで、必須TLSとSMTP実受領が未受入。WireGuard内の候補であり、稼働通知基盤にもWorkerからの直接push先にも数えない。

今回の変更はこの運用候補・Proposed ADR・索引のMarkdownだけ。既存workflow/code/provider/runtime gate/権限/毎時報告を変更しない。実登録、credential読取、provider GET、dispatch、artifact保存、trial、Ready/merge/deployは今回の実行範囲外。
