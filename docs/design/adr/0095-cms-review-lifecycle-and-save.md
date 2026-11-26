---
status: proposed
owner: architecture
last_verified: 2026-11-27
---

# ADR-0095: 添削の対象と対応状況の分離、一括保存

## 背景

本文変更がない添削のGit保存で空commitとCIが起動し、添削の実保存は別ボタンに依存していた。削除・変更されたブロックに対する指摘と記事全体への指摘を明示する必要がある。

## 決定案

- 添削は従来どおり私有Draftに置く。位置を特定できる範囲と記事全体のtargetを区別し、位置の解決状態と対応statusを独立にする。対象不明は自動解決・削除しない。明示的な付け直しは古いanchorと提案を履歴に残す。
- 記事全体の指摘を範囲置換proposalへ変換しない。対象に応じて本文全体を編集し、明示的に解決する。
- 一つの保存操作からGitとDraft reviewを順番に処理する。同一treeのGit commitは作らない。保存されたreview snapshotを端末に記録し、処理中に入力された指摘と競合を保護する。片方が失敗しても成功済みの保存を巻き戻さず、未完了状態を明示する。
- 既存の位置付き指摘は変換なしで読み込める。新しい記事全体targetは新APIと新CMSを必要とする。公開・認証境界は変更しない。

契約は [CMS編集画面](../../contracts/cms-workbench-contract.md) と [CMS制作手順](../../operations/editor-workflow.md) を参照する。設計・CI・本番配備は別の証拠で確認する。
