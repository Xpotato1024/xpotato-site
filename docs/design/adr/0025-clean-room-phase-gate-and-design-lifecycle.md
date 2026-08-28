---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0025: clean-room phase-gateと明示Design Freeze lifecycleを採用する

## Context

vNextはsite application、AI authoring、media pipeline、Cloudflare counterpartを跨ぐ大きなgreenfield migrationである。

過去chatや未記録intentを使えば設計上の穴を「知っているつもり」で補完できるが、別agent/operatorが同じrevisionからarchitectureを復元できない。

またaudit中にfindingを即修正して同じpassでPASSへ変更すると、独立性が失われる。

## Decision

vNext design/implementation/migration phase transitionはclean-room audit + explicit operator gateを使用する。

### Clean-room source boundary

Auditはtarget exact revisionの:

- AGENTS
- canonical/proposed SoT
- ADR/status
- machine config/code/fixtures
- SHA-pinned cross-repository counterpart

だけからcurrent designを再構成する。

Past chat、model memory、legacy docs、mutable branch head、uncommitted intentで欠落補完しない。

### Audit/remediation separation

```text
freeze exact revision
 -> read-only audit
 -> findings/verdict freeze
 -> audit end
 -> separate remediation
 -> new exact revision
 -> fresh clean-room audit
```

同じaudit passでfindingを修正しない。

### Severity gate

`governance/severity.md`:

- P0/P1 block phase advance
- P2 can be deferred

### Lifecycle

Before operator acceptance:

- Design=`PRE_FREEZE_REVIEW`
- implementation/migration/provider activation blocked

Design Freeze requires clean-room P0=0/P1=0 **and** explicit operator acceptance。Audit PASS alone does not promote docs/ADRs。

After acceptance, adopted canonical docs/ADRs are explicitly promoted and exact freeze revision/audit basis is recorded。

## Cross-repository implication

Material infrastructure dependency must be pinned by repository + exact commit SHA + applicable ADR/status。

Branch name may be a navigation hint but is not audit authority。

If counterpart changes materially, handoff SHA update + affected re-audit are required。

## Alternatives

### Rely on conversation context / maintainer memory

fast but not rebuildable/independently auditable, therefore rejected。

### Audit and repair in one pass

efficient but lets auditor validate its own moving target, therefore rejected for phase gates。

### Require P2=0

encourages overwork and blocks phase advance on non-critical polish, therefore rejected。

## Consequences

- design review has explicit revisions/verdicts。
- audit reports are historical evidence, not policy。
- remediation needs a second audit before PASS。
- external counterpart changes are revision-bound rather than branch-bound。
- operator remains final authority for Design Freeze/implementation activation。

## Related

- `architecture/design-status.md`
- `governance/audit.md`
- `governance/severity.md`
- `architecture/infrastructure-handoff.md`
