---
status: canonical
owner: architecture
accepted_at: 2026-08-29
canonical_for:
  - post-Freeze ADR-0028 acceptance
  - post-Freeze ADR-0029 acceptance
  - legacy reproduction and unresolved-evidence amendment adoption
---

# Post-Freeze Migration Amendment Acceptance — 2026-08-29

## Decision

The operator explicitly accepts the post-Freeze migration design amendments represented by the exact audited revision below:

```text
repository: Xpotato1024/xpotato-site
audited_revision: fddcfe936b8bd0bcfa68a074ea808ca6f84ecc9e
fresh_design_audit: PASS — P0=0 / P1=0 / P2=0
operator_acceptance_date: 2026-08-29
```

This acceptance adopts:

- ADR-0028 — characterized semantic equivalence for frozen legacy build reproduction;
- `contracts/legacy-build-reproduction-contract.md` at the audited revision;
- ADR-0029 — evidence-preserving unresolved legacy migration states;
- the ADR-0029 amendment clauses in `contracts/migration-inventory-contract.md` at the audited revision;
- corresponding lifecycle/validation/migration-plan semantics in that exact audited revision.

The proposal documents at `fddcfe936b8bd0bcfa68a074ea808ca6f84ecc9e` retain `status: proposed` bytes because they were the exact clean-room audit target. For the adopted amendment semantics, **this acceptance record plus `architecture/design-status.md` are lifecycle authority**, analogous to the 2026-08-26 Design Freeze manifest for its audited baseline.

## ADR-0028 accepted boundary

Accepted initial reproduction profile:

```text
legacy-build-equivalence-v1
```

It permits only positively proven permutations inside these legacy-declared complete sort-key ties:

1. published entries: `(pubDate DESC)`;
2. related Blog entries: `(score DESC, pubDate DESC)`;
3. featured Projects: `(featuredOrder ASC with missing = MAX_SAFE_INTEGER, pubDate DESC)`.

It does **not** permit arbitrary HTML normalization, filename allowlists, unknown variance, membership/content/link changes, ordering changes across unequal keys, non-HTML differences, source mutation, or extractor uncertainty.

New variance classes are not accepted by implication. They require a separate explicit design amendment, fresh clean-room audit, and operator acceptance before implementation may admit them.

## ADR-0029 accepted boundary

A faithful frozen-legacy inventory may preserve unavailable evidence explicitly rather than fabricate facts:

- Git-backed media: exact verified SHA/size/format evidence;
- non-Git or missing-Git media: exact unresolved locator + reason, with no fabricated SHA/size;
- statically recoverable raw HTML: exact hash;
- raw HTML whose bytes cannot be proved by bounded static extraction: explicit blocked/manual-review evidence.

Inventory integrity and migration/cutover readiness remain separate. Explicit unresolved/blocked evidence may be inventory-valid while still blocking migration completion and cutover.

## Implementation authorization and limits

This acceptance authorizes a separate implementation-remediation pass to bring machine schemas/validators/reproduction evidence into conformance with ADR-0028/0029.

It does not authorize:

- expansion of `legacy-build-equivalence-v1` beyond the three accepted tie classes;
- modifying the frozen legacy source/tag;
- content/media migration publication;
- old active implementation deletion;
- migration cutover;
- production deploy;
- Cloudflare/R2/DNS/provider mutation;
- production external-AI activation.

## Newly observed variance remains outside this acceptance

During the separately authorized ADR-0028 implementation work, hosted reproduction exposed a clean-build HTML difference in the legacy React Tool where only the Astro-generated `<astro-island uid="...">` value changes.

That variance class is **not** part of ADR-0028 as accepted here. The current machine comparator must continue to reject it until a separate amendment is audited and explicitly accepted. This acceptance record must not be cited as authority to normalize or ignore that attribute.

## Related

- `freeze-manifest-2026-08-26.md`
- `../architecture/design-status.md`
- `adr/0028-legacy-build-reproduction-equivalence.md`
- `adr/0029-legacy-unresolved-migration-evidence.md`
- `../contracts/legacy-build-reproduction-contract.md`
- `../contracts/migration-inventory-contract.md`
