---
status: proposed-code-tested-live-pending
owner: operations
last_verified: 2026-10-10
---

# 監視候補のrisk-based validation

本人承認に基づくcode/tests/Draft候補です。merge、追加provider GET、四hashの採用、baseline更新、監視・deploy有効化の承認ではありません。先行のversion-only 1 GETは消費済みで、本変更では追加取得しません。[監視・復旧の受入境界](site-integrity-monitoring-and-recovery.md)は維持します。

必須gateは期待account/token/Worker/version identity、activeと有効時刻、明示空bindings、既知のruntime・handler・container・export・migration・logging destination・tail consumer・placement mode・cache設定です。conditionsでは完全inventory、期待deploymentの単一version 100%、settings/script-settings/resources/subdomainの元JSON hash、公開home bytes、workers.dev/preview両falseと404、domain所有権・route不在・前後安定性も維持します。HTTP、認証、JSON parse等のtransport失敗は固定`transportCode`とFAILで表示し、provider本文やエラー値は出しません。token権限や設定を変更しません。

作者・annotation・tags・placementの解析時刻/status・version number・source・成功info等のincidental metadataについて、独自enum・空string・厳密format・個別byte上限を必須gateにしません。envelopeのsuccess=true、明示空errors、resultは必須です。optional messagesはJSON配列、optional result_infoはobjectを要求しますが、info内容は権限の証拠にしません。paginationの完全性はinventory用gateで独立検証します。固定presence/type/checkだけを出し、metadata値・未知key名・provider ID・binding/token値は出しません。

`handlers:null`は[公式Wrangler修正](https://github.com/cloudflare/workers-sdk/commit/80cc83403e2adb6e989455ba28743f282c5509c8)と[version GETが利用するApiVersion](https://github.com/cloudflare/workers-sdk/blob/fcf625da014474f656a962b9313dec54563f3573/packages/deploy-helpers/src/deploy/helpers/versions-api.ts#L16-L35)を根拠に許容します。NULL、省略、[]、['fetch']を別summary・別hashに保ち、NULLをhandlerなしと断定しません。etagは[公式GET schema](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/get/)のstringに沿い、非空stringとしてhash化し、32/64桁hexを必須にしません。公式bindingsはoptionalですが、空bindings確認のためのローカル必須gateは保持します。

未知configurationは非criticalと推定せず、settings/script-settings/resources/subdomainの元canonical JSONに含めます。固定`OPAQUE_*_SEMANTICS` warningと`coverage.unknownSemantics=NOT_PROVEN`を記録し、意味・初期安全性・baseline採用を保証しません。JSON budgetは32階層、32768 node、key/string合計1MiBで、accessor・非JSON・cycle・sparse配列を拒否します。これはhashの資源境界でありprovider schemaの主張ではありません。未知runtimeのOBJECT名や意味は依然未同定です。NULLやfieldを削除・補完・alias変換せず、変更時にはhash不一致で停止します。hashは変更検知用で、匿名化の保証ではありません。

version外側のmetadata/annotations/numberは既存`versionResourcesSha256`の対象外で、`VERSION_METADATA_OUTSIDE_HASH` warningとcoverageで明示します。settings側metadataおよびscriptのsourceは元settings/resources hashに含まれます。`resourcesSafe`等の既存check名のPASSは既知gateとbounded JSON通過を示すだけで、未知runtimeのsemantic safetyを承認しません。candidateは常にreview required、conditions一致もno live acceptance、全authority flagはfalseです。

critical違反は期待hashを一致させたfixtureでも停止する回帰、opaque hash drift、NULL/省略/空配列の区別、metadataで後続gateへ進むこと、固定warning vocabulary・getter不実行・budget境界・8KiB receiptをoffline検証します。既存CIのapproval/deployment/monitor/readiness/domain/collector/CLI suiteも実行します。custom-domain row固有のenabled/previews_enabled、tokenの権限上限、異常通知・復旧・監視開始のlive受入は本変更で証明せず、先行の未受入範囲を維持します。

candidate modeは`expected_source_sha`で承認された実行main SHAを指定し、workflowの`github.sha`一致とCLIの40桁lowercase hex/`GITHUB_SHA`一致をcredential参照前に要求します。不一致・欠落・型不正はGETなしで止め、mutable mainのdispatch raceで未reviewのcodeを実行しません。conditions modeと既存version-only modeの境界は変更しません。

1回の承認による最大5 GETは、実行hostの当該承認専用once ledgerでdispatch前に排他的に予約し、送信結果が不確定でも自動retry・rerun・budget再発行をしません。SHA一致guardとは役割が異なり、candidate全体へ恒久的な`run_attempt==1`制限や過去同SHAの診断禁止を追加しません。別途承認された開発rerunは可能で、元の5 GETを再利用したとは扱いません。今回のhost driverは非公開workspaceで準備・合成検証のみとし、main CI・merge provenance・owner・seed一致・予約のreviewを済ませてから最終headの実行承認を求めます。まだprovider GETを実行しません。
