---
status: proposed
owner: operations
---

# ADR-0046: runtime認可による有限readと一回の証拠保存

## 問題

ADR-0045のschema3入口はtracked recoveryのapproved化と再mergeを実行認可に要求し、未解決の旧skipで新readが閉塞する。Server Draft75のschema3はpure offline evaluatorだけで完全collectorへ接続されていない。既存毎時通知に正確なnominal時刻とCLI hookを求める前提も、readonly運用と両立しない。

## 候補

PROPOSED recovery・旧audit/STOP・未解決incidentを維持したまま、schema4の本人明示runtime認可でexact source/時刻/番号/read scope/storage scopeを固定する。readとpublication/deploy authorityを分離し、自然scheduleの有限trialとmanual-only one-shot evidence workflowを接続する。公共history coreだけを既存readerから分離し、private baselineやprovider credentialsをcollectorへ渡さない。

一回のT dispatchから同jobのE待機、固定cutoffの完全history/jobs、非秘密JSONの一回保存までが候補経路。標準pinned upload actionのretry/閲覧範囲/platform timeoutと残余期限リスクを本人storage scopeに含める。専用uploader、追加schedule、既存hourly taskの変更/接続を導入しない。

## 制約

exact契約と採用前判断は[有限executor運用候補](../../operations/site-monitor-finite-executor.md)に定義する。mergeや合成E2Eは実行認可でもlive検証でもない。旧incident/公開禁止/deploy禁止は条件達成後も保持する。observer実受領は固定Site coverageと別証拠。絶対期限後artifact write0が必要ならnative action保存候補はBLOCKEDのまま。
