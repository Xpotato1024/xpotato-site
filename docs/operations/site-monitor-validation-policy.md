---
status: proposed-code-tested-live-pending
owner: operations
last_verified: 2026-10-10
---

# 監視候補のrisk-based validation

本人承認に基づくcode/tests/Draft候補です。merge、追加provider GET、四hashの採用、baseline更新、監視・deploy有効化の承認ではありません。先行のversion-only 1 GETとcandidate診断1回の承認は消費済みで、本変更では追加取得しません。[監視・復旧の受入境界](site-integrity-monitoring-and-recovery.md)は維持します。

必須gateは期待account/token/Worker/version identity、activeと有効時刻、明示空bindings、既知のruntime・handler・container・export・migration・logging destination・tail consumer・placement mode・cache設定です。conditionsでは完全inventory、期待deploymentの単一version 100%、settings/script-settings/resources/subdomainの元JSON hash、公開home bytes、workers.dev/preview両falseと404、domain所有権・route不在・前後安定性も維持します。HTTP、認証、JSON parse等のtransport失敗は固定`transportCode`とFAILで表示し、provider本文やエラー値は出しません。token権限や設定を変更しません。

作者・annotation・tags・placementの解析時刻/status・version number・source・成功info等のincidental metadataについて、独自enum・空string・厳密format・個別byte上限を必須gateにしません。envelopeのsuccess=true、明示空errors、resultは必須です。optional messagesはJSON配列、optional result_infoはobjectを要求しますが、info内容は権限の証拠にしません。paginationの完全性はinventory用gateで独立検証します。固定presence/type/checkだけを出し、metadata値・未知key名・provider ID・binding/token値は出しません。

