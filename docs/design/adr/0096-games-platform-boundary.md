---
status: proposed
owner: architecture
last_verified: 2026-11-28
---
# ADR-0096: ゲームを独立アプリケーション領域として追加する

ゲームは再訪・プレイ・共有・終局後検討を目的とする。/games/ を独立 section と予約 route にし、ゲーム系列ごとに独立 repository を持ち、純粋な共通 core は `xpotato-game-core` に分離する。ゲーム系列内の domain、UI、storage adapter は分離し、各ゲームは固定 core release を採用する。通常・Killer は `xpotato-sudoku` に同居させる。静的 site、固定 release、既存 CSP/CI/公開境界を維持。未公開ゲームはリンクせず、空一覧は noindex とする。サイトと公開関連ツールを一つの Organization で管理する方向を推奨し、移管は独立した検証対象とする。

仕様候補は [Games platform](../../architecture/games-platform.md)。本 ADR は提案であり、本番公開・移管・認可境界変更の承認ではない。
