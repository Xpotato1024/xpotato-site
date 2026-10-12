---
status: proposed
owner: operations
---

# 有限自然試運転の準備手順候補

この手順は未採用のschema5候補であり、実日時・認可recordは未選択。現在のDraftをmerge・設定・dispatchする指示ではない。旧03–05 UTC未開始／04–06 UTC開始保留の認可を再利用しない。設計と実装の範囲は[事前登録設計](site-monitor-armed-window-proposal.md)、保存の有限retry・閲覧・wall-clock限界は[保存契約](site-monitor-finite-executor.md#native保存の有限上限と閲覧範囲)を参照する。

## 先に完了させる準備

実運用への別の許可によりコードをmainへ採用した後、最終main SHAとそのCI成功を確認する。Draft headをmerged mainの代わりに使わない。準備完了までTを選ばず、完了後もTまで少なくとも60分を確保することを推奨する。これは運用上の余裕であり、コードの新しい時間枠や予算ではない。

公開情報だけで、main/source、既存workflow、owner/triggering-owner、attempt1、実Site最新runのID/番号/完了・時刻順序、evidence workflow最新番号を確認する。Site最新runがpending/in_progress、番号・sourceが不明、完全なprefixが確認できない場合は進めない。古いcompleted runを最新番号の代用にしたり、次の番号を予測したりしない。秘密値をread/exportせず、既存baselineの公開digestとaudit/checkpointの一致、既存secret名、debug無効・retention>=7日の実行条件を確認する。必要な値や条件が不明ならBLOCKEDにする。権限・secret・provider設定を修正して進める手順ではない。

immutable audit rootからEまでの日partition数と登録時の既存履歴件数を用いて、完全履歴が本体GH56／collector GH64に収まる余裕も確認する。例えばcollectorの保守見積りは開始前receipt確認最大4 GET＋自身GET1＋audit root GET1＋全partitionページ＋全対象Site runのjobs GET。開始前確認も同じGH64内で消費し、E後の収集は残り60〜61 GETを使用する。登録後最大48番号とcutoff境界runの可能性も明示し、収まらない場合は開始しない。追加run・削除・API count driftが起きれば、この見積りがあってもUNKNOWNになり得る。過去履歴を切り捨てたり、GET枠を増やしたりしない。準備用の公開metadata確認は本人の準備read scopeに明示し、GH1600のexecutor枠に隠れたpollerを追加しない。

## 一回の本人recordと開始前締切

Tは観測開始、E=T+2時間、保存期限はE+1時間。登録AはTより前の最大30分で、ここではAをT−20分程度に置く。Aは実登録snapshotを固定した時刻であり、将来のrun ID/番号を先に埋める時刻ではない。

一回の本人採用recordに、最終main source、実A/T/E/保存期限、実Site登録ID/N、evidenceの既存番号と次の一番号、owner decision digest、取得scope、保存scope、開始前abort・終了時closeの管理操作scopeを固定する。取得上限はmetadata48×GH4＋期間内24×GH56＋collector GH64=GH1600、CF768/public72。保存は公開read access閲覧範囲、単一128KiB JSON、7日、overwriteなし、論理一回、固定native actionの有限retryとplatform timeoutの残余リスクを明示する。管理操作scopeは本人recordの別の説明欄で明示し、exact schema5 JSONへ未知keyを加えない。Git側のPROPOSEDをapprovedへ書換えて再mergeする承認ループはない。

| 時点 | 操作・確認 | 間に合わない場合 |
|---|---|---|
| T−60分より前 | main source/CI・公開条件・容量・保存契約の準備を完了 | Tを選ばない |
| A≒T−20分 | 実ID/Nとevidence番号をsnapshotへ固定し、一回の本人recordを採用 | 認可なしでは設定・dispatchしない |
| T−15分までを目標 | `SITE_MONITOR_RUNTIME_GATE_JSON`へそのschema5 ARMED recordを一回設定し、canonical gate fingerprintをreadback照合 | 途中失敗・不一致ならSTOP |
| A以後、T−15分までを目標 | 既存manual-only evidence workflowを一回だけmainからdispatch。入力は`expected_source_sha`と`expected_gate_sha256` | 失敗でもreplacement dispatchしない |
| T−10分を準備完了締切 | 実evidence run ID/番号=固定次番号、attempt1、main/source/actor一致、予約・first-wait receiptと同digestの公開step成功、collect step開始/in_progress、失敗なしを公開metadataで照合 | 開始前abort。T直前に再設定・再dispatchしない |
| T〜E | 既存自然scheduleのみで有限read。端末操作やモデル待機を開始条件にしない | 疎到着・新failureは補填せず保持 |
| E以後、E+1時間より前 | 起動済みcollectorが完全履歴収集と一回保存・receipt照合を行う | UNKNOWN/保存未確認を成功に変換しない |

T−15/T−10分は推奨する運用締切であり、コードの許容範囲を拡大するものではない。本人recordの採用が遅れ、開始前abortの管理権限も未採用なら、そもそもARMED設定・dispatchを始めない。T/A/Eを後から延ばすことはしない。

開始前の非秘密receipt候補は `prepare-wait` がexclusive予約のfsync後に実evidence run/source/owner/attempt/番号・登録root・Aからの完全公開prefixを最大4 GETで確認し、最初の1000ms待機完了後に生成する。local `wait-ready.json` はno-overwrite/fsync、公開log/summaryはexact allowlist JSONだけで、artifactを増やさない。receiptはgate/audit digest、実run作成時刻、登録ID/N/A、prefix ID/番号/digest、予約GH64/論理保存1、消費/残GET、待機開始/first-wait完了、T/E/保存期限を束縛する。baseline/provider/secret/raw response/signed URL/ログ本文を入れない。

pure `assessEvidenceWaitReadiness` は本人が固定したgate/audit/sourceとreceipt、実GitHub run/job/stepsを入力に、`Reserve and begin finite wait` 成功、`Evidence wait started <receipt digest>` 成功、後続collect開始、identity・番号・時刻順序・準備締切を全て要求する。collectのin_progressだけ、receiptだけ、途中crash/cancel/failed/queuedは準備完了にならない。これはfsync予約と最初の待機が完了した歴史的証拠であり、その後の連続稼働や将来到着を保証しない。GitHub metadataの取得・判定自体に新pollerを接続しない。

公開log/summaryの閲覧・保存期間はrepository/platformの設定に従い、artifactの7日指定では消えない。この非秘密metadata公開scopeも本人recordで説明する。後続collectはcanonical receipt・元予約marker・期待digest/source/runを再確認し、exclusive `collection-consumed` markerを作って残GETを一回だけ引き継ぐ。予約後receipt前、receipt後collect前、collect消費後のcrashでも修復・再発行・枠返却はしない。期限超過や改変はcredential参照前に拒否する。端末CLI hookや既存毎時taskを代替証拠にしない。

## 外部変更と待機・開始・保存

将来必要な外部操作は、許可されたmain採用、既存repo変数への固定ARMED record設定、そのreadback、一回の既存manual workflow dispatch、必要時のrun cancel／新runを閉じるPROPOSED化、既存native actionによる一回のartifact保存。これらは今回未実行で、本人recordの該当scopeが必要。新schedule・新secret/token・権限/Environment/provider設定・専用uploader・Server push・毎時task接続は不要であり、この手順から認可しない。GitHub UIでも同じ変数・workflow・二つの入力を使え、端末の観測hookは必須ではない。

evidence workflowは実次番号/attempt1をexclusive予約し、開始前receipt確認のGH最大4 GETと最初の待機を経て、後続collectがEまで待機する。以後の待機中GH/CF/public GETをしない。prepare timeout2分、collect timeout154分、job160分で30分前待機＋2時間観測＋有限収集/保存を包含する。T前の自然runはNoIo/body skippedまたは全job skippedとして保持する。T後に動いたcreatedAt<Tの遅配runも観測枠を使わず、public current GET1でNoIoを判定する。Tからの期間内runはmanual/skip/failureもordinalを消費し、自然成功へ代入しない。登録・番号・期限・quotaを更新して枠を返さない。

観測本体はmetadata admissionと共通120秒/Eの短い期限で完全履歴・ordinal・登録・作成時刻・job/receiptを再確認してからCF/publicへ進む。新trial失敗の後続ではprovider取得を止め、期限後はcredential callback参照前に止める。各GET10秒/1MiB/no retryは同じ。

Eでcollectorは元の固定recordを用いて一回だけ収集する。初回収集は保存期限まで厳密に240秒より多い余裕を要求するため、遅れた場合の最終開始はE+56分より前。upload admissionは120秒より多い余裕を要求するためE+58分より前。saved receiptはE+1時間より前に成立しなければ保存成功と報告しない。通常はE直後から自動的に進むが、pending job、API遅延、予算超過、runner停止があればUNKNOWN/STOPであり再収集しない。

成功したnative出力だけを用い、collector run/attempt/source、gate digest、artifact ID/zip digest、実JSON bytes digest/sizeを照合する。artifact IDだけ、upload開始だけ、receipt欠落だけでは保存完了にしない。runner pauseやcancel graceを含む絶対wall-clockの保存期限保証はない。期限後write/credential参照0を絶対条件にする採用ならnative保存scopeはBLOCKEDのまま。独立したobserver通常イベントの実受領は別の未確認項目であり、artifact保存や遅いpure評価で代替しない。

## 失敗・中止・終了時

開始前締切を満たさなければ、採用済みの管理scope内で新自然runを閉じるPROPOSED化と起動済みevidence runのcancelを行い、未開始/中止と記録する。gate/dispatchの一部が通った場合も、番号・exclusive予約・論理保存枠を返金しない。同recordで新日時やreplacement runを作らない。

開始後の新failure・未知identity/proof・期限超過はSTOPとして保持する。新自然runを閉じる操作は採用された管理scope内だけで行う。すでに起動済みcollectorはjobに渡された元のrecordと保存認可の範囲で失敗/UNKNOWNの証拠を一回収集できるが、全scopeを撤回する指示ならcancelして保存しない。変数を途中で閉じる操作は元recordの期限・digest・番号の再承認や延長ではない。collectorの元record/snapshotが確認不能なら成功を前提にしない。

保存に失敗・出力欠落・receipt期限超過があれば保存未確認とし、artifactが存在する可能性と保存成功の照合を区別する。overwrite・再upload・delete/recreate・run rerunをしない。自然runの期限停止はコード内で行い、終了後は採用済み管理scopeでruntimeを閉じる。事実としてrun/attempt/source/番号・conclusion・非秘密receiptだけを残し、raw provider、baseline、secret、ログを証拠JSONへ加えない。過去incidentを解除しない。

## 試運転で分かることと残ること

実施できた試運転では、固定sourceによる自然runの実到着、NoIo/遅配の扱い、bounded readの一致/停止、完全history/jobs/固定receipt、native一回保存とdigest束縛が成立したかを確認できる。自然coverageは13success以上、created span>=3600秒、created/completed gap・完了遅延<=600秒、first.created<=T+600秒、last.created>=E−600秒の全条件を要求する。疎到着ならNOT_CONFIRMED、欠落・不完全収集ならUNKNOWNであり、manual成功や時刻延長で救済しない。

自然scheduleが数時間空いた原因は未特定のまま。2時間の成功で将来の安定や到着SLA、scheduler provenanceを保証しない。過去incident保持、liveFreshness=NOT_ASSESSED、schedulerProvenanceVerified=false、deploy/publication/acceptance=falseを維持する。observer通常イベント実受領、長期間の安定、将来のAPI/runner挙動はこの固定windowのcoverageとは別で、試運転後も未確認なら明示して残す。