`handlers:null`は[公式Wrangler修正](https://github.com/cloudflare/workers-sdk/commit/80cc83403e2adb6e989455ba28743f282c5509c8)と[version GETが利用するApiVersion](https://github.com/cloudflare/workers-sdk/blob/fcf625da014474f656a962b9313dec54563f3573/packages/deploy-helpers/src/deploy/helpers/versions-api.ts#L16-L35)を根拠に許容します。NULL、省略、[]、['fetch']を別summary・別hashに保ち、NULLをhandlerなしと断定しません。etagは[公式GET schema](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/get/)のoptional stringに沿い、空文字も元JSON hashに保持します。summaryは省略`UNSET`・空文字`EMPTY`・非空`PRESENT`を区別し、値・長さを表示しません。etagの形式や存在でversion identityを代替せず、code/assets内容の証明も主張しません。公式bindingsはoptionalですが、空bindings確認のためのローカル必須gateは保持します。

未知configurationは非criticalと推定せず、settings/script-settings/resources/subdomainの元canonical JSONに含めます。固定`OPAQUE_*_SEMANTICS` warningと`coverage.unknownSemantics=NOT_PROVEN`を記録し、意味・初期安全性・baseline採用を保証しません。JSON budgetは32階層、32768 node、key/string合計1MiBで、accessor・非JSON・cycle・sparse配列を拒否します。これはhashの資源境界でありprovider schemaの主張ではありません。未知runtimeのOBJECT名や意味は依然未同定です。NULLやfieldを削除・補完・alias変換せず、変更時にはhash不一致で停止します。hashは変更検知用で、匿名化の保証ではありません。

version外側のmetadata/annotations/numberは既存`versionResourcesSha256`の対象外で、`VERSION_METADATA_OUTSIDE_HASH` warningとcoverageで明示します。settings側metadataおよびscriptのsourceは元settings/resources hashに含まれます。`resourcesSafe`等の既存check名のPASSは既知gateとbounded JSON通過を示すだけで、未知runtimeのsemantic safetyを承認しません。candidateは常にreview required、conditions一致もno live acceptance、全authority flagはfalseです。

critical違反は期待hashを一致させたfixtureでも停止する回帰、opaque hash drift、NULL/省略/空配列の区別、metadataで後続gateへ進むこと、固定warning vocabulary・getter不実行・budget境界・8KiB receiptをoffline検証します。既存CIのapproval/deployment/monitor/readiness/domain/collector/CLI suiteも実行します。custom-domain row固有のenabled/previews_enabled、tokenの権限上限、異常通知・復旧・監視開始のlive受入は本変更で証明せず、先行の未受入範囲を維持します。

candidate modeは`expected_source_sha`で承認された実行main SHAを指定し、workflowの`github.sha`一致とCLIの40桁lowercase hex/`GITHUB_SHA`一致をcredential参照前に要求します。不一致・欠落・型不正はGETなしで止め、mutable mainのdispatch raceで未reviewのcodeを実行しません。conditions modeと既存version-only modeの境界は変更しません。

1回の承認による最大5 GETは、実行hostの当該承認専用once ledgerでdispatch前に排他的に予約し、送信結果が不確定でも自動retry・rerun・budget再発行をしません。SHA一致guardとは役割が異なり、candidate全体へ恒久的な`run_attempt==1`制限や過去同SHAの診断禁止を追加しません。別途承認された開発rerunは可能で、元の5 GETを再利用したとは扱いません。先行run38025960270はmain CI・merge provenance・owner・seed一致の確認後に1回実行し、4 GET後のetag gateで停止したと固定receiptから推定します。予算は消費済みで、本修正の準備・検証はofflineのみです。

## 全candidate判定の目的

| 判定範囲 | 目的と維持する境界 |
| --- | --- |
| seed/source/dependencies | exact seed、期待identity、承認実行SHA、run provenance。provider IDはreceiptへ出さない。 |
| HTTP/credential/time/request budget | 固定5 GET以内、1 credential snapshot、redirect/retryなし、60秒deadline。 |
| JSON/envelope | ordinary bounded JSON、success=true、明示空errors、result存在。messages配列・result_info objectの内容はadvisory。 |
| token | exact ID、active、optional有効時刻。name/issued/modified等はauthorityにしない。 |
| settings/resources bindings | 明示空の確認。省略/null/非空を空へ変換しない。versionの空list/objectは元hashで区別。 |
| compatibility/usage/limits | 既知runtimeの許容方針。optional省略/空limitsは許容し、非JSON/不正型や範囲外は拒否。 |
| placement/cache | 既知execution/cache設定。省略/空placement/smartを保持し、未知modeやcache有効化をadvisoryへ落とさない。 |
| logging/trace/tails | 型・sampling範囲・既知propagation、空destinations/tails。任意の出力先をmetadataとして許容しない。 |
| version/resources/script/runtime | exact version ID・object形状。optional script/runtime省略と空objectは許容し、元resources全体をhash化。 |
| artifact descriptors | etag optional string、source/作者/外側number/metadataはbounded advisory。空と省略を補完せず、etagで内容を証明しない。 |
| handlers/named handlers/exports/containers/migration | NULL/省略/空/fetchの既知handler形状、空のnamed handlers/exports/containers、空migration tagは許容。非空の追加実行/状態移行は既存critical方針。 |
| opaque config/metadata | bounded元JSON hashと固定warning。未知keyを表示せず、semantic safetyはNOT_PROVEN。 |
| account subdomain | [公開GET](https://developers.cloudflare.com/api/resources/workers/subresources/subdomains/methods/get/)の必須stringとDNS label。conditionsのworkers.dev/preview URL形成に使うため維持。未知追加fieldはhash/warning。 |
| hash/receipt | 全5応答通過後だけ四hash、8KiB固定receipt、authority全false。conditionsではexact version IDと元resources hashの一致を別々に確認。 |

run38025960270の固定presence/type/check、[公開Wrangler assets-only E2E](https://github.com/cloudflare/workers-sdk/blob/80cc83403e2adb6e989455ba28743f282c5509c8/packages/wrangler/e2e/versions.test.ts#L599)のmain JSなし/nullable handler、公開account-subdomain形状から合成した一組をtoken→settings→script-settings→version→subdomainの全5 GETと実CLIへ通します。metadataの空/null/省略、optional artifact descriptors、etag空/省略/非空、subdomain label境界・不正型、exact versionとresources hash driftも組合せで検証します。公開E2Eはraw API response fixtureではなく、合成成功をlive成功とは扱いません。

残る未知は実際の5番目account-subdomain応答のenvelope/label、opaque runtime OBJECTの名称・内容・意味、code/assets bytesとresources descriptorの関係、custom-domain公開flag、token権限上限、通知/復旧/live acceptanceです。新しいstrict gateを追加せず、これらを合成値で補って証明したとは主張しません。
