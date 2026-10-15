---
status: proposed
owner: architecture
date: 2026-10-15
---

# ADR-0052: 取得済み例検証を別実行主体の署名と固定profileへ結ぶ

A3の残る取得済み例検証入口として、[署名付きreceipt取込み](../../operations/acquired-example-verification.md)を追加する。code分類、未実行の自己申告、任意JSONのpassを実行成功へ昇格しない。別principalの固定実行器が、exact requestと入出力/exit/profileを署名する。公開鍵と実装/toolchainの許可集合は消費側のGit管理trust storeで固定する。

実運用trust storeは未登録のままとし、実運用credentialや権限を追加しない。合成fixtureにだけprivate evidence内のfixture公開鍵を認める。fixtureがhuman_localへ昇格する場合は拒否し、後続候補も合成scopeから本人承認権限を発行しない。

sandboxの実行adapterをこのCLIへ新設しない。構文fixtureの別プロセスは固定JSON parserだけを動かす。sandbox profileの署名整合fixtureを実sandbox受入れと表示しない。署名者/実行器自体の虚偽やOS隔離まで消費側が再観測したとは主張しない。

receiptはevidence bundleへ含め、旧immutable attempt/監査とのhash結合と編集後失効を維持する。取得済みstdout/stderrへ一致しないexpected output、別入力、旧attempt、未知/失効key、profileや実装/toolchain不一致、失敗/未実行は前進させない。A4・本人承認・保存/exportは別単位のままとする。
