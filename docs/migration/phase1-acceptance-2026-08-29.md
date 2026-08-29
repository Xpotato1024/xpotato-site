---
status: canonical
owner: migration
accepted_at: 2026-08-29
canonical_for:
  - Phase 1 legacy freeze/inventory/reproduction acceptance
  - Phase 1 visual/performance baseline acceptance
---

# Phase 1 Migration Baseline Acceptance — 2026-08-29

## Decision

Phase 1 of the vNext migration plan is accepted as complete.

This acceptance closes only the legacy-baseline phase. It does **not** authorize legacy cutover, old implementation deletion, production deployment, Cloudflare/R2/DNS mutation, provider redirect activation, or production external-AI activation.

## Phase 1A — legacy freeze / deterministic inventory / reproduction

Accepted implementation/audit target:

```text
feature revision: a4a600c2e6172cc88b0cdc8182541372cfbb608e
fresh closure re-check: PASS — P0=0 / P1=0 / P2=0
PR: #42
main merge commit: abc9bd3699626718b3c459ea68e0a8bfc3459ec2
post-merge vNext CI: PASS
```

Frozen legacy identity remains:

```text
tag: legacy-pre-vnext-2026-08-28
tag object: 8503f5a50a5fb3d27a02422da0b50dc66c818b02
peeled commit: 927d105713561309fc5e2374396f86646b5aeb2a
package-lock blob: bb805f8a5558bf1eebe6d57d8292f7f69cb06d5a
```

Phase 1A evidence includes deterministic inventory, exact tag identity, accepted characterized legacy-build reproduction, unresolved-media/LegacyHtml evidence semantics, and the compact machine baseline. Legacy deletion remained blocked by independent parity/provider/recovery/rollback requirements.

## Phase 1B — visual / performance observation baseline

Accepted implementation/audit target:

```text
feature revision: 293ae808c1827e6e4147a5775974d7ef112d622b
fresh Phase 1B audit: PASS — P0=0 / P1=0 / P2=0
PR: #43
main merge commit: 94c46c5f6f6663e4f16973d10f48a067f2f79c45
post-merge vNext CI: PASS
```

Reviewed capture evidence:

```text
capture profile: legacy-visual-performance-v1
representative routes: 6
viewports: desktop + mobile
observations/screenshots: 12
reviewed capture run: 33241358064
reviewed artifact: 9711461055
reviewed artifact digest: sha256:e3b18a85dd27dc881039005f717dcf4e6500df0c9753c56fdf58ad3defa58202
final audited revision capture run: 33241579446
final audited revision capture result: PASS
```

The PNG screenshots remain Actions-artifact evidence rather than Git raster content. The committed compact JSON records the reviewed screenshot identities and performance observations. Those observed timings/CLS/transfer values are not hard performance thresholds and are not field Core Web Vitals claims.

## Phase 1 completion semantics

Phase 1 completion means:

- exact legacy snapshot is immutable and machine-verified;
- legacy inventory is regenerable from that snapshot;
- old build is reproducible under the accepted fail-closed equivalence contract;
- representative visual evidence exists for desktop/mobile review;
- representative hosted lab performance observations are recorded without inventing hard budgets;
- normal vNext CI validates compact baseline integrity;
- no old active implementation was removed;
- no provider or production deployment mutation occurred.

It does **not** mean content/media/route parity or production readiness.

## Next implementation phase

The greenfield workspace/contracts/site foundation corresponding to migration-plan Phases 2–3 is already accepted and merged. With Phase 1 now complete, the next repository implementation work is **Phase 4 — Content identity / content migration**.

That next phase may create reviewed vNext migration records/content on feature branches, but must continue to preserve the frozen legacy source and must not perform cutover or provider mutation. Taxonomy, media, route/SEO, provider, recovery, rollback, and deletion gates remain later independent blockers.
