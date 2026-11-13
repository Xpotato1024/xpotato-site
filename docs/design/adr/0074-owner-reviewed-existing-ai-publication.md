---
status: proposed
date: 2026-11-13
---

# ADR-0074: 本人確認済みの既成AI稿を別証拠で公開準備する

## 背景

本人が既に確認した本文・図をそのまま使う依頼に、独立AI監査の新規PASSを必須とすると、確認済み版の変更や不要な外部送信を誘発します。一方、AI稿をhuman稿と偽ることや、過去の監査結果をPASSへ変更することはできません。

## 決定候補

- 通常のArticle Job監査・state machineは変更しません。専用のowner-reviewed producerを追加し、既成AI稿の来歴と過去のJob/journalを保持します。
- 根拠は「認証済み本人会話を確認したoperatorの記録」です。コードが外部会話の真正性を検証したとは主張しません。operatorは実際の会話・最新の意思・版と原本bytesの対応を確認し、不明なら停止します。
- private receiptに確認元、正確な発言とhash、範囲、原稿・画像のSHA-256、順序、Job/attempt/spec/intake、根拠・引用・例、権利、正規化画像、派生profileを結びます。ファイル名、記事本文の自己申告、JSONのapprovedフラグだけでは証拠を発行しません。
- 専用APIのin-memory handleで準備とoperator attestationを分けます。汎用CLIにowner証拠を読み込む入口を設けず、準備だけで本人確認を生成しません。再確認やTTY操作を一律追加せず、既存の明確な本人意思とexact対応を再利用できます。
- 公開package/admission/provenanceは明示的な `reviewBasis: owner_reviewed` とsafe hashだけを保持します。contentAuditSha256/visualAuditSha256、AI PASS、監査日時、監査coverage、架空のAI runを生成しません。
- Media RegistryもownerReviewRefとvisualAuditRefを排他的に扱います。通常のAI経路の監査要件を弱めず、owner refは同じreceiptとexact asset集合へ結合します。
- 原本からprivacy正規化・lossless canonical・上限内resize・site-owned social cardを作る許可範囲を明示します。新規画像、ラベル変更、crop、異なるSVG内容を確認済みと推定しません。animationは既存の全表示区間比較、poster対応、サイズ等の上限を維持します。
- local withdrawalは同じJob directory内の将来の準備を拒否します。最新withdrawal frontierを原子的に保存し、元発言のlabel/operator変更では復活できません。他のJobや既にmainへadmitされたpackageを自動失効させる仕組みではありません。

## 維持する境界

根拠・引用・technical example、権利、媒体保存許可、ContentId、改稿preimage、R2 A/B/Cの実bytes照合、owner/main/manual/Environment、通常PR・CI・手動deployはそのままです。prepared receiptは公開承認ではありません。外部AIの権限やexact disclosure grantを追加・変更せず、外部監査を呼びません。

## 検証と採用

合成fixtureで未確認・偽proof・hash/順序違い・変更後の再読込・withdrawal/中断・旧producer混在・main admission不一致を拒否します。特定の実記事について本人確認済み版との対応が未証明なら、実receiptを作りません。

これは未採用の実装候補です。実記事の承認、保存、公開、merge、deployや監査PASSを意味しません。操作と信頼前提は[専用手順](../../operations/owner-reviewed-existing-ai-publication.md)を参照します。
