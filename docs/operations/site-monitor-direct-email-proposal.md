---
status: proposed
owner: operations
last_verified: 2026-10-12
---

# 毎時検査から確認済み本人メールへ直接通知する最小候補

本人が選択した構成はCloudflare Workersの**Cron Triggers → 検査 → send_email binding → 確認済み本人メール**。Cloudflare Workersは製品、Cron Triggersは定期起動機能、xpotato-siteは現在の公開サイト実体。Healthchecks.ioは本人不採用で導入しない。Gatusの完成は前提にせず、既存の補助確認候補に留める。本書は設計のみで、実装/稼働/無料枠適合/実受領は未確認。

## 無料送信と導入前条件

確認済みdestinationへの送信はFreeを含む全planで無料。Email Routingだけでも利用でき、月次quotaと日次送信枠へ算入されない。未確認宛先への有料Email Sendingは不要。この条件はWorker実行/任意のKVまで無料成立を証明するものではない。[料金](https://developers.cloudflare.com/email-service/platform/pricing/) / [制限](https://developers.cloudflare.com/email-service/platform/limits/)

- 送信元は本人管理のrouting domain内、宛先は同accountで本人が確認済みの一件。bindingのdestination_addressで宛先を固定し、senderも固定/許可範囲を検証する。CC/BCC/任意宛先・SMTP資格情報・新mailboxは使わない。実メールaddressをこの公開設計へ記載しない。[binding](https://developers.cloudflare.com/email-service/configuration/send-bindings/)
- xpotato.netの現在のEmail Routing/既存メール利用は未確認。MX/SPF/DKIM/DMARCと現provider、受信・送信・転送の用途を本人同意のread-only調査で確認する。Email Routingは既存外部mail serverとの競合やroot MX変更を伴い得る。自動有効化や既存record削除をせず、必要な変更・影響・rollbackを本人が承認するまで導入停止。別domain/subdomainを黙って追加しない。[domain設定](https://developers.cloudflare.com/email-service/configuration/domains/)
- 本人指定の工程は **PR65の本番配信確認 → 監視用Cloudflare Workerの作成/適用 → 不要な旧GitHub Actions撤去**。監視Workerを作るのは親からPR65配信完了を受け取った後。公開xpotato-siteへ監視bindingを混ぜず、対象baselineは新たに実配信されたA案のdeployment/artifact/bodyと照合して本人が承認する。未公開main/PR headだけで固定しない。
- Email ServiceやDNSの有効化、宛先確認操作、Worker/KV作成、binding/secret設定、実送信、Cron開始は今回未実施。既存hourly dot/automationも変更しない。

## 検査と状態

毎時UTC、1起動で必要な公開status/期待body、deployment/version/設定/domain/routes/preview非公開を点検する候補。同zone Worker間fetch制約を確認し、対象Custom Domainの公開GETを受入時に検証する。Cloudflare内の観測を独立外部からの可用性証明とはしない。baselineは本人承認した**実deploy済み状態**に固定し、未公開mainへ自動追従しない。管理APIは限定read-only credentialとscope、公開だけなら構成NOT_CHECKEDと区別する。必要点検の未実行をPASSへ丸めない。

| 観測 | 本人へ伝える内容 |
| --- | --- |
| 公開status/body/previewの不一致 | 「サイト応答の異常」。設定を読めなければ「設定も確認不能」を残す |
| 公開正常だが承認済み構成と違う | 「サイトの設定に不一致」。サイト停止とは断定しない |
| API拒否/timeout/不正JSON/必要field欠落/oversize/未完pagination/取得中変化 | 「設定を確認できません（UNKNOWN）」。公開正常でも解消しない |
| 必要な全検査が成功 | 「今回の確認は正常」。以前の不良が確認できる場合だけ「前回の異常/確認不能から戻った」と表現 |
| send_email拒否/timeout/exception | 「通知送信未確認」。送信済み/本人受領済み/サイト復旧へ変換しない |
| Cron未起動・crash・Cloudflare/Email Service同時停止 | 本方式から通知できない可能性。自己停止検知の保証なし |

検査理由・観測日時・前回からの状態変化・「まだ対応が必要か」を短い日本語で送る。raw provider、secret、private baseline、token、ログ、private ID、例外文字列を含めない。本文4KiB以内、添付なし、宛先一件、1起動の送信試行は最大一回。同じ起動内のretry/backfillは作らない。

## 継続障害・復旧と最小状態

初期の状態なし構成なら、毎時まだ不良/UNKNOWNのとき「まだ解消を確認できていません」と再通知する。NORMALは現在の結果だけを表し、記憶のない過去障害からの「復旧」を断定しない。正常時の定期メールを必要とするか、継続通知を毎時にするかは本人が開始前に決める。

最初の異常・理由変更・復旧を通知し、同じ障害のreminderを例として24hに抑えたい場合だけ、小さいKV状態を候補にする。1 key/512 bytes程度にlastObserved分類/時刻・lastAcceptedMail分類/時刻・理由enumだけ。raw/baseline/メールaddress/credentials/history台帳を入れず、毎時最大1 read/1 write＝各24/day、list/delete不要。Free枠100,000 reads/day・1,000 writes/day・1GBはaccount共有、UTC日次reset。既存使用量とplanが未確認なので追加費用0円は未成立。[KV料金](https://developers.cloudflare.com/kv/platform/pricing/)

send成功後だけ「送信受付」を進め、送信失敗時は次の自然Cronで再評価する。KV不明/破損時は状態不明を通知し、正常/復旧を捏造しない。送信成功後のKV write失敗やcrashで重複が起き得る。KVはeventual consistencyでatomic ledgerではなく、全体順序やexactly-onceを保証しない。古い/重複の結果、send失敗→NORMAL、状態破損を合成検証する。重い台帳/D1/Durable Objectsを自動追加しない。[KV整合性](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

send()受付/messageIdは本人のinbox受領証拠ではない。timeout後に基盤側送信が完了する可能性もあり、送信なしの証明ではない。RATE_LIMIT/宛先未確認/抑止/配送失敗も成功にしない。本人の実受領とspam/転送を別に確認する。[Workers email API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)

## 無料枠と実装差分の候補

現在checkerのCF GETは11+Z+P1+P2で通常14/最大28、hard cap32、公開最大3 GET。毎時ならCF最大768/public72 GET/day。メール最大24試行/dayは上記verified宛先なら送信quotaへ算入しない。これら日次数は重複なしの通常24起動の試算で、重複invocationがある日の絶対上限ではない。shared枠には実際の重複も含めて測る。GitHub history scan/artifact collectorは不要。

Workers FreeのCPU10ms、128MB、外部subrequests50、同時接続6、account共有100,000 requests/day、Cron空きと追加課金0を確認する。fetch待機はCPU外だがdecode/hash/JSON/メール組立/KV処理はCPUを消費する。32+3のGETとbinding/KVを含む数え方/実測を確認し、10ms適合を静的数だけで保証しない。追加課金0が成立しなければ導入保留とし、Paid upgrade・有料保存・新server・AI定期runで解決しない。[Workers制限](https://developers.cloudflare.com/workers/platform/limits/) / [料金](https://developers.cloudflare.com/workers/platform/pricing/)

実装時の差分はscheduled handler、既存bounded checkerのWorker互換比較、固定宛先send_email、必要なら小さな通知状態だけ。node:crypto/Buffer CLIをそのままdeployしない。GET10秒/1MiB/no retry・検査/通知合わせ120秒の候補で、送信処理の時間を残す。未完点検はUNKNOWN。旧全history/64 GET台帳/2h collector/600秒continuity/端末hookを移植しない。

## 限界と責務

Cron自体とメール送信自体が同じCloudflare基盤で止まれば自己通知できない。広域障害、email配送/spam、本人不在もあり、無停止や通知到達上限を保証しない。既存毎時dotを補助候補にできるが、自己停止検知を保証せず、automation変更/接続は別認可。外部監視サービスを新設しない。

既存Gatusは補助候補のみ。[Server Draft73](https://github.com/Xpotato1024/Xpotato-Server/pull/73)のconfig/isolated/persistent artifact候補は実装済みだが、CP runtime接続、必須SMTP TLS、alert/resolved実受領は未受入。現rendererの公開checkはAuthelia/Nextcloud/Immichで、xpotato.net追加も未実施。Gatus完成を本案の前提にしない。Serverは今回read-onlyの責務整理だけで変更しない。

## 工程順・最小試験・導入前の本人判断

1. PR65のA案merge/deployと親の本番配信確認を待つ。今回はPR65を操作しない。新deployment/bodyと必要な構成のbaselineが未確定のため監視Worker作成/適用は行わない。
2. その後の認可済みread-only調査でEmail Routing現設定・既存mail用途/MX/SPF/DKIM・確認済み本人宛先・送信元・read-only credential scopeとcustody・共有無料枠を確認。既存メールを壊さない変更/rollbackへの本人同意と、継続通知間隔/最小KV要否を確定する。実設定/secret/read/送信は今回未許可。
3. 実装前の合成試験は公開不一致/構成差分/UNKNOWN分離、公開PASSでUNKNOWNが消えない、実deploy済みbaseline固定、固定宛先拒否/送信error、受付と受領分離、継続/復旧/重複/状態破損、最大payload/CPU/時間/GET数を対象にする。今回は実装や合成E2Eを実行していない。
4. 許可後に監視Workerのみ作成/適用し、本人への制御された異常・継続・復旧メール実受領と、約24hの自然Cron/費用増0を確認する。Cron変更は反映遅延があり実際の観測を確認する。[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
5. 新方式の本番受入後だけ、本人指定の次工程として不要な旧Actionsを選別する。監視/evidence workflowと一般CI/deployを混同せず、削除対象/停止/rollbackをreviewする。旧Actionsを先に削除・有効化・試行しない。既存hourly automationも変更しない。

旧STOP/incident/runtime gate PROPOSED・公開禁止は保持し、新メールの正常/復旧を過去incidentの解除へ転用しない。今回のscopeは設計文書と必要差分/試験の整理、独立レビュー、Site Draftまで。provider GET、DNS/Email設定、Worker/KV作成、credential読取、実送信、dispatch/artifact保存、実trial、旧workflow削除、Ready/merge/deployは未実施。
