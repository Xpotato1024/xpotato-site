---
status: proposed
owner: architecture
last_verified: 2026-11-28
---
# Games platform

## 責務と公開境界

難しい問題を使いやすい道具で解く。ゲームをツール・記事と分離する。Site は /games/ の静的 route、一覧、共通 shell、design tokens、SEO と配信 artifact を所有する。/games/ 以下は Pages の slug から予約する。公開ゲームが存在するまで一覧を noindex・sitemap 除外とする。

独立した xpotato-games workspace は game-core、ゲーム固有 engine、UI、release を所有する。Site は exact revision / artifact hash / license / runtime capability を検査した配布物のみ採用する。既存 browser-tool release contract の共通化は別設計。記事 route に game runtime を流さず、既存 CSP・公開承認を緩和しない。初期は静的配信、ブラウザ内完結、サーバー・アカウント・公式ランキングなし。

game-core は TypeScript の純粋処理、JSON、versioned seed、盤面識別、タイマー、event log/replay。DOM、network、storage、Sudoku rules を持たない。保存・描画・共有は adapter。計算は worker で分離し、実測で必要なら Rust/WASM。

## 盤面・履歴・UX

Puzzle / Session / Result / Analysis を分離する。gameId + generatorVersion + profileId + seed + canonical puzzle SHA-256 を固定。静的 route の query を用い、旧生成器または immutable payload を保持する。hash 不一致は失敗。export は旧生成器なしでも復元可能にする。初期盤面共有は解答を含めない。途中状態・replay・解答・SNS 成績は利用者が選択して export。ローカルタイムは非公式。

確定入力、候補、取消、支援、仮説、タイマーを記録し replay 可能にする。結果原本を保持し、終局後の検討は分岐で行う。通常は誤答で強制終了しない。正誤通知前に取消可能、候補メモ・仮説・確定前訂正は誤答としない。通知後の undo で成績を戻さない。操作意図は推定しない。難易度と支援 profile は独立し、競技は同じ profile で比較する。

(2,6)/(6,2) の交換可能ペアと (2,6)/(7,1) の順序付き代替配置を区別。数字集合、相関、等値、部分和、仮想ケージ、仮説は別 layer に記録し、色・線・ラベルを併用する。高度な推論の演出は非阻害、reduced motion 対応。検証済み推論、操作と整合する推定、ユーザー注釈を区別し、未発見の推論を勝手に提示しない。実ログと solver 推論も区別する。

## Sudoku

通常・Killer の共通 constraint engine を持つ。行/列/box、cage sum/all-different、partition を検査。完成盤面から生成し exact solver で解数上限2を数え、一意性を保証する。human-style solver で指定解法群の解決可否、proof trace、代替経路を計測。Easy/Normal/Hard/Expert/Master/Extreme は暫定分類。解法 tier、初期進展、推論選択肢、依存深度、相関保持負荷、停滞を別々に測る。実プレイによる校正前は体感難易度を保証しない。試行・時間上限と失敗結果を定義し目標 tier を黙って下げない。

## Organization・移管

単一 Organization `xpotato-site`（表示名 Xpotato Site）に site、browser-prime-toolkit、xpotato-games と将来の公開ツールを集約する。`xpotato-site/xpotato-games` は非公開で初期 core と CI を登録済み、`xpotato-site/browser-prime-toolkit` は公開状態を保持して移管済み。site 本体 `Xpotato1024/xpotato-site` の移管は未実施。Server はサイト以外の責務・権限を確認して別判断。`xpotato-skills`（表示名 Xpotato Skills）は独立責務を維持する。[Xpotato Development](https://github.com/orgs/xpotato-site/projects/1) を作成済みで、repository 横断の Issue/PR、Status (Backlog/Ready/In Progress/Review/Done)、Area、Priority、Milestone、依存、担当で管理する。merge と deploy は別の状態とする。

Xpotato系 Organization のログイン名は lowercase kebab-case の `xpotato-<domain>`、表示名は `Xpotato <Domain>`、リポジトリ名は lowercase kebab-case とする。現行参照には正式ログイン名を使い、固定 release・過去の監査/来歴に含まれる旧所有者名は保持する。

移管は feature PR と分離する。現行 site の repo guard を消したり広げたりしない。移管前に GitHub App installation/permissions、Environment/variables/secrets/branch rules、CI/release source pins、Cloudflare OIDC/owner gates、Server exact handoff、source offer/license、リンク・CLI remote を inventory する。旧新所有者を exact に照合する移管変更、移管後 readback と rollback 判断を準備する。/tools/prime-factorizer/ と ContentId、固定 release bytes/hash は維持。過去の provenance/immutable vendor の URL を一括置換しない。実移管・production mutation は別の承認と受入れを必要とする。

## 受入順序

1. Organization/Project、ゲーム repo、site 一覧と route reservation。
2. versioned core、session/replay、保存 adapter、schema/migration/limits、破損復旧。
3. classic + killer exact solver、生成、一意性、fixture、difficulty prototype。
4. UI、関係メモ、仮説、共有、誤答設定、終局後 review。
5. logical solver proof trace、演出・ヒント、記事連携、Daily/Featured。実機・CI・release gate 後に site 採用。
6. 実測校正と追加ゲーム。公式ランキングは不正耐性・privacy・費用を別判断。

この文書は提案であり、作成・採用・merge・配信を意味しない。
