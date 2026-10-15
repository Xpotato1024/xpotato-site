---
status: proposed
owner: architecture
date: 2026-10-15
---

# ADR-0054: 承認・保存・export の mock 境界

## 状況

A4は候補と参考previewを作成する。実resourceと操作認可は未成立であり、本人承認や保存成功を実装試験で捏造しない。一方、合意済みA5–A6の順序・失効・中断復旧・compact lineage・exact exportはローカルで検証する必要がある。

## 判断

本人laneは現在のhuman_local正式候補と人が直接操作するTTYに限定する。CI/nonTTYと任意JSONによる承認を拒否し、実装担当は入力しない。この手順は本人性の暗号学的証明ではない。

simulationはsynthetic_fixture専用の別decision/journal/adapterとし、HumanApprovalRecordへ変換しない。reserved mock保護識別子をinner lineageへも残し、通常のcompact validator、公開出力guard、mock index projectionで実運用への流用を拒否する。

providerはprivate local mockだけを実装する。物理objectはunion、logical asset/rights/variantはexact-setを維持する。未知writeはpending intentと同一providerのread-backから再開し、read不明は停止する。Delete・config・認証・networkの入口は設けない。

exportは完全な固定候補とpost-approval receipt chainから非公開patchを作り、base preimageと全file/pathを照合してからactivateする。job不可視の新規private fixtureではcompact recordsと保護objectだけから共有Astro描画を確認する。通常buildへmockデータを受け入れる変更や、未投入rights/provenanceの全域必須化は行わない。

## 境界

source/public/protectedの実resource、権限、policy read-back、本人の実承認と個別操作認可がない実operationは停止する。本判断は実保存・公開・cleanup・Ready・merge・deployや採用済み契約の緩和を認可しない。

## 検証

[操作と検証入口](../../operations/article-publication-mock.md)。未知結果、同一key矛盾、権限、順序、集合欠落、編集後失効、4更新経路、旧object保持、job不可視のcompact描画、mockの公開経路拒否を対象とする。
