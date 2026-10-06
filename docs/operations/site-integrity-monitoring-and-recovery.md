---
status: code-and-synthetic-tested-live-pending
owner: operations
last_verified: 2026-10-06
---

# サイトtoken再利用：継続監視と本人復旧

2026-10-06、本人は「検知と復旧がある」条件で、限定長期site token再利用と異常時の本人Dashboard対応による簡素化を承認しました。**通常deployごとのoperator token発行・自動DELETE権限は必須にしません。** 検知・通知・本人失効・正常artifact復旧を未実証のまま完成とは呼びません。Server Draft PR69の採用とmerged exact pin、実設定/credential/live試験/本番操作は別gateです。

## 受入れ条件と現状

1. 配布時間外もproviderとHTTPを読む。承認済みbaselineを自動追認しない。
2. drift/403/timeout/不完全取得/停止は配布STOP。正常結果が後から出ても過去のincidentを勝手に解除しない。
3. 本人に実際に通知が届き、Dashboardでexact-ID失効・必要な公開停止を行える。
4. 正常artifactを復旧してsettings/bindings/endpoints/実HTTPを照合し、本人が再開を認可する。
5. 監視自体の停止とGitHub scheduleの遅延を見逃さないため、既存CP host-integrityへのfreshness hookを確認する。

1/2/4の判定コードと合成試験は実装。3/5とactual API/credential/scheduler/bootstrap/deploy wiringは**LIVE PENDING**。監視workflowのjobはliteral false、scheduleはコメントだけ、baselineはUNINITIALIZEDです。現在の本番に保護が追加されたとは主張しません。

## 既存基盤の読み取り調査

Server current main `2caad17f9fa490b37727273b8c9a9a75178dfe1f`には、CP-01 Gatus v5.36.0、60秒/失敗3回/回復2回、既存SMTP一系統、host-integrity最大3600秒の設計があります。しかしcheckoutの`services/`はREADMEだけで、Gatus/host-integrityのruntime展開・稼働・SMTP受信成功は確認できません。runtime sourceを推測してSSH trustを登録したり、secretを読んだりしません。

