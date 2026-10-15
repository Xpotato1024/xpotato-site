---
status: proposed
owner: architecture
last_verified: 2026-08-25
canonical_for:
  - legacy documentation boundary
---

# Legacy Boundary

## Existing material

vNext design 開始時点の次の material は legacy / migration source として扱う。

- [旧root READMEのsetup / deployment assumption](root-readme-before-consolidation.md)
- [旧Site Operations Guide](site-operations-guide.md)
- [旧Manual Post Migration](manual-post-migration.md)
- WordPress importer
- `LegacyHtml` を使う imported content
- `public/wp-content/uploads/` の WordPress-derived layout
- Pages / Workers / VPS / Home-Servers が混在する説明

このファイルは「すべて削除する」という意味ではない。必要な fact / content / redirect identity は migration 時に current SoT へ移し、役割を失ったものだけ retire する。

## Rules during design phase

- legacy docs を vNext design のついでに書き換えない。
- legacy doc の記述を target architecture の根拠として無批判に継承しない。
- current implementation の挙動を確認する evidence としては参照できる。
- migration PR では旧と新の対応関係を明示する。

## Exit criteria

vNext implementation が canonical docs に適合した時点で、legacy inventory を再監査し、次を分類する。

- remove: Git history だけで十分
- archive: migration evidence として保存
- migrate: current operations / architecture へ統合
- retain: public content として依然必要

## 2026-10-15の文書階層統一

| 旧配置 | 現在の配置 | 役割 |
|---|---|---|
| root READMEの旧手順 | [root-readme-before-consolidation.md](root-readme-before-consolidation.md) | 旧運用の履歴。リンク2件の相対位置だけ修正 |
| doc/site-operations-guide.md | [site-operations-guide.md](site-operations-guide.md) | 本文をbyte一致で保全 |
| doc/manual-post-migration.md | [manual-post-migration.md](manual-post-migration.md) | 本文をbyte一致で保全 |

旧文書中の `doc/`、`src/`、Pages、push後deployなどは当時の記述です。現行手順には適用しません。正本は[docs入口](../README.md)、配信の実装状況は[現在の配信workflow](../operations/current-deployment-status.md)から確認します。旧root実装の削除や移行hold解除はこの移動に含みません。
