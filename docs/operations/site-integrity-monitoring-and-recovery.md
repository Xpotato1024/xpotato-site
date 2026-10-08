---
status: proposed-code-tested-live-pending
owner: operations
last_verified: 2026-10-06
---

# サイトtoken再利用：CP不要の最小監視と本人復旧

本人は検知・復旧を条件に期限付きsite token再利用と異常時Dashboard対応を選び、CPを使わない最小構成の検討も承認しました。サーバーのIaC方針に合わせ、定義・状態schema・導入/撤去/復旧手順をGit管理します。通常deployごとのoperator token、自動DELETE、新serviceは必須にしません。

**Draft候補・有効化なし。** 本番3jobと監視jobはliteral false、scheduleはコメント、baselineはUNINITIALIZED。Server PR69の採用/mergeとreadonly token本人発行・専用Secret保存/固定GET/synthetic通知試験は後続認可済み。監視設定、canary復旧write、productionは別認可です。コード/mockをlive安全保証と呼びません。

## 比較と選択

| 案 | 成立する範囲/追加物 | 限界/判断 |
| --- | --- | --- |
| Actions+GitHub内第二watchdog | Git-managed workflowだけで個別監視workflowの停止を別cronから観測 | scheduler/API/通知の同時障害、repo無活動停止に対して独立しない。第二workflowを今は追加しない |
| **Actions+既存毎時ChatGPT本人進捗タスク** | 既存taskへversioned observer節を追加する候補。既存GitHub read/既存本人Slack DMを再利用、新契約/service/credential/通知先なし | Actionsと別schedulerだがGitHub API依存は残る。取得失敗をUNKNOWNとして通知する設計。ChatGPT/connector/Slack停止・approval pauseは未通知、自己停止は自己検知不可。初期候補 |
| 新uptime SaaS/Cloudflare cron Worker/LLM常設task | 契約/新実行環境/設定/権限/起動前提を増やす | 停止検知のための追加基盤は導入しない |
| 将来のCP host-integrity/SMTP | CP基盤がIaCで稼働後、versioned Python evaluatorを既存hookへ結線 | WG/Docker/timer/SMTP実受信、Ansible導入/撤去/再構築が前提。初期公開をCP完成待ちにしない |

既存毎時taskはread確認済みですがobserver節は未導入。GitHub connectorはworkflow別runs URLを許可せず、repository runs GETは成功したため、固定repository URLの最新10件から対象pathを選びます。対象欠落はUNKNOWN、別CIのsuccessを代用しません。既存Slack DM readも成功。これらは将来のscheduled実行/通知到達の証明ではありません。

## 初期構成と受入れ条件

1. Actionsでprovider/公開HTTPを約5分ごとにread。approved baselineを自動更新しない。
2. drift/403/timeout/不完全/coverage gapは配布STOP。checkpoint以降のincidentをlater successで解除しない。
3. Actions failure-only email。本人申告と既存CI失敗メール受信は照合済みだが、設定UI read、新監視run自身の配信、取消/timeout配信は別試験。成功/全完了の288件/日メールは要求しない。
4. 既存ChatGPT毎時taskがfreshness/statusをreadし、STALE/INCIDENT/UNKNOWNを既存本人DMへ補助通知。scheduled実行・通知実測と本人の遅延/依存許容が初期gate。
5. 本人Dashboard exact-ID失効/必要公開停止、保存good artifact/settings/HTTP復旧、本人再開を別live試験する。

本体は5分、snapshot120秒/job3分、latest作成10分超/gap10分超でunknown。独立observerは毎時で、**停止から名目最大約70分（10分閾値+次の毎時観測）+scheduler/取得/配送遅延**になり得ます。保証上限ではなく、二系統障害や本人不在で無期限の遅延があり得ます。受理できなければ方式Bを有効化しません。

[GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)はdelay/drop/default branch/60日無活動停止を明記。[ChatGPT scheduled tasks](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt)もplan/app依存、pause、接続app認可/approval、通知設定の条件を持ちます。既存毎時taskを安全監視のSLAと扱わず、ルール実行/実配送は別試験です。

## Git管理とIaC境界

| 所有者 | version管理する対象 |
| --- | --- |
| Site | 監視workflow/read実装/tests、非秘密baseline/approved checkpoint、deploy pre/write/post gate、公開sample hashes |
| Server候補 | services/website-monitor-observerのdefinition.json/prompt.md/state.schema.json/activation-receipt.schema.json、scripts/check_website_monitor.py、導入/更新/撤去/CP移行手順、desired候補 |
| private receipt | exact source SHA、既存task ID、元prompt/module/全prompt hash、schedule/readback、実通知受信、削除確認。private復旧root配下の候補。task ID/DM/メール実アドレス/元prompt/secretはGitへ置かない |

