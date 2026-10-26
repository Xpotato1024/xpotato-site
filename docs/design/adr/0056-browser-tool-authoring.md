---
status: proposed
owner: architecture
date: 2026-10-22
---
# ADR-0056: ツール作成手順をsiteの契約正本から生成する

共通契約・source template・作成Skillはsite内に置き、各独立source repoが固有GUIと計算を所有する。分解機GUIをsiteへ複製しない。別SDK repoは複数host/独立releaseが必要になるまで追加しない。

[作成契約](../../contracts/browser-tool-authoring.md) を標準入口とし、machine authorityは既存content-contracts、検査は既存site-validators。生成物は固定snapshotで、runtime SDKや新loaderを導入しない。軽量同期templateから生成・build・検査を実証する。ユーザーの追加決定に従い、新規の共通 bounded-browser-v2 でWorker/WASM/クリック時clipboardを宣言可能にする。既存prime v0.1.0の互換契約は変更せず、資源・固定資産・通信・取消/解放・source/license検査を維持する。本番CSP/配信guardは変更しない。

成果物＋掲載先を共通commandへ渡し、review済みsource/artifactを検証してbuild時の静的wrapper/registry/binding/manifestとfile dependency/npm lock/下書きpageを生成する。未知directoryのruntime自動発見やAPI v1を置換するloaderは不要。新管理recordを単一源とし、既存手動prime登録は今回移行しない。新pageの公開は受入/CSP/source offerを含む別gate。

このPRは設計・source生成・GUI候補まで。採用済みv0.1.0を上書きせず、新版release・merge・本番配信は別の対象承認を必要とする。

## 公開後の登録管理移行

0.1.5の採用・本番公開後は、共通導入CLIの明示操作で既存Primeの登録管理だけを移せる。通常導入の衝突検査を外す方法は採らない。採用済みexact baselineと全preimageを検証し、既存pin・公開admission・MDX全文・公開状態を保持する。登録の管理元は installations.json とgenerated出力へ統一し、旧版履歴は残す。

今回の移行baselineは `34431d4891e2dd5c3a1634aff0a26dc28161f555` とし、本文・SEO・共有・URL参照CSSと旧版履歴を保持する。React入口とAstro wrapperのpath/bytesを生成管理で維持する理由は、公開asset名とfont/readinessの既存接続を保つため。pluginのGUI/logic/CSSは変更・複製しない。同一結果の再実行は変更ゼロ。各fileはstage/flush/renameで置換し、失敗時と明示復元時も未知の編集を上書きしない。手順と停止条件は作成契約を正とする。新releaseの採用、一般公開、CSP、監視、配信、権限はこの移行に含めない。
