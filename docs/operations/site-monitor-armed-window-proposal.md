---
status: proposed
owner: operations
---

# 事前登録できる有限自然観測候補

この候補はschema4の事前ACTIVE化を行わない。03:00–05:00 UTC試運転は未開始で停止し、04:00–06:00 UTC枠も開始保留された。旧scopeを延期・再実行へ流用しない。実runtimeは旧PROPOSEDのまま、新candidateのmerge・設定・dispatch・provider取得は今回の作業範囲に含めない。

## 設計変更を先に明示する

schema4は準備時のafterRunNumberより後の24番号を固定している。T前に自然runが一つ入るだけで番号が消費され、次の履歴検証はpre-T番号を拒否する。日時を未来にするだけでは正常開始しない。schema5は準備時の実run ID/番号をregistrationへ固定し、別に最大48番号のmetadata確認領域を固定する。予測anchor・実行中の番号更新・返金を使わない。

provider観測は、完全な登録後prefixから計算するT<=createdAt<Eのrunのimmutable番号順ordinal1..24に限定する。manual、skip、failure、source違反も期間内の枠を消費し、後続providerを停止する。T前runは観測枠ではないが、完全履歴へ保持し、gate digest付きNoIo receiptとprovider body skipped、または全job skipped/実job0件の不実行証拠を要求する。cancelled conclusionだけを不実行証拠にはしない。未知・pending・欠落はSTOP/UNKNOWNであり成功へ変換しない。

予算配分を変更するが総上限は増やさない。登録後48番号の各metadata確認にGH4、期間内の最大24観測枠の各追加検証にGH56、collectorにGH64を固定予約する。48*4+24*56+64=1600 GET。各観測は合計最大60 GETで旧上限64以内、CF32/public3の24枠=768/72を維持する。実際の観測・証拠型と予算配分はschema5として明示し、旧schema4 recordを暗黙に読み替えない。

## 登録・開始・証拠

登録AはTより前の最大30分。review済みsource、A/T/E、実registration run ID/番号、evidenceの次の一番号、owner decision digest、取得/保存scopeを一回の本人recordへ固定する。T/E、registration、quotaは途中で書き換えない。既存自然scheduleは変更しない。

自然runのpublic admissionをprovider bodyから分離する。T前はGH/CF/public GETとprivate baseline参照をせず、gate fingerprintを束縛したNoIo receiptを返す。T後の遅延pre-T runはGH metadataだけでcreatedAt<Tを検証し、NoIo receiptを残す。bodyのsecret envはadmissionが成功した場合だけ設定する。

GH4のmetadata確認はcurrent GET、実registration root GET、floor(A)..nowの全UTC partition（最大2つ）を読む。rootは固定ID/番号・completed・updatedAt<=Aを検証し、登録後prefixと結合する。N+1..current−1全番号連続性を検証してからordinalを計算する。A前に遅れて発見された登録後番号も欠番ならSTOPする。追加GH56でimmutable audit rootから完全履歴・同ordinal・固定registration・current作成時刻・全必要job proofを再検証してからCF/publicへ進む。古い監査履歴で56/64 GETを超える場合もSTOPし、完全性を落とさない。未知・count drift・番号gap・scope不一致はSTOP。metadata確認とbodyは同じ120秒/Eの短い方の期限を使い、段階ごとに時間を再付与しない。各GET10秒/1MiB/no retry、exclusive/fsyncのrun ID namespace、attempt1、crash後の補填なしを維持する。

manual-only evidence workflowはA以後T前に一回dispatchできる候補とし、固定run番号のexclusive予約を先に消費してEまで待つ。待機中GETなし。前待機30分+観測window120分を含めjob160分、collect154分、upload2分の有限timeout。collector GH64、JSON128KiB一つ、7日/overwriteなし、固定native actionと内部retry契約、digest/run/attempt/source/artifact束縛は維持する。collectorは自然観測として数えない。

## 意味を変えない結果

tracked [schema5 template](site-monitor-armed-runtime.example.json)はPROPOSEDのまま。実開始前の一回の本人採用recordに最終merged main SHA、A/T/E、実登録ID/N、evidence次番号、GET配分、read/storage scope、公開repoのログイン済みread access閲覧範囲、native有限retryとplatform timeoutの残余リスクを固定する。Git側のPROPOSEDをapprovedへ変更して再mergeする手順はない。CI・source・scope検証はAより前に終え、Aで登録と一回のevidence dispatchを済ませる。T直前の端末操作やモデル待機を開始条件にしない。旧03–05/04–06承認は流用しない。

保存のretry/閲覧/厳密wall-clock限界は[既存native保存の公式source調査](site-monitor-finite-executor.md#native保存の有限上限と閲覧範囲)を維持する。job timeoutだけを前待機分へ延長し、upload step2分・128KiB・7日・overwriteなしは維持する。実uploadとobserver実通常イベント受領は未検証であり、合成結果から保存完了やlive正常を主張しない。

自然coverageは13success以上、created span>=3600秒、created/completed gap・完了遅延<=600秒、first.created<=T+600秒、last.created>=E-600秒のまま。NoIo/manualを成功観測へ数えない。historicalIncidentRetained=true、liveFreshness=NOT_ASSESSED、schedulerProvenanceVerified=false、公開/deploy/acceptance=false。observer実通常イベント受領は別の未検証gateで、毎時readonly taskへ接続しない。

## 自然schedule調査

公開metadataでは#8 2026-10-11T14:24:02Z、#9 19:05:38Z、#10 22:50:07Z、#11 2026-10-12T01:51:56Zで番号が連続していた。各source c6560ed/97baab2/66e4a5bとmain41c8f8cのcronは2-57/5で同じ。workflowはactive、repoは非archived/non-disabled、default branchはmain。疎な到着の原因は未特定。jobのskippedは観測不実行を示すが、run未作成の数時間間隔の原因を説明しない。

[GitHub公式schedule説明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)には高負荷での遅延・queued jobのdropがあるが、このrepoの原因と断定しない。この修正は準備・境界の安全性を直すもので、自然scheduleの到着SLAやcoverage PASSを保証しない。manual有限観測を新設する案は別の目的・認可・証拠型として扱い、自然13successに代入しない。
