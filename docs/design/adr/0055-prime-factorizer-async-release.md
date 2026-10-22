---
status: proposed
owner: architecture
date: 2026-10-22
---

# ADR-0055: 固定版分解機だけに有限のWorker/WASM計算を許可する

本人がGitHub Release v0.1.0、PR111→110→組み込みPR、受入れ後の旧分解機置換を承認した。同期100ms・Worker/WASM禁止・permissive限定のv1は新しい分解機の契約と合わないため、[専用プロファイル](../../contracts/prime-factorizer-async-profile.md)を追加する。全ツールの一般的な権限拡大にはしない。

source/release/hash/AGPL対応sourceと第三者条件を固定し、Document単位の資源lease、有限WASM/輸送/時間予算、退役不明時のquarantineを導入する。CSPは専用URLだけbaselineを保持した完全なpolicyへ置換する。通常のサイトnavigationを保ち、計算中の通信ゼロは実distのPage/Worker観測とoffline操作で検証する。

旧Numberモデルとfrozen parity記録は履歴fixtureとして保全し、新版の受入れと混同しない。本ADRは判断理由であり、リリース/配信が完了した証拠ではない。実際のcommit、配布hash、CI、公開URLは最終receiptへ記録する。
