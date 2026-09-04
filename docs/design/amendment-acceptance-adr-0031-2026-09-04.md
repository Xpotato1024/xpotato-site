---
status: canonical
owner: architecture
accepted_at: 2026-09-04
canonical_for:
  - post-Freeze ADR-0031 acceptance
  - ranked finite-prefix boundary tie equivalence adoption
---

# Post-Freeze ADR-0031 Acceptance — 2026-09-04

## Decision

The operator explicitly directed continuation after reviewing the ADR-0031 design on 2026-09-04 (`確認しました。進めてください`). That direction is applied here after the required fresh clean-room re-audit passed. The remediation between the reviewed draft and the audited revision only tightened proof requirements and canonical-SoT clarity; it did not broaden the variance scope.

Accepted exact revision:

```text
repository: Xpotato1024/xpotato-site
audited_revision: a865018ea08463877356b3ee60f2d1e9a23ed8f1
fresh_design_reaudit: PASS — P0=0 / P1=0 / P2=0
operator_acceptance_date: 2026-09-04
```

This acceptance adopts:

- ADR-0031 — bounded finite-prefix cutoff tie membership equivalence;
- `contracts/legacy-build-ranked-prefix-boundary-tie-amendment.md` at the audited revision;
- the conditional proposal clauses in `docs/README.md` and `operations/validation.md` at the audited revision as active only through this acceptance authority.

The audited proposal files retain their exact `status: proposed` bytes. This acceptance record plus `architecture/design-status.md` are lifecycle authority for the adopted semantics.

## Accepted variance class

```text
ranked-prefix-boundary-tie-v1
```

It is limited to the exact frozen legacy snapshot and only these ranked finite-prefix regions:

1. Home latest Blog: published Blog universe, `(pubDate DESC)`, limit `3`, frozen `ArticleCard compact=true`.
2. Related Blog on frozen Blog detail pages: published Blog minus current post, `(score DESC, pubDate DESC)`, limit `3`, frozen `ArticleCard compact=true`.

The related score must reproduce the exact frozen candidate-tag occurrence counting and category-match semantics.

## Positive-proof boundary

A membership difference is admitted only when each build independently proves the same frozen candidate universe, complete sort keys, strict-prefix membership, exact cutoff tie group and boundary cardinality, no lower-ranked/out-of-universe/duplicate selection, and preserved ordering across unequal keys.

Every membership delta identity must belong to that one cutoff tie group.

Selected-only cards must be validated against the complete expected frozen compact-card representation derived from exact source metadata and exact frozen renderer semantics, including all nodes/order, classes, attributes, `data-*`, ARIA, wrappers, static text, and source-derived fields. Shared identities continue to require exact rendered bytes.

## Unchanged fail-closed boundary

This acceptance does not weaken:

- exact frozen tag/commit/lock/toolchain identity;
- exact endpoint-set identity;
- byte-identical non-HTML artifacts;
- ADR-0028 exact membership for all non-recognized or complete sequences;
- ADR-0030 bounded `uid` semantics;
- unknown/ambiguous HTML variance failure;
- raw artifact/evidence preservation.

No pagination, feed, search, Featured Project, future call site, or generic equal-key membership change inherits this exception.

## Evidence semantics

Boundary-selection variance evidence is additive and separate from ADR-0028 `permittedTiePermutationCount` and ADR-0030 generated-metadata evidence. Raw dist manifests remain preserved and `rawByteIdentical` remains truthful.

## Implementation authorization

This acceptance authorizes a separate implementation-remediation pass for the deterministic comparator, tests, reproduction evidence, and related validation/baseline integration necessary to implement the accepted class.

It does **not** authorize:

- modifying the frozen legacy source/tag;
- retry-until-green behavior;
- global membership suppression;
- PR #49 merge before the implementation and fresh validation/audit gates pass;
- production deploy/cutover;
- old implementation deletion;
- Cloudflare/R2/DNS/provider mutation.

## Related

- `adr/0031-ranked-prefix-boundary-tie-equivalence.md`
- `../contracts/legacy-build-ranked-prefix-boundary-tie-amendment.md`
- `../contracts/legacy-build-reproduction-contract.md`
- `amendment-acceptance-adr-0030-2026-08-29.md`
- `../architecture/design-status.md`
