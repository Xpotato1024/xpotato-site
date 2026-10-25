---
status: canonical
owner: operations
last_verified: 2026-10-25
canonical_for:
  - routine tool update and content publication execution sequence
---

# ツール更新・記事公開の実行単位

配布元のリリース作成、Site への取り込み、Site の配信は別の工程です。通常の版取り込みで配布元の全開発・リリース作業をやり直しません。承認範囲と失敗した工程を明らかにして、最後に成功した工程から進めます。

## ツールの固定版を更新する

1. 公開済みの正式版、対応する exact source commit、配布ファイル、hash、manifest、LICENSE / NOTICE / 対応ソース、source review と再現ビルドの証跡を固定します。新しいタグを作る作業が必要なら、それは配布元側の別工程です。タグ名だけで採用しません。
2. [取り込み契約](../contracts/browser-tool-adoption.md)に従い、clean checkout と公開配布物を照合します。`adopt` 自体が `verifyToolCandidate` を実行します。同じ入力で `verify` と `adopt` を無条件に続けて実行する必要はありません。`verify` は書き込みを伴わない確認が必要な場合に使います。管理対象のツールは installer の plan / apply、既存の手動登録はその契約に従います。
3. Site の選択 pin、capability 情報、file dependency / lock、source / license 表示を新しい版に合わせます。旧版を上書きせず、ContentId と route を維持します。依存反映は一度行い、失敗を無視せず、その工程を修正します。
4. 変更に関係する contract / regression と、実際の Site に合成した画面・主要操作を確認します。配布元で済んだ検証と Site 固有の検証を区別します。既存の結果を再利用する条件は [開発手順](development-workflow.md#再実行を増やさない実装検証運用)に従い、対象・差分・validator / lock / toolchain・制約を記録します。版だけの更新で機能全入力や長時間負荷試験を自動追加しません。
5. PR の最終 head の必須 CI / review を確認して通常マージします。現在の Site CI は vendored 配布物を検査して Site を build し、公開された配布元の source を clone / install / 再ビルドしません。repository-owned の小さな synthetic fixture のビルドは取り込み契約の回帰テストです。

## 記事・本文を公開する

[Site Content Publish](../../.agents/skills/site-content-publish/SKILL.md) と対象の content / media / Article Job 契約に従います。記事の主張、公開状態、ContentId、taxonomy、出典、必要な media receipt の審査を省略しません。一方、記事に変更がなければツール配布元の再リリースや全入力検証は不要です。記事・ツールは同じ Site release / deployment 経路を使います。

## Site の固定成果物を配信する

1. main push の successful producer run から Production artifact ID / API digest / source SHA / run / attempt を固定します。PR artifact は昇格させません。
2. [build artifact pipeline](build-artifact-pipeline.md) の consumer / handoff で元の archive と staging を検証します。main producer は Site を一度 build し、Windows consumer と deploy は再ビルドしません。
3. [現行配信条件](current-deployment-status.md)を満たす、承認済みの手動配信を一度実行します。Environment 等の必須保護は維持します。通常の変更で Dashboard の同じ画面を毎回人に要求する工程はありません。live provider precheck / preimage は workflow 自身が配信直前に実行します。設定変更・具体的な不一致があればその操作を止めます。
4. run の成功だけで完了にせず、保存された result、公開ページ・採用版・対応 source / license と対象 asset の一致、変更に関係する実動作を確認します。結果にはローカル・CI・配信・公開検証を分けて記録します。実機未検証を desktop emulation で置き換えません。

## 失敗時の再開

| 失敗した場所 | 維持する証拠と再開点 |
| --- | --- |
| source / artifact / review の不一致 | 採用しない。どの identity が不一致かを直し、その照合と影響する下流を実行する |
| PR の差分・型・テスト | 問題を修正し最終 head の必須 CI を通す。無関係な配布元のリリースを作り直さない |
| 同じ SHA の外部取得・ブラウザ起動等 | まずログと環境を分類する。根拠がある場合に失敗 job だけを限定再実行し、初回失敗と未確定原因を残す。検査条件を弱めない |
| main CI | 成功済み PR artifact を Production と呼ばない。main の未完了・失敗単位を回復して正規 artifact を固定する |
| dispatch の応答不明・配信後の失敗 | 新しい dispatch を送らず run / result / 公開状態を先に確認する。`manual-preimage.json` と `manual-result.json` を保持し、必要な復旧判断を報告する |

### checkout の生成ファイルが見つからない場合

「生成ファイル」という名前だけで、未生成の正常状態と判断しません。まず pinned commit の `ls-tree` / `ls-files`、ignore 設定、対応する generator と receipt、source archive、採用した runtime manifest を読み、Git 追跡済みの生成物か、build 後だけ存在する ignored 出力かを区別します。追跡済みのファイルは clean checkout の時点で存在する必要があり、取り込み前に配布元を再buildする条件ではありません。runtime に不要でも source 全体の照合から除外しません。

OS のセキュリティソフトによる検出・隔離が記録されている場合は `BLOCKED_ENV` として停止します。通常の欠落復元と同じ扱いで checkout / 再生成を繰り返さず、別の場所への展開・ファイル名変更・除外設定・保護停止で検査を通しません。時刻、対象、検出と処置の記録を必要最小限の非公開証跡として保持し、検出の正否を断定せず、必要な本人・セキュリティ上の判断を報告します。Git object や既存 source archive の照合成功は、隔離された checkout の受入成功へ読み替えません。

配布元の CI 修正中は、実際の pinned Actions checkout と annotated tag の形をローカル fixture で再現してから公開候補を固定します。新しい版・タグを試験用に次々作る方法は取りません。作成済みタグを無断で移動・削除せず、版追加が必要なら理由と範囲を明らかにします。

一連の承認では対象 PR / 版 / 取り込み / 配信と除外範囲を記録します。有効な後続の明示承認を古い Draft-only 指定と取り違えず、同じ確認済み内容の許可を繰り返し求めません。ただし実質的な範囲変更、実際の拒否、結果不明を承認済みと扱いません。
