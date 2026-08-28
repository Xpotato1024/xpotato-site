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

- root `README.md` に含まれる旧 setup / deployment assumption
- `doc/site-operations-guide.md`
- `doc/manual-post-migration.md`
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
