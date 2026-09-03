---
status: historical
owner: architecture
observed_at: 2026-09-04
---

# ADR-0031 Ranked Prefix Boundary Tie — Fresh Clean-room Design Re-audit

## Audit kind

Post-Freeze material design amendment clean-room re-audit after remediation.

## Exact target

```text
repository: Xpotato1024/xpotato-site
audited_revision: a865018ea08463877356b3ee60f2d1e9a23ed8f1
base_revision: c03a6d1b3f087be91fc52fbe21fd391e6d0b7752
vNext_CI: 33805077166 SUCCESS
```

No cross-repository provider revision was material to this amendment.

## Evidence boundary

The audit reconstructed the design from the exact audited revision using the repository SoT map, lifecycle/status, audit/severity policy, accepted legacy reproduction/UID contracts, proposed ADR-0031 and ranked-prefix contract, validation SoT, and the exact frozen legacy source commit `927d105713561309fc5e2374396f86646b5aeb2a` for ranking and compact-card behavior.

PR discussions were not used as canonical design authority.

## Prior findings rechecked

### P1-ADR0031-01 — CLOSED

The SoT map exposes ADR-0031 as proposed/not accepted and validation explicitly distinguishes current exact-membership semantics from the conditional future bounded exception.

### P1-ADR0031-02 — CLOSED

Selected-only boundary cards are bound to complete expected frozen source+renderer representation, including node/order, static classes, attributes, `data-*`, ARIA, wrappers, static text, and source-derived fields. Shared identities remain exact rendered bytes.

## Re-audit checks

- candidate universe comes from exact frozen Git source, not observed outputs;
- each build independently proves finite-prefix validity;
- strict-prefix candidates are mandatory;
- boundary selection cardinality is exact;
- lower-ranked/out-of-universe/duplicate candidates are rejected;
- Related Blog uses the complete `(score DESC, pubDate DESC)` tuple;
- score reproduces candidate-tag occurrence counting from the frozen implementation;
- Home/Related are the only accepted call sites;
- pagination/feed/search/Featured/future paths do not inherit the class;
- endpoint/non-HTML/source/tag/lock/toolchain exactness remains unchanged;
- boundary membership evidence remains separate from tie permutation and Astro UID variance evidence;
- uncertainty and unrecognized variance remain fail-closed.

## Findings

```text
P0: 0
P1: 0
P2: 0
```

## Verdict

**PASS — P0=0 / P1=0 / P2=0**

This report is historical audit evidence only. Adoption authority is the subsequent explicit acceptance record plus `architecture/design-status.md`.
