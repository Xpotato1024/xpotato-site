---
status: proposed
owner: authoring
last_verified: 2026-11-13
---

# 本人確認済みの既成AI稿の公開準備

[ADR-0074](../design/adr/0074-owner-reviewed-existing-ai-publication.md)の実装候補です。通常のAI監査経路とは別のproducerを使います。実記事の確認資料や承認をこの文書から作ってはいけません。

## 適用条件と信頼前提

本人が既に確認した原稿・図の版と、immutable intakeの実bytesが対応している必要があります。operatorは接続チャネルの実際の認証済み本人発言を確認し、確認元、発言ID・日時、必要な前後関係、明確な意思の範囲を記録します。元発言とSHA-256の対応が分からなければ、準備のまま止めます。

コードは外部会話を認証しません。`ownerIdentityChecked`はoperatorが行った確認のattestationです。記事内の「確認済み」、approvedというファイル名、コピーした引用、JSONだけで本人の意思を推論しません。operator/API/Job directoryはtrusted local boundaryです。任意コード実行やこのdirectory全体を改ざんできる攻撃者に対する署名検証ではありません。

新たなTTY入力を必須にせず、既にある明確な本人指示を利用できます。ただしagentが本人の操作を代行したと偽ったり、未承認のexact対象を既存の承認へ足したりしてはいけません。別Job・別会話を含む最新の撤回・制限もoperatorが確認します。

## 準備だけを行う

正式なexisting_ai intakeから作成したJobで、sources/evidence/example評価と、権利・媒体計画を用意します。原稿と図を改稿せず、旧audit/journalは保持します。新しい外部AI実行やネットワーク権限は不要です。

```sh
node --import tsx tools/publication/media-publication.ts prepare-owner-subject --job <job-id> --visual-input <private-visual-input.json>
```

この入力ファイルは既存のstrictなvisual inputです。owner承認JSONの入口ではありません。出力は `prepared_owner_mapping_required`、`ownerConfirmed:false`、`storageWrites:0` です。private subjectにJob/spec/attempt、原稿・intake、本文とcompiled body、根拠・引用・例、権利、原画像集合と順序、canonical画像、generator/profileを固定します。

原稿はreceived intakeから作られたworking snapshotとの一致が必要です。working sources/evidenceの変更、stage receipt欠落・改ざん、例の未検証、画像の原本対応不明、未確認の媒体計画、権利不足は停止します。原稿全体hashが図の繰返し・配置を結び、figureOrderはfirst-use順序です。

## operatorの確認記録

専用 `attestOwnerReviewedConversation` APIは、正式producerのopaque preparation handleと、operatorが確認した実会話の正確な記録を受け取ります。通常CLIの `--from` やpackageの任意JSONから呼べません。handleをJSON化して再投入してもauthorityになりません。

private記録には以下を含めます。

- 確認元channel/conversation/message、受諾発言ID・実際の日時、逐語発言とhash、operator identity
- 意思の範囲 `accept_exact_previously_reviewed_content_and_figures` と選択版
- 確認した原稿bytesのhash、全原画像のassetId/hashとexact順序、図のfirst-use順序
- metadata除去、lossless正規化、上限内delivery resize、site-owned social cardの派生範囲

権利確認・媒体保存許可は別に維持します。derived encodingごとの再レビューを一律要求しませんが、新しいcrop/label/図の内容をこの派生範囲に入れません。heroはintake由来のlocal rasterが必要で、自動生成された新規heroは対象外です。新規posterも原本対応が必要です。

`recordedAt`はoperator記録を作成した時刻であり、AI監査時刻でも、本文を本人が読んだ日時の創作でもありません。

## packageへ進める

```sh
node --import tsx tools/publication/media-publication.ts prepare-owner-reviewed --job <job-id> --output .local/owner-publication.json
```

保存済みのcurrent operator receiptがなければ停止します。これは証拠を作るコマンドではありません。private subjectと実bytesを再構成し、現在のreceiptとwithdrawalを準備前後に再確認します。旧 `prepare` は従来の実AI監査経路のままです。

公開package/admissionは `verified-owner-reviewed-existing-ai-prepare-v1`、`reviewBasis: owner_reviewed`、`ownerReview`のsafe hashを使います。scopeはexisting_aiのままで、確認元会話・引用・private pathは公開しません。Media Registryは同じreceiptのownerReviewRefを持ち、visualAuditRefと混在しません。aiRunsの空配列は「このpackageに検証済みcurrent-run lineageを出力していない」ことであり、「AIを使っていない」という主張ではありません。

## 撤回と再利用

`withdrawOwnerReview`も実会話をoperatorが確認する専用APIです。**同じJob directory内**で元受諾発言を失効させ、別label/operatorや発言参照の並べ替えで再利用できません。撤回日時以前の別発言も拒否し、再開には本当に後の本人受諾が必要です。atomic withdrawal frontierの保存後にhistory copyが中断しても旧証拠は無効です。

これはglobalな承認台帳ではありません。別Jobで同じ古い発言を使うことをコードが自動検出するとは主張しません。operatorが最新の本人意思を確認する前提は各Jobで必要です。既にexport済み/main admission済みのpackageを撤回するには、別にmain admissionの削除・置換と未実行workflowの扱いを確認します。CIは選択したtrusted main commitのadmissionを使用し、local directoryを読みません。

## 保存・公開は従来の境界

[公開CI](article-media-publication-ci.md)のmain admission、本人manual dispatch、保護Environmentを通します。A/B/Cへの書込み・read-back・export・通常PR・CI・deployは別の実行です。updateは旧版の正確なGit preimageとContentIdを照合します。owner receiptがあっても保存・公開を自動開始しません。

実記事の対応未証明、権利不足、保存範囲不足、preimage不一致などはそのままblockerです。古いREVISION_REQUIREDは削除もPASSへの書換えもせず、新しい証拠種別が本人レビューであることを明示します。
