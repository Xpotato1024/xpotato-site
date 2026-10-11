# ADR-0044: coverage incident を保持した通常 readonly 観測

- status: proposed
- date: 2026-10-11
- scope: Site monitor の実装・Draft review。実再開・gate 更新は別承認。

## 背景と判断

旧 main `c6560ed275b09674af6448af17d70a4667964b92` の2回の bootstrap は成功したが、各600秒 window に scheduled run を確認できず gate を閉じた。旧コードは deploy 用の履歴判定を scan admission にも使い、確定した gap だけでも次の通常 readonly scan を拒否する。追加 bootstrap や checkpoint reset による履歴消去を解決策にしない。

完全な認証済み履歴の identity・source・attempt・実行済み job を先に検証する。600秒超の作成間隔、完了間隔、creation→completion の遅延だけは `COVERAGE_INCIDENT_RETAINED` を保持して通常 scheduled scan を許容する。完了時刻は workflow 完了の証拠であり、実 sample 時刻・queue 原因・開始遅延を断定しない。固定診断は `coverageStatus` と `coverageChecks` の `OBSERVATION_GAP` / `OBSERVATION_DELAY` のみ。

完全履歴から毎回再導出し、後続 `OBSERVED_MATCH` で incident を解除しない。provider match は job success で終了し、coverage incident と `deployAllowed:false` を同時に返す。provider drift、不確かな履歴、失敗・skip・rerun・403・pagination 不整合は停止する。catch による deploy エラーの握り潰しはしない。`assessMonitorHistory` の gap/stale 拒否を維持し、完了間隔・完了までの遅延も拒否する。履歴確認から scan まで単一120秒 deadline/signal、各10秒/1MiB、CF32 GET/public3 GET、attempt1、無redirect・無retryを維持する。

## 監査付き executor 移行

v1 gate/旧 baseline は変更しない。v2 ACTIVE gate は新 main executor SHA、旧最終 checkpoint の元 SHA/時刻、`OWNER_APPROVED_EXECUTOR_TRANSITION`、監査ファイルの canonical fingerprint、旧 STOP より後の `effectiveAt` を別々に束縛する。監査ファイルは最初の旧 checkpoint を履歴 root とし、2件の旧 bootstrap、ACTIVE/STOP、消費済み ledger/receipt digest を保持する。旧 checkpoint SHA を新 SHA に書き換えない。

旧 source は監査ファイルと完全一致する2件の bootstrap のみ認め、最初の新 scan でも両旧 job を直接検証する。新 epoch は exact source と scheduled run のみ。新 executor の直前 observe job 検証による帰納的証明を再利用し、全 run history の失敗は保持する。未知の旧 run、移行前の新 run、追加 dispatch、hidden skip を移行例外にしない。

監査ファイルの存在や自己申告 status は実 gate の再開承認ではない。旧2件の once ledger は消費済みのままで、新 bootstrap budget を作らない。gate は現在閉じており、この Draft から開かない。

## observer と検証

Server counterpart は `ab9328c5a58082ac1ec268aa7d5901d838a6a474`。最新10件・最新 success だけでは過去 gap を見落とすため、毎時 observer の完全履歴・実行 job 証拠・固定 source epoch 評価を別のローカル提案とする。未取得の完全性を FRESH と推測しない。Server push/PR、実 automation、配送先、services は変更しない。

600/601、後続 success 後の保持、旧記録の非変異、移行不一致、hidden skip、不明 identity、deadline 共有、cap と非漏洩を合成 fixture で検証する。main merge・実再開・追加 provider/public GET は今回の実装承認に含まれない。
