---
status: canonical
owner: architecture
accepted_at: 2026-08-29
canonical_for:
  - post-Freeze ADR-0030 acceptance
  - frozen Astro React island uid equivalence adoption
---

# Post-Freeze ADR-0030 Acceptance — 2026-08-29

## Decision

The operator explicitly accepts ADR-0030 and its bounded contract amendment after the fresh read-only design audit of exact revision:

```text
repository: Xpotato1024/xpotato-site
audited_revision: 36aecac4f3342e8ee41b4332c0d0c6df6d37b0fe
fresh_design_audit: PASS — P0=0 / P1=0 / P2=1
operator_acceptance_date: 2026-08-29
```

The P2 finding was documentation lifecycle drift left after ADR-0028/0029 acceptance; it was not a defect in ADR-0030 semantics and is to be synchronized in the implementation pass.

This acceptance adopts:

- ADR-0030 — bounded generated `astro-island uid` equivalence for the exact frozen PrimeFactorizer React island;
- `contracts/legacy-build-astro-island-uid-amendment.md` at the audited revision;
- the exact upstream-version evidence and positive-proof requirements recorded by those documents.

The proposal documents at the audited revision retain their audited `status: proposed` bytes. This acceptance record plus `architecture/design-status.md` are lifecycle authority for the adopted ADR-0030 semantics.

## Accepted boundary

Accepted generated-metadata variance class:

```text
astro-react-island-uid-v1
```

It applies only when the machine comparator positively proves all accepted conditions, including:

- frozen tag/commit/lock/toolchain identity remains exact;
- the page is the frozen PrimeFactorizer Tool binding;
- framework=`React` and hydration=`client:visible`;
- both builds have the same Astro island count and DOM position;
- the `uid` attribute exists and only its value differs;
- every other island attribute and all surrounding/child HTML bytes are identical after any independently proved ADR-0028 tie regions;
- component and renderer assets remain byte-identical through the exact non-HTML manifest;
- both raw UID values and raw dist manifests remain preserved as evidence.

No other component, framework, hydration directive, Astro version, attribute, filename, or generated metadata inherits this exception.

## Failure boundary

The comparison remains fail-closed for:

- added/removed/reordered islands;
- missing `uid` on either side;
- any non-`uid` attribute difference;
- child/SSR HTML difference;
- component/renderer asset difference;
- unsupported component/framework/hydration/version;
- ambiguous extractor evidence;
- any other unrecognized HTML variance.

## Authorization

This acceptance authorizes implementation of ADR-0030 in the current migration-preparation feature branch, including deterministic tests, reproduction evidence, and the compact Phase 1A baseline update after hosted evidence passes.

It does not authorize legacy source/tag mutation, content/media migration publication, old implementation deletion, cutover, deploy, or Cloudflare/R2/DNS/provider mutation.

## Related

- `amendment-acceptance-2026-08-29.md`
- `adr/0030-astro-react-island-uid-equivalence.md`
- `../contracts/legacy-build-astro-island-uid-amendment.md`
- `../contracts/legacy-build-reproduction-contract.md`
- `../architecture/design-status.md`
