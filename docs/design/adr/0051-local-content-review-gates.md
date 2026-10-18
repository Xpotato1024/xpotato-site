---
status: proposed
owner: architecture
date: 2026-10-15
---

# ADR-0051: ローカル資料から内容工程を進め、候補化を別gateにする

A2の手書き作業稿を、既存Source/Evidence/Claim、コード例分類、独立content auditへ接続する。[ローカル内容review](../../operations/local-content-review.md)に従い、artifact hashとappend-only StageReceiptから合法な前方遷移を再生する。編集後は新attemptで再検証し、旧監査・旧承認の権限を引き継がない。

この小単位はCONTENT_READYと不足条件を示す非公開bundleまで。画像実物・Media Registry・visual audit・確定公開予定設定・完全候補previewを消費するA4を後続へ分ける。候補hashやHUMAN_REVIEW_READYを仮に生成しない。コード例分類から実行成功を表示せず、未実行と実行証拠を区別する。

SourceRecordはlocal snapshot artifactのdeny disclosure recordへ結び、public citation eligibilityを外部AI送信許可とみなさない。writerと別のhuman principalと固定requestを持つaudit recordを受け入れるが、これは所有者の最終承認ではない。合成試験のscopeを実資料・実際の人の監査実績へ昇格しない。

新しいprovider、資格情報、画像upload、公開content編集、公開workflow/権限変更をこの決定へ含めない。
