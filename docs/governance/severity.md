---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - design and implementation finding severity
---

# Severity Policy

## Purpose

vNextのdesign / implementation / migration / audit findingをP0 / P1 / P2の3段階で分類し、phase gateを一意に判定する。

## P0 — Critical

直ちに停止し、phase advance / merge / external mutationを認めない。

例:

- credential / private source / personal dataのpublic exposure
- irreversible data loss / recovery authority破壊
- human approval bypass
- unauthorized production/provider mutation
- published contentを別candidateへsilent差替えできるcorrectness failure

## P1 — Blocking

current phase acceptance前に解消が必要。

例:

- canonical SoT間の矛盾
- clean-roomでarchitecture / state transition / ownershipを一意に復元できない
- required ADR欠落によりmaterial decisionの理由・replacement ruleが不明
- publication/recovery/traceability contractがcleanup後に成立しない
- security / privacy / accessibility / correctnessのrequired invariant欠落
- implementationがtarget architectureを再現不能

## P2 — Deferred improvement

current phaseのcorrectness / security / recoverabilityを壊さず、明示的に後回しにできる改善。

例:

- wording / indexの軽微なdrift
- measured evidence待ちのoptional optimization
- future scale時だけ必要なGC / hardening
- non-blocking documentation usability

## Gate

- P0 > 0: FAIL
- P1 > 0: FAIL
- P0 = 0 and P1 = 0: phase-gate PASS可能
- P2 > 0だけではFAILにしない

P2=0をDesign Freeze / implementation completionの条件にしない。

## Classification rule

severityは「修正が簡単か」ではなく、未修正時のarchitecture / publication / recovery / security consequenceで決める。

疑義がある場合、finding本文で具体的failure modeを示す。単なる好みをP1へ昇格しない。