Gatusの[固定版native条件](https://raw.githubusercontent.com/TwiN/gatus/v5.36.0/README.md)はstatus/JSONPath/文字列/証明書確認に適合しますが、複数APIの全pagination、artifact SHA、incident latchをこの用途へそのまま置き換えません。custom collector sidecarや新serviceを作りません。既存GitHub Actionsのhosted runnerをprovider監視に使い、既存CP host-integrityにはPython標準libraryのGitHub fresh-result readだけを足す候補とします。CPの未成立なら監視停止通知を受入れ済みにしません。

LLM-01の既存ghでSite Actions enabled/public/standard CI稼働、repository Actions Secrets 0件をread確認。Cloudflare接続能力と本人のGitHub Actions通知設定はUNKNOWN。既存GitHub adminをCloudflare認可に代用しません。通知先は本人`Xpotato1024`のGitHub Actions失敗通知のprimary email、CP側はServer `inventory/desired/notifications.yaml#smtp.alert_recipient`を維持し、別Slack bot/webhook/password/mailboxを作りません。メール設定変更・送信確認もまだ実行しません。

## 最小権限・頻度・費用

| 対象 | 提案 |
| --- | --- |
| deploy credential | 既存案の個別Worker Editor、Environment `site-production`だけ、max90日/rotate60日/残存7日。正常時同ID保持 |
| monitor credential | deploy credentialと別IDの**読み取り専用**token1件。対象WorkerのViewer/Workers Scripts Read、対象account全zoneのZone Read + Workers Routes Readだけが候補上限。API Tokens Read/Write、Worker Write、R2、DNS Write、issuer/admin権限は付けない |
| scope実証 | 個別Worker Viewerでidentity/settings/script-settings/version/deployment/domains/subdomain GETが可能か、全account zone/routesが完全に見えるかをactual GET/403で確認。全zone一覧とownerの独立一覧を照合。必要scope不足ならSTOPし、account-wide権限へ自動fallbackしない |
| 保管 | monitor専用repository Actions Secret `CLOUDFLARE_SITE_MONITOR_READ_TOKEN`候補。PR/forkには渡さずmain上の固定read workflowのみ。本人の安全入力、期限/更新、raw policy reviewが別承認対象。読み取りtokenも情報漏洩riskがある。新常設adminは置かない |
| schedule | `2-57/5 * * * *` UTC、約5分ごと。1回のsnapshot上限120秒/job上限3分、失敗1回でincident。latest開始から10分超/gap10分超はcoverage unknown |
| 通知 | failed workflow→本人GitHub Actions email。ownerが「Email（取消/timeoutも受け取る設定をlive確認）」等の実設定と通知先を確認し、合成failure email受信試験。scheduleのactor依存を確認する |
| 停止検知 | Server `scripts/check_website_monitor.py`を**既存**CP host-integrityに結線し、匿名GitHub GET1件でlatest age/statusを確認して既存SMTPへ通知。新timer/service/credentialは作らない。既存最大3600秒ゆえ停止通知は最大約1時間+SMTP遅延、CP同時停止なら届かない |
| 費用 | public Siteのstandard hosted runner minutesは[現公式仕様では無料](https://docs.github.com/en/billing/concepts/product-billing/github-actions)。約8640 jobs/30日、1回14〜21 CF GET+zone数+pagination、HTTP3〜10 GET。標準Nodeのみ/install/build/cache/artifact保存なし。CF GET quota、サイトrequest/egress、SMTP・CP既存費用は実plan未確認。private化/larger runner/既存quota変更なら再review |

GitHubの[schedule仕様](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)は遅延・dropとpublic repo60日activityなしの自動無効化を明記します。**5分は保証最大検知時間ではありません。** この遅延と本人対応時間を受け入れられない場合、今回の簡素化方式は有効化しません。

## 読み取り実装

`site-integrity-monitor.mjs`は注入したcredential/fetchだけを使い、固定CF origin/GET allowlist/全pagination/response上限1MiB/10秒transport timeout/redirect拒否を維持。provider生body・secret・HTTP本文をログへ出しません。

各factoryは1回のsnapshotのみ。全体120秒deadline/AbortSignalをAPI/public fetchへ伝播し、terminal後の暗黙再試行を拒否。次のscheduleは新factoryを作る。実credentialの取消対応もlive確認が必要です。

- verifyによるmonitor自身のID/active。token全inventory/policy APIは読まないため、credential scopeのruntime再照合や別token発行は検知対象外。初期/更新のowner raw policy reviewが必要。
- Worker name/tag、active deployment ID、version ID、単一100% traffic。
- `/settings`全値fingerprintとbindings=0、`/script-settings`全値fingerprint（observability/logpush/tail consumer等）、version resources fingerprintとbindings=0。
- custom domainは既存production hostname1つ、account全zonesのID集合一致、各zoneの対象Worker routes=0。
- workers.dev/Preview URLs=false、account subdomain一致、現在実version UUID先頭8文字URLとworkers.devが404。
- verified **公開済み**artifactから選んだhome必須・最大8path（代表公開page/JS等）のHTTP status200/実bytes SHA256。同一origin、query/任意hostなし、認証headerなし。
- multi-read終端のdeployment/settings/script-settings/flags再照合。atomic snapshotは保証しない。

baselineはexact producer run/attempt/artifact/source SHA/API digest、provider IDs/fingerprints、safe公開sample hashes、owner承認のcheckpointを保持します。秘密値/未公開記事path/bodyを入れず、現観測を勝手にknown-good化しません。任意JSONの`OWNER_APPROVED`は本人承認の証拠ではなく、protected mainのreviewとactual取得元確認を必要とします。CLIは明示opt-inを要求し、現UNINITIALIZED baselineでは通信前に拒否します。

`site-monitor-history.mjs`はGitHub Actions(read)のみでexact workflow全run historyをpagination取得。checkpoint不在・不完全・403・failure/cancel/skipped/pending・10分超gap/stalenessはSTOP。新しいsuccessだけで過去failureを消しません。全run取得上限10000で上限/保存期間不足ならUNKNOWNとしてSTOP。ownerが復旧証拠をreviewした後に新checkpointへ変更するまで解除しません。

**配布との結線は未完**です。将来production開始直前にhistory gate+fresh直接provider read、write直前にもgate再読、配布後readbackを必須にする設計です。失敗時はjobをfailし後続writeを止め、通知する。既存B evidence判定はSTOPPED_OWNER_RECOVERY_REQUIREDを返し、自動revoke成功を捏造しません。GH Actions(read)から別runをcancelする能力はありません。送信済みwriteは取り消せず、配布外の不正CF mutationも自動抑止できません。

旧`deployment-supervisor.mjs`/token-revoke/endpoint-containは事前認可の強いoperator用libraryとして残しますが、**簡素化Bのdefault gate/必須経路ではありません**。毎回一時operator tokenを要求する旧提案を採用条件から外しました。

## 検知できないもの・遅れ

- 監視間に改ざんして元に戻す攻撃、inactive version upload、閲覧者/地域/UA/時刻/URL別の条件付き悪性応答、未sample path、すでに漏洩した情報。version切替が継続すれば検知するが短時間の復元まで完全に監査しない。
- 認可済みbaseline自体の悪性化、GitHub owner/admin侵害、監視readonly tokenの権限拡大や通知先変更、CF admin侵害、R2/DNS/redirect/他Workerの全体監査。本site tokenのR2 binding経由残存riskは維持。
- cache/地域差/TLS/API障害によるunknown/誤検知。no-cacheでもCDN全地域のorigin真実とは言えない。
- GitHub queue/drop/60日無効化、CP停止、SMTP/本人メール停止。CP freshness hookはdeploy外の停止を補う候補だがlive稼働未確認。二系統同時停止の外部watcher/HAは追加しない。
- 最大5分保証・自動失効・自動正常化は提供しない。**悪性コードが公開される時間は検知遅延+通知遅延+本人の応答/復旧時間**で、上限を実証していない。

## 本人の異常対応・復旧手順

1. incident run/time/baseline identityを保存し配布STOP。本人がGitHubのwaiting承認を拒否し、進行中runをcancel。Environment停止だけではCF tokenは失効しません。
2. 既存Cloudflare DashboardでManage account → Account API tokens、**対象site token exact ID**をDeleteし、一覧不在/owner操作結果を別readback。token値はコピー/表示しない。新admin token不要。API全inventory/detail404が利用できる時は追加証拠とするが、この方式のために広い常設API権限を作らない。
3. 必要ならWorker Settings → Domains & Routesでworkers.dev/Preview URLsをDisableし両実URLを確認。**両falseだけではcustom domain `xpotato.net`の悪性応答を止めません**。本番custom domainまで停止が必要なら、本人がServer ownership下の限定break-glassを別認可し当該bindingの一時解除/復元を行うか、直ちに既知goodを再配布する。DNS/R2/redirectを勝手に変更しない。
4. revokeだけではすでに配布された悪性Worker code/settingsは消えません。最後に**受入れ済み**のrun/attempt/artifact ID/API digest/source SHAを取り、既存Production consumerでarchive/stagingを再検証し、同一artifactをpinned Wrangler/configで再配布する。再build、改ざん現況を新baseline化、単なるlatest版本rollbackをしない。漏洩tokenは再利用せず、本人が必要な狭いreplacement credentialとexact復旧操作を別認可する。
5. 保持期限前にownerが正常release packageをLLM-01のtask checkout外、候補 D:/Xpotato-apps/site-release-recovery/SOURCE_SHA/ARTIFACT_ID/ へprivate保存しhash/manifest/retentionを検証する（保存操作/先は別承認）。GitHub artifactがexpired/不存在で独立正常packageもなければ**RECOVERY BLOCKED**。Git sourceから再buildして同じartifactだと主張しない。初回B有効化前にこの条件を成立させる。
6. settings/script-settings、bindings=0、domain/routes、deployment/version/100%、endpoint false+実URL404、公開sample bytesをfresh確認。`assessOwnerRecovery`はexact old token失効、known-good selection、settings/bindings/endpoints/HTTP、fresh monitor、本人再開の全evidenceを必要とし、revocationだけのfixtureは拒否する。
7. 正常復旧と通知受信を本人が確認した後にbaselineの新provider IDsとcheckpointをreview更新。自動incident resetしない。初期bootstrapはcheckpoint=nullで**read検証のみ**→最初の成功manual monitor runのIDを本人確認→checkpointをreview追加→history gate成功の順。nullではdeploy gateを開けない。

正常な新releaseも、新provider deployment/versionを本人がreadback承認してbaseline/checkpointへ反映するまでは監視STOPとなります。expected deployment windowを盲目に除外しません。この手間はtoken再発行ではなく非秘密の受入れ操作ですが、false alert/配布完了までの待ちを含めlive試験が必要です。

## 次の一括承認（すべて未実行）

| 操作 | 実行先・範囲 |
| --- | --- |
| existing基盤のlive read | 本人Dashboard login/MFA、Worker/role/full zone metadata、GitHub通知UIの本人宛設定、既存trust済みCPのGatus/host-integrity/timer/SMTP稼働metadata。cookie/secret表示・新trust登録なし |
| readonly credential | actual Viewer/Read scopeをreviewしたmonitor token1件の本人発行・期限指定・専用Actions Secret安全登録。write/admin/token管理/R2なし。403ならSTOP |
| 限定canary検知/復旧 | 同名不存在確認後、既存accountに`xpotato-site-safety-canary-20261006`1つ、合成good/bad応答のみ、held content/real bindings/DNS/custom domainなし。短命target Editorとreadonly token、最大15分のworkers.dev/実version URL公開。good→bad version/設定/endpoint drift検知→本人exact-ID revoke→必要URL停止→保存済みgood package再配布→設定/HTTP照合→checkpoint再開→canary/token exact cleanup。別targetのtest-only wiringは次reviewまで未完 |
| 通知/停止試験 | 合成monitor失敗/403/取消、schedule停止/age>10分、CP hook→既存SMTP、本人GitHub失敗emailの実受信。新メールsecret/service/botなし。通知有効化・実送信はこの別承認対象 |
| 復旧package保存 | 正常artifactをexpiry前にLLM-01候補 D:/Xpotato-apps/site-release-recovery/SOURCE_SHA/ARTIFACT_ID/ へprivate保存しhash/manifest確認。folder存在/ACLは未確認、作成/保存は別認可。accepted current+previous goodを各90日以上維持し、正常次版受入れ前は旧goodを削除しない。CF/GitHub expiryから独立するがLLM disk喪失まで保証しない。未公開内容・secretを外部公開しない |
| activation code/settings | 成立した既存CP hookへの結線、Site read監視schedule有効化、protected production bootstrapとgate wiring。現PRは有効化せず、scope/通知/復旧試験証拠をreviewしてから実行 |

このbundleはServer/Site merge、production site token発行/保管、本番workflow enable/deploy、productionの停止/復旧実行、R2/media/C-lock/DNS/redirect/hold解除を含みません。最後に別のexact production bundleを提示します。
