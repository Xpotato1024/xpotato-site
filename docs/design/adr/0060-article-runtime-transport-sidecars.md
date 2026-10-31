# ADR-0060: Article runtimeのtransport sidecarを正式jobと分離する

- Status: Proposed / local contract implementation only
- Date: 2026-10-30

## 問題

既存Article Jobにはhuman_localの内容reviewとmock保存があるが、semantic providerとServerの実保存接続はない。admissionやhuman recordを緩めて接続済みと扱うと、送信・保存の結果不明、重複実行、mock証跡の正式化を招く。

## ローカル実装で選ぶ範囲

- request・profile・入力artifactのhash、candidate/approval/policy/object集合を束縛したtransport sidecarを作る。
- 外部呼出しに先立つintent、verified/unknown、hash付き出力を別の私有journalへ保存する。pending/unknownは自動再送しない。既存job state、human audit/approval、実保存receiptへ変換しない。
- semanticでは既存admission compilerを再利用する。Skill/reference/response schemaを物理入力集合へ含め、strict出力検査、model/profile lineage、上限、予算、取消しを検査する。
- mediaではServer所有callbackで現在の承認・phase前提、policy、authoritative absence、exact-key署名を確認する。conditional PUT、前後の実bytes/metadata読戻し、publicからprotectedへの一致を検査する。署名・credential・resource設定をSiteへ移管しない。
- CLIはsecret-free descriptor/requestのinspectだけを提供する。desired、descriptor validity、observed policy、credential validity、mutation authorizationを分けて表示する。
- 現revisionの実行scopeはtest_fixtureだけ。operator_runtimeの呼出しはcallback実行前に停止する。実transport未接続のため、この成功を運用成功と呼ばない。

## 採用判断を残すもの

1. **正式semantic jobの入口**：human_localと区別したsemantic scope・stage receipt・独立監査の型を追加する案を推奨する。現在のhuman限定schemaをagentへ開放する案はhuman偽装になるため採用しない。source/evidence/author/auditからcandidate/exportまでの正式連鎖は後続実装と独立reviewが必要。
2. **Server接続形態**：信頼された同一process内のsession factory、またはoperator-owned別process/IPC bridgeが候補。現実装はcallback contractまでで、どの実行環境・principalが署名とpolicy読戻しを所有するかは未選択。JSON descriptorからcallbackや署名URLを組み立てない。
3. **結果不明の解決**：freshなprovider読戻しとoperation bindingからreconciliationを行う必要がある。現在のjournalはunknownの保持・再送停止まで。absenceを理由とする再送、operator reconciliation record、正式stage復帰の運用は未実装で、無確認の自動retryは導入しない。

本ADRはdesign lifecycle、外部AI activation、resource realization、credential発行、公開承認を変更しない。