Git→本人review→明示認可→既存外部task API限定更新→readback/hash/schedule照合→private receipt。元の論文/授業/サイト報告節・cadence・配送先を保持し、observer節だけidempotentに追加/置換/撤去。UIの独自変更を第二SoTにしません。現在task設定は未変更。Terraform provider/汎用reconcilerを追加しません。

サーバーへ手動script/timer/SMTP設定は置きません。将来CPもGit-managed Ansibleで既存host-integrityへ同じschema/閾値を結線。具体的導入・撤去は[Server operator候補](https://github.com/Xpotato1024/Xpotato-Server/pull/69)が正で、Siteは採用後のmerged exact revisionへ別追従。現accepted pinは不変です。

## 最小credentialと公式GET照合

site Editorはprotected Environmentだけ、max90日/rotate60日/残存7日、正常same-ID。monitorは別IDのIndividual Worker→xpotato-site→**Metadata Read-Only**が第一候補、必要時だけ既存xpotato.net zone Workers Routes Read。Content/account-wide/全zone/token管理/Write/admin/issuer/R2/DNS Writeは自動追加しません。readonly tokenも初期/rotationのみ本人発行/policy review、専用Actions Secret候補。毎回発行を再導入しません。

公式[permission一覧](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)と[role一覧](https://developers.cloudflare.com/fundamentals/manage-members/roles/)だけでは個別Metadata roleと全GETの対応を確定できず、使用可能な既存CF認可も未確認です。

| required GET | 公式照合/残るgap |
| --- | --- |
| deployments/versions/subdomain flags | [deployments](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/list/)、[version](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/get/)、[flags](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/methods/get/)はWorkers Scripts Read等。個別Metadata対応は未実証 |
| settings/script-settings | [script-settings](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/settings/methods/get/)はWorkers Scripts Read等。bindings settingsとの両GET実証が必要 |
| domain | [domains](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/list/)はWorkers Scripts Read等、service filterあり。個別Worker可視性は未証明 |
| 必要な既存zone routes | [routes](https://developers.cloudflare.com/api/resources/workers/subresources/routes/methods/list/)はWorkers Routes Read。zoneIds0/1件、全zone集合取得なし |
| 残存account scripts identity list/account subdomain/own token verify | disabled実装に残るGET。Metadataで通るか未実証。403を広域grantで解消せず、target metadataへ絞れるかactivation前reviewが必要 |
| public sample/alternate HTTP、独立observer GitHub read | CF token不要、固定hostだけ。redirect/unknownを正常扱いしない |

全account/他zone/admin侵害は別scope。無関係zone変更を本監視STOP理由にせず、role不足はblocking gapとして停止します。

## read実装と状態の意味

本体は固定CF GET/完全pagination/1MiB/10秒timeout/redirect拒否、全体120秒取消、1factory1観測。Worker/version/deployment/100%、settings/script-settings/resources fingerprint、bindings=0、domain/必要zone routes、両alternate false/実version URL404、verified公開artifact home等最大8pathのbytesを照合し、終端再readで変化を拒否。生body/secret/非公開記事は出力しません。

historyはowner checkpoint時刻以降をUTC日別検索・全paginationし、filtered search1000件上限を各区間で検証。lifetime10000上限は廃止、10081件回帰試験成功。checkpoint不在/欠落/403/incident/rerun/10分gap/stalenessはSTOP、owner復旧review以外でresetしません。

補助observerは最新10件prefixから対象runを選びます。FRESH=直近success、RUNNING=作成180秒以内queued/in_progressかつ直前successも600秒以内、STALE=600秒超、INCIDENT=terminal non-success、UNKNOWN=取得/identity/時刻/順序/対象欠落等。最新10件が他CIで埋まればUNKNOWN。完全history検証ではなく、**全statusでdeployAllowed=false/providerMutations=0/acceptance=false**。FRESH/RUNNINGをincident解除やlive acceptanceに使いません。AIルール解釈/dedupはbest effort、Python単体試験をscheduled taskの決定的実行保証に読み替えません。

## read証拠と保存済good

- Ubuntu-24.04の既存historical strict SSHでCP hostname/fingerprintを本人確認済み値と照合、鍵/trust変更なし。CPはwg-mgmtなし、Docker未導入、該当monitor unit/timerなし。GatusはWG限定設計でLAN8080不達は停止根拠ではありません。CP依存を初期構成から外します。
- 本人のfailure-only申告と既存メールを[旧head failure run37477679437](https://github.com/Xpotato1024/xpotato-site/actions/runs/37477679437)へ照合。通知UI read/new monitor/cancel/timeoutの証明とは区別します。
- 本人の明示認可で`D:/Xpotato-apps/site-release-recovery/b9554ed43d5b743dfe99efc80ad5474535ad72cd/10979514770/`へ受入れ済archive/manifestを保存。miyut/SYSTEM/Administratorsだけ、root親継承なし、子ACL/readback/保存SHA一致、112640bytes。digest=`sha256:409169600d7124fe54f927e4145a0a95d3270d5bfb79c267dbe479b251f306ca`、最低保持2027-01-04、次版受入れ前旧good削除なし。現在版保存完了、実restore未実施、単一LLM disk喪失は別復旧gap。

## 本人の異常対応と復旧

1. 配布STOP、incident/run/time/baselineを保存。本人がpending承認拒否/進行run cancel。read監視/observerに取消/CFwrite能力はありません。
2. Dashboardでsite exact-ID Delete、操作結果/不在readback。Secret削除や予定expiryは失効証拠にしません。毎回admin token不要。
3. 必要alternateをDisable/実URL確認。両falseだけではcustom domainの悪性応答は止まりません。当該binding一時解除/復元またはgood再配布はServer所有の限定break-glassとして別認可。DNS/R2/redirect任意変更なし。
4. **失効だけでは配布済み悪性code/settingsは消えません。** 保存goodのexact run/attempt/artifact/source/digestをProduction consumerで再検証しsame package/pinned configで復旧。漏洩tokenを再利用せず、事故時replacement/復旧操作だけ別認可。独立goodも無ければRECOVERY BLOCKED、rebuild/latestを同一artifactと呼びません。
5. settings/script-settings/bindings=0/domain/routes/deployment/version/100%/alternate false+実404/公開bytesをfresh確認。通知実受信/本人再開後だけbaseline/provider IDs/checkpointをreview更新。new releaseもreadback承認前STOP、blind maintenance除外なし。初期checkpoint=nullはread bootstrap用でdeploy gateを開きません。

## 次のlive承認（いま実行しない）

| bundle | 限定操作/合格条件 |
| --- | --- |
| scope/readonly | 本人DashboardのMetadata role/resource/policy確認、初期monitor token1件の期限/policy review/専用Secret安全入力、actual GET/403検証。広域grantなし |
| 独立observer | 既存毎時本人taskのobserver節だけGit exact版へ更新、元prompt/cadence/配送先保存、readback/private receipt。STALE/INCIDENT/UNKNOWN実通知と正常非通知、scheduled実行を本人確認。新task/service/bot/webhookなし |
| detection/recovery | 限定合成canaryでgood→bad/403/取消/停止→通知→本人exact-ID失効/必要公開停止→保存good/settings/HTTP復旧→owner checkpoint。公開/credential/最大15分/cleanupを別認可、held dataなし |
| wiring/activation | scope/遅延/通知/復旧のlive証拠review後、Site schedule/pre/write/post gateをGitで結線/有効化。production token/本番deploy/Server採用mergeは別bundle |

GitHub内だけの開始を独立停止検知成立と呼びません。既存task案でもbest-effort/名目70分を本人が明示受理し、scheduled read・UNKNOWN通知が実測されるまでlive適合を認めません。新SaaS契約/恒久service/追加credential/監視有効化はこのPRでは実行しません。

## 2026-10-06本人認可後の限定試験入口

本人がServer PR69とSite PR66の限定merge、個別Worker Metadata Read-Only token発行・専用repository Secret保存、固定GET/synthetic異常通知試験を認可。Server PR69の実merge SHAは`ab9328c5a58082ac1ec268aa7d5901d838a6a474`。恒常監視/本番write/公開/失効/復旧writeの認可ではない。既存毎時reportのobserver更新は親threadで担当し、このworkflowを対象monitorのsuccessとして代用しない。

本人操作：Cloudflare既存account → Manage account → Account API tokens → Create Token。`Individual Workers → xpotato-site → Metadata Read-Only`のみを選択し、最大90日・60日更新目安・残存7日を維持。選べるscopeが異なるなら発行せずSTOP。account-wide Scripts Read/Content Read/Write/全zone/token管理へ置換しない。初回にRoutes policyは追加しない。発行後は本人がGitHub repository Settings → Secrets and variables → Actionsへ`CLOUDFLARE_SITE_MONITOR_READ_TOKEN`を直接登録。値をchat/Git/PR/画像へ出さず、agentは読取/転送/登録をしない。`site-production` Environmentのdeploy Secretとは別で、現manual probeはrepository Secretを参照する。

登録後、本人がmainから`.github/workflows/site-monitor-readiness.yml`をmanual dispatchできる準備だけを置く。mode=`readonly-get`と既存account IDで対象deployments/version/settings/script-settings/subdomainを先にGETし、残存account scripts/domains/subdomain/own-token verifyを順に検証。固定host/Worker/GETのみ、1MiB/10秒/全体120秒、redirect拒否、403/shape unknownでその場STOP。出力は9 endpointすべての固定ラベル/静的結果コード/allowlist済みfield・type・check診断だけで、生body/credential/metadata ID/subdomain/binding値・provider由来keyを出さない。HTTP 200のJSON解析後に必須success=true/errors=空array、result型、各identity/optional field/既知pagination項目のpresence/typeとPASS/FAILを記録する。transport失敗時は固定UNAVAILABLE/NOT_CHECKEDとtransport=FAILだけを記録する。version bindingsは公式仕様のoptional、list説明、object例に合わせ、省略・object・object要素のarrayを許容するが、null/primitive/不正array要素は停止する。settings bindingsもoptional arrayとして検証する。required envelope/result/resourcesと要求version ID一致は必須のまま。診断はreadアクセス試験用でありbindings=0や監視適合を証明しない。初回pageだけのアクセス試験であり完全pagination/最小policy証明/incident検知/復旧/live acceptanceではない。baselineを作成・変更せず、監視job/cronを有効にしない。Routesは未検証と明記する。

domains GETは[公式SDKのSinglePage契約](https://github.com/cloudflare/cloudflare-typescript/blob/main/src/resources/workers/domains.ts)に合わせ、readiness/本番monitor/provider snapshotすべてqueryなしのunfiltered GETを使う。optional service filterもpage/per_page queryも送らず、別Workerへのhostname付け替えをinventoryから隠さない。readinessではresult=arrayと各rowのid/service/hostname/environmentの型を検証し、optional result_infoの省略や矛盾しない部分情報はreadアクセスとしてのみ許容する。別Workerのrowや空inventoryがREADABLEでも所有権・完全性・安全性の証明ではない。wrapper objectや必須errors省略を推測で許容しない。本番は全inventoryについてpage=1、正整数per_page、count=total_count=全row数、total_pages=1、必須row型、unique id/hostnameの明示証拠を先に要求し、result_info省略・部分情報・矛盾はBLOCKEDのまま。[公式API](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/list/)のcountとtotal_countを対象Workerのrow数に置き換えない。完全性検証後、期待hostnameの所有rowが一意で対象Worker/productionを指すことと、対象Workerのdomain集合がその1rowだけであることを別々に検証する。他Workerの無関係なdomainは許容し、付け替え・重複hostname（大小文字/末尾dot同値を含む）・対象Workerへの余分なdomain追加は停止する。完全性証拠を満たせない実responseへの対応は別設計・認可で決める。実runのdomains失敗fieldはまだ不明であり、この変更から原因を断定しない。

[settingsのoptional bindings array](https://github.com/cloudflare/cloudflare-typescript/blob/main/src/resources/workers/scripts/script-and-version-settings.ts)をreadinessで省略許容しても、本番では明示された空arrayが必要。versionも本番では明示された空object/空arrayが必要で、省略/null/primitiveを空bindingsと見なさない。fingerprint一致だけでcontainer型を代用しない。account subdomainは[SDKのstring契約](https://github.com/cloudflare/cloudflare-typescript/blob/main/src/resources/workers/subdomains.ts)に加えて安全なDNS labelを要求する。[own-token verify](https://github.com/cloudflare/cloudflare-typescript/blob/main/src/resources/accounts/tokens/tokens.ts)はidentity/status型とactive状態を別checkにし、recognized disabled/expiredも停止する。これらの診断・readabilityはdeploy/acceptance権限を与えない。

mode=`synthetic-failure`はcheckout/Secret/Cloudflare呼出しなしで意図的に失敗し、既存failure-onlyメールの本人実受信をrun ID/時刻と照合する。正常なサイト異常と混同しない。受信前に通知試験PASSと呼ばない。毎時observerのsynthetic fixture配送試験は親threadの既存task経路で別に行い、provider状態や監視baselineを偽装しない。

本番失効・公開停止・saved-good再配布はread tokenでは実行できない。実復旧ではhistorical exact archive/consumer/settings契約を別認可し、bytes/metadataを書き換えずに検証する。scope/完全monitor coverage/通知/復旧証拠が揃った後にbaselineと監視activationを別認可する。
