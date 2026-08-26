---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - documentation governance
---

# Documentation SoT Policy

## Purpose

Legacy implementation、target design、decision history、audit evidence、cross-repository provider stateを混在させず、exact revisionから仕様を一意に復元できるようにする。

## Documentation root

vNext specification root=`docs/`。

Existing `doc/`、old root README detail、old implementationはlegacy/migration evidenceでありvNext current/target specificationを決めるauthorityではない。

Root `README.md`はrepository entrypointへ限定し、architecture/operation valuesをduplicateしない。

## Roles

- `architecture/`: target semantics/ownership/lifecycle/boundary
- `contracts/`: implementation-ready interfaces/constraints
- `operations/`: repeatable workflow/profiles/validation/deployment
- `governance/`: audit/severity process
- `content/`: editorial policy
- `design/adr/`: decision rationale/lifecycle history
- `design/open-decisions.md`: non-authoritative unresolved measurement/provider detail
- `migration/`: legacy -> vNext plan/evidence
- `audits/`: exact-revision observed audit reports; policyを再定義しない
- `legacy/`: non-authoritative legacy evidence
- code/config/schema: implementation/machine SoT after implementation adoption

## Lifecycle

`architecture/design-status.md` is the lifecycle authority。

`status: proposed` does not mean accepted/current production architecture。

Design Freeze requires clean-room PASS + explicit operator acceptance. Only explicit adoption change may promote:

- target docs `proposed -> canonical`
- adopted ADRs `proposed -> accepted`

Audit agent must not promote status merely because it produced PASS。

## ADR lifecycle

- `proposed`: review candidate, never accepted yet
- `accepted`: explicit adopted decision
- `superseded`: an accepted historical decision replaced by a later accepted decision
- `rejected`: considered proposal not adopted

Never rewrite accepted history to match current implementation. Material accepted-decision change requires new ADR + explicit supersede relationship。

## 1 topic = 1 canonical owner

Do not duplicate same exact rule across AGENTS/Skill/README/ADR/architecture docs。

- AGENTS: routing + high-value invariant summary
- canonical/proposed SoT: semantics/ownership
- Skill: conditional semantic workflow
- machine config/schema: exact implementation values
- CI/validator: enforceable invariant
- ADR: why decision was chosen/rejected
- audit report: what an exact revision was observed to contain

If duplicate prose can conflict, choose one canonical owner and replace others with references/summary。

## Metadata

Target specification docs normally carry:

```yaml
---
status: proposed | canonical | retired
owner: architecture | content | operations
last_verified: YYYY-MM-DD
canonical_for:
  - topic
---
```

`last_verified` is content verification date, not a generic edit timestamp。

## Drift handling

If implementation/config/ADR/canonical docs disagree:

1. do not assume implementation wins;
2. identify lifecycle/current authority;
3. if target SoT is intended, fix implementation/other docs;
4. if material design change is intended, add/update ADR according to lifecycle and update target SoT;
5. historical reports/legacy docs remain evidence, not current authority。

## Cross-repository SoT

Shared Cloudflare/provider infrastructure is owned by `Xpotato1024/Xpotato-Server`, but clean-room design must not follow a mutable branch head。

`xpotato-site` keeps exactly one cross-repository design binding in:

- `architecture/infrastructure-handoff.md`

That handoff records:

- repository
- exact commit SHA
- relevant ADR/status
- lifecycle/sub-gate meaning

Branch name may be navigation hint only。

Site repo must not duplicate provider IDs, account IDs, bucket names, credentials, current provider state as second SoT unless a provider-neutral semantic contract explicitly requires a logical value。

If counterpart SHA changes materially, update handoff in same design change and re-audit affected scope。

## Clean-room audit documentation

Audit procedure=`governance/audit.md`。Severity=`governance/severity.md`。

Audit report under `audits/`:

- binds exact audited revision(s)
- contains findings/verdict
- is immutable historical evidence in meaning
- does not become design authority

Finding remediation happens after audit pass. Re-audit reads the new exact revision from scratch。

## Generated/machine documents

After implementation, generated schemas/search index/build artifacts are not manually edited。

Human prose explains semantics; machine-readable implementation has its explicit SoT defined by relevant architecture/contract docs。
