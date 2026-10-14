---
status: proposed
owner: operations
last_verified: 2026-10-14
---

# 毎時Workerから本人への異常メール通知候補

Cloudflare WorkersのCron Triggersで検査し、確認済み本人宛のsend_email bindingで通知する。候補コードは[apps/site-monitor](../../apps/site-monitor/README.md)。今回の範囲はコード・合成試験・独立レビュー・Site Draft PRまで。Worker/KV作成、provider取得、メール実送信、Cron、DNS/Email Routing、secret、旧Actions、merge/deployは変更していない。追加費用0円とFree CPU適合は未検証の導入条件で、Paidへの変更を前提にしない。

## 固定済みの公開基準

写真・メニュー公開済みのsource `1c6091e81d732c0c92356742e18f2a6905fc7795` に固定。正式CI [38485145014](https://github.com/Xpotato1024/xpotato-site/actions/runs/38485145014)、artifact `11859965419`、digest `sha256:38fd7b058e369ccff9b728b1902a700306e0dafdeddb3b2734d7a76c28afdf3e`、本番run [38485905907](https://github.com/Xpotato1024/xpotato-site/actions/runs/38485905907) success。旧PR65を待つ工程は完了した。ただしこの公開成功は旧監視incidentの解除根拠ではない。

home HTMLと写真13件（合計2,804,363 bytes）のstatus/bytes/SHA、実versionのpreviewとworkers.dev非公開、deployment/version、bindings/settings、Worker/domain/routesを確認する。写真表は公開ガードと同じ純データを再利用し、13件を必須にする。mainの自動追従やbaselineの自動更新は行わない。新deployment、provider/private baseline、home digestの具体値は承認済みread-only取得と本人照合を待つ。Gitに秘密・メール実宛先・private baselineを保存しない。

## 結果と通知

| 判定 | 意味 |
| --- | --- |
| NORMAL | 今回の必要点検が全てPASS。保存済みincidentは保持 |
| PUBLIC_FAILURE | 公開status/bytes/SHAまたは非公開endpointが不一致 |
| CONFIG_DRIFT | 読めた構成が固定基準と不一致 |
| UNKNOWN | API拒否・timeout・JSON/shape不明・上限・必要点検未完了 |

configurationとpublicStatusを別に保存する。公開PASSでAPI UNKNOWNを正常へ変換しない。正常の定期メール・同じ障害の毎時reminderは送らず、最初の異常または判定/理由enumの重要な変更だけを送る。復旧通知は人間の明示承認がないため無効。正常を観測してもincidentのfirst/latest証跡を自動解除しない。旧STOP・incident・PROPOSED gate・既存毎時reportは保持し、本候補へ接続しない。

本文は固定日本語・観測時刻・allowlist理由enumのみで4KiB以下。宛先1件、CC/BCC/添付/任意SMTP/例外文字列/raw provider/private ID/log/baseline/tokenを含めない。`send()`のmessageIdは受理情報で、本人inboxの受領証拠ではない。[公式API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)

## 上限と永続状態

1起動は120秒、各IOは10秒、GET本文1MiB/最大1024chunks（空chunk連続も停止）、serial取得、redirect/retry/backfillなし。API hard cap29、公開16、KV read1/write2、mail1、保守的aggregate cap49。成功時は通常CF14/公開16、deployment historyが前後8ページずつでもCF28。公開写真13を削らず、欠落/800件超/不整合historyはUNKNOWNにする。120秒終了は後続処理を止めるが、cancel不能なKV/mailの遅延完了を否定する証拠ではない。

KVは固定1 key/2KiB以下。scope digest、lastSlot、lastObserved、retainedIncident、lastAttemptのみ。取得前に状態を読み、同じ/古いslotはcredential参照前に終了する。incidentと送信RESERVEDを先に保存し、mail後にACCEPTEDまたはUNCONFIRMEDを保存する。send/保存が曖昧な場合は、NORMALや理由変更を挟んでも後続通知を保留する。観測は継続し、異常時はOBSERVED_MAIL_BLOCKED_BY_UNCONFIRMED_ATTEMPTで失敗扱いにする。本人が受領/不受領と保存状態を確認して明示的に解決するまで自動再送しない。この保守的選択には「初回や後続の重要通知を失う」可能性がある。

KV読取不可・破損・scope不一致はprovider/mailを止める。保存失敗はmailを止める。状態障害の通知自体も送れないため、運用者がWorker失敗と固定keyを確認する必要がある。KVはeventual consistencyでatomic ledgerではなく、別colo/重複起動/旧writeの遅配により重複通知やstate巻戻りが起こり得る。exactly-onceと単調保存は保証しない。Cron停止とEmail基盤停止も自己通知できない。[KV整合性](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

## 無料条件と未検証部分

確認済み本人宛はFreeを含む全planで無料、Email Routingだけでも利用でき、通常の月次/日次送信quota対象外。固定destination_addressとsender allowlistを使う。実宛先の確認済み状態と送信domain onboardingは別途必要。[料金](https://developers.cloudflare.com/email-service/platform/pricing/) / [binding](https://developers.cloudflare.com/email-service/configuration/send-bindings/)

Workers FreeのCron CPU10ms、128MB、外部subrequests50、接続6、account共有100,000 requests/day、Cron5件と、KV Free共有100,000 reads/day・1,000 writes/day・1GBを確認する。本コードの回数制限はCPU適合の証明ではない。写真2.8MiBのWebCrypto、最大JSON、state/mail処理を含むCloudflare上のCPUを測る必要がある。通常24起動/dayならCF最大672/公開384/KV read24/write48/mail最大24だが、実共有使用量と重複起動も合算する。[Workers上限](https://developers.cloudflare.com/workers/platform/limits/) / [KV料金](https://developers.cloudflare.com/kv/platform/pricing/)

同zoneへのfetchはCustom Domainで実確認する。合成試験の写真bodyはサイズとSHA判定のモデルで、実写真の再取得・decode検証ではない。ローカルbundle/Node試験はnative Cron/email/CPU/費用/受領の証明ではない。

## 設定前に一括で確定する判断

以下を実設定前の一つのreview packageにまとめる。今回この判断への回答や実設定は求めていない。

1. 対象accountと既存monitor同名resource、plan/共有枠/Cron空き、実Worker CPU10msの受入基準と0円条件。無料に収まらなければ停止しPaidへ自動変更しない。
2. 既存read-only credentialの必要scope/custodyとprivate baseline照合。毎deployの新token発行・失効を要求しない。設定権限は対象monitor Worker/KV/binding/Cronだけ、公開Site設定を変更しない。
3. Email Routing/既存MX・SPF・DKIM/既存メール用途、確認済み本人宛1件、送信元とbinding固定制限。競合時は既存メールを壊さない具体差分とrollbackを本人が採用するまで止める。[domain設定](https://developers.cloudflare.com/email-service/configuration/domains/)
4. KV状態障害の通知不能・eventual consistency重複/巻戻り・曖昧sendの未再送を受容するか。復旧通知は無効のまま、必要なら別の明示判断。
5. 対象と範囲を固定した本人向け異常/理由変更メール試験、inbox/spam確認、通常時無送信、24h自然Cron/CPU/費用確認。送信受理と実受領を別記録にする。
6. 無料枠超過、CPU超過、認証/JSON/shape不明、mail/state不明、本文漏洩、基準不一致の停止条件。Cron解除＋MONITOR_ENABLED=falseの停止/rollback手順とstate保持。旧Actions撤去は本番受領確認後の別工程とし、現候補では編集しない。
