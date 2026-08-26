---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - clean-room audit procedure
  - phase-gate audit evidence boundary
---

# Clean-room Audit Governance

## Purpose

vNext design / implementation / migrationのphase gateを、過去chatや未記録intentで欠落補完せず、対象revisionのrepository evidenceだけから独立再構成する。

## Audit source boundary

Clean-room auditで使用してよいもの:

1. 対象revisionの`AGENTS.md`
2. `docs/README.md`から到達するcanonical/proposed SoT
3. 対象revisionのADRとそのstatus
4. machine-readable config / schema / code / fixtures
5. scopeに必要なcross-repository dependencyは、`architecture/infrastructure-handoff.md`等で**exact commit SHAへpinされたrevision**のみ
6. current provider factの検証が必要な場合のauthoritative upstream documentation。ただしrepository intentの欠落を外部情報で補完しない

Clean-room phase-gateでcurrent designの根拠にしてはいけないもの:

- 過去chat / model memory
- uncommitted intent
- legacy `doc/` / old README detail
- mutable branch headをexact dependencyの代わりに使うこと
- Issue / PR discussionをcanonical design欠落の補完に使うこと
- audit実行者の推測

Issue / PRはscope特定・変更理由の補助に使えても、canonical specificationの代用にしない。

## Independence

同一audit passではfindingを修正しない。

Phase-gate procedure:

1. audited revision(s)をSHAで固定
2. read-only audit
3. findings / severity / verdictを固定
4. audit pass終了
5. separate remediation pass
6. remediation後の新revisionをSHAで固定
7. fresh clean-room re-audit

自分で修正した設計を同じpassのcontinuationとしてPASSへ変更しない。

## Cross-repository audit

site designが`Xpotato-Server`等の外部SoTへmaterialに依存する場合:

- repository + exact commit SHA + applicable ADR/statusをsite-side handoff docへ固定する
- auditはそのSHAだけを読む
- branch名はnavigation hintにできるがauthorityにしない
- counterpartがProposedならsite側もそのdependencyをaccepted current infraとして扱わない

## Severity

`governance/severity.md`を正とする。

- P0/P1 = blocking
- P2 = deferred可能

## Phase-gate report

最低限:

- audit kind
- audited site revision
- audited cross-repo revision(s)
- evidence boundary
- P0/P1/P2 counts
- finding ID / severity / failure mode / evidence / done condition
- final verdict

reportは観測結果でありarchitectureを再定義しない。

## Design audit checklist

少なくとも:

- product goalsからarchitectureを一意に復元可能
- 1 topic = 1 canonical owner
- ADR status / supersede/reject relationship整合
- material decisionにADRがある
- canonical SoTとADRのdecisionが矛盾しない
- state machine / operation / contract names一致
- human approval / external mutation boundary一貫
- cleanup / retention後もrequired traceability / recovery成立
- private/public/provider trust boundary一貫
- open decisionがcurrent phaseに必要なcontractを曖昧にしていない
- migration / rollback pathがtarget designと整合

## Implementation audit checklist

implementation phaseでは追加で:

- machine SoTとprose semantics一致
- dependency boundary
- validation/gates enforceable
- no hidden Dashboard/manual state requirement
- build/deploy reproducibility
- published media/source/recovery receipts
- route/content/media migration parity

を確認する。

## Audit completion

P0=0/P1=0ならPASS可能。ただしPASSはoperatorによるDesign Freeze/merge/deploy approvalそのものではない。

Design Freezeやprovider activationは`architecture/design-status.md`の明示gateに従う。
