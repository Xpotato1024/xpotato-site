---
status: proposed
owner: architecture
date: 2026-10-22
---
# ADR-0056: ツール作成手順をsiteの契約正本から生成する

共通契約・source template・作成Skillはsite内に置き、各独立source repoが固有GUIと計算を所有する。分解機GUIをsiteへ複製しない。別SDK repoは複数host/独立releaseが必要になるまで追加しない。

[作成契約](../../contracts/browser-tool-authoring.md) を標準入口とし、machine authorityは既存content-contracts、検査は既存site-validators。生成物は固定snapshotで、runtime SDKや新loaderを導入しない。軽量同期templateから生成・build・検査を実証する。prime専用非同期profileを一般化せず、capability/CSP/配信guardは変更しない。

このPRは設計・source生成・GUI候補まで。採用済みv0.1.0を上書きせず、新版release・merge・本番配信は別の対象承認を必要とする。
