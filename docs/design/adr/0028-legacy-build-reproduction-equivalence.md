---
status: proposed
date: 2026-08-29
owner: architecture
---

# ADR-0028: Legacy build reproduction uses characterized semantic equivalence

## Status boundary

This ADR is a **post-Freeze proposal**。It does not amend the accepted Frozen Design until a fresh clean-room design audit passes and the operator explicitly accepts it。The current Phase 1A machine baseline and reproduction command remain unchanged and failing until a later, separately authorized implementation-remediation pass。

## Context

The exact frozen legacy source is:

- repository: `Xpotato1024/xpotato-site`
- annotated tag: `legacy-pre-vnext-2026-08-28`
- tag object: `8503f5a50a5fb3d27a02422da0b50dc66c818b02`
- peeled commit: `927d105713561309fc5e2374396f86646b5aeb2a`
- package-lock Git blob: `bb805f8a5558bf1eebe6d57d8292f7f69cb06d5a`
- observed reproduction toolchain: Node `v24.19.0`, npm `11.19.0`

It builds successfully from clean isolated worktrees with the exact legacy lockfile and recorded toolchain, but the generated HTML bytes are not stable across builds。Phase 1A observed:

- build file count: `90`
- raw dist manifest 1: `570f9ae9419136c5ae47ea49e0000d43b20df44e86bbd41d010bea1680d928f6`
- raw dist manifest 2: `235c3fe4083645eb65990a15d7c38e05579d67fde4346daedbf7d5f73cad7358`
- differing artifacts: `30` HTML files
- endpoint digest: `3bdb9ced87a60ee4bb9d52c680b274ba1ed8438e813fd7d0c09ee5e39879fd92`

The relevant legacy ordering code has incomplete final tie-breakers:

- published entries: `(pubDate DESC)` only;
- related Blog posts: `(score DESC, pubDate DESC)` only;
- featured projects: `(featuredOrder ASC with missing = MAX_SAFE_INTEGER, pubDate DESC)` only。

Equal complete sort-key tuples therefore have no legacy-defined final order。Changing the frozen legacy source merely to add a tie-breaker would destroy the source identity that reproduction is intended to test。

## Decision

Propose `legacy-build-equivalence-v1` as the only initial legacy reproduction profile。

“Legacy build reproduced” does not always require all generated output bytes to be identical。It requires the exact frozen application to be rebuilt from exact source, dependency, and toolchain identity, with all observed variance either absent or completely explained by a versioned, explicitly permitted equivalence rule。

Raw byte identity remains the stronger special case。When it holds, evidence records `rawByteIdentical = true`。When it does not hold, reproduction may pass only if every difference is positively proven equivalent under the narrow rules below。

The normative proposed contract is `../../contracts/legacy-build-reproduction-contract.md`。

## Exact reproduction identity

Every reproduction binds and verifies:

- repository;
- annotated tag name and tag object SHA;
- peeled commit SHA;
- `package-lock.json` Git blob SHA;
- Node version;
- npm version;
- ordered build commands equivalent to `npm ci`, `npm run check`, `npm run build`。

At least two clean isolated builds are required。Tracked legacy source must remain byte-identical before and after each build。

## Exact invariants

The following are not equivalence-normalized:

1. Both builds expose exactly the same public endpoint set, and that set agrees with the deterministic migration inventory route model where applicable。A missing or new endpoint is failure。
2. Every non-HTML output is byte-identical。For v1 this includes JavaScript, CSS, images, fonts, `robots.txt`, XML/sitemap, and all other non-HTML static artifacts。
3. HTML page regions outside proven tie sequences remain byte-identical, and item membership, link/target identity, and rendered material content are unchanged。
4. Items with unequal complete declared legacy sort-key tuples keep the same relative order。

## Tie-equivalent permutation

Two output sequences are tie-equivalent only when all of the following are proven:

1. they contain the exact same item identities;
2. each item has the same rendered material content and link/target identity;
3. items with unequal declared legacy sort keys remain in the same relative ordering;
4. only items whose complete declared legacy sort-key tuple is equal permute。

No item may disappear, appear, change target/content identity, cross a non-equal sort key, or change rendered material content。

## Approved v1 tie classes

`legacy-build-equivalence-v1` recognizes only:

1. Published-entry ordering: `(pubDate DESC)`; equal `pubDate` items may permute。
2. Related Blog ordering: `(score DESC, pubDate DESC)`; only items equal on both keys may permute。
3. Featured Project ordering: `(featuredOrder ASC with missing = MAX_SAFE_INTEGER, pubDate DESC)`; only items equal on both effective keys may permute。

This is not a filename allowlist and is not a generic ignore-differences facility。The observed 30 paths are evidence, not authorization for those files to differ for any reason。A new variance class requires another explicit design review。

## Comparison representation boundary

A validator may construct a versioned comparison representation solely to prove equivalence。It must not modify the legacy source, tag, generated dist, or generated HTML; normalize the historical output in place; or publish a synthetic canonical legacy site as historical output。

The extractor must establish item boundaries, identities, rendered material content/link identity, and applicable legacy sort keys from bounded static evidence。If it cannot prove equivalence, the result is failure。

## Evidence and result semantics

Machine evidence preserves every observed raw dist manifest SHA。It must not collapse genuinely different outputs into one synthetic `distManifestSha256`。

A reproduction is `PASS` only when exact tag/commit/lock/toolchain/source identity is verified; install, check, and build succeed; at least two isolated builds are observed; endpoint sets match each other and the inventory; non-HTML artifacts are byte-identical; and every HTML difference is completely classified as a permitted tie-equivalent permutation with no unexpected variance。

It is `FAIL` on tag/commit/lock mismatch, source mutation, command failure, endpoint mismatch, non-HTML byte mismatch, HTML membership/material-content/link change, movement across unequal sort keys, unrecognized variance, or inability to prove equivalence。Uncertainty fails closed。

## Baseline implication

A future accepted and implemented compact baseline distinguishes:

- `reproductionStatus`;
- `rawByteIdentical`;
- `equivalenceVerified`;
- `equivalenceProfileId`;
- all observed raw dist manifest SHAs;
- endpoint-set and non-HTML manifest identities;
- differing HTML artifact count and permitted tie-permutation count。

The current machine baseline remains valid historical evidence and must not be edited to claim `PASS` in this design pass。

## Alternatives

### Require raw dist byte identity unconditionally

This treats genuine, characterized ordering freedom in immutable legacy code as non-reproducibility and would incentivize changing the frozen source, so it is rejected for the proposed v1 definition。Raw byte identity remains preferred and is recorded when present。

### Ignore changed HTML paths

This cannot distinguish harmless tie permutations from missing content, changed links, or ordering regressions, so it is rejected。

### Add deterministic tie-breakers to legacy source

This changes the artifact under reproduction and is rejected。

## Consequences

- reproduction can describe genuine legacy behavior without falsifying raw hashes;
- endpoint and non-HTML regressions remain byte-exact failures;
- HTML variance requires positive semantic proof, not normalization by omission;
- comparison implementation is more complex and remains a later remediation task;
- any unexpected variance returns to design review rather than expanding v1 silently。

## Related

- `../../contracts/legacy-build-reproduction-contract.md`
- `../../migration/legacy-freeze-2026-08-28.md`
- `../../operations/validation.md`
- `../../architecture/design-status.md`
- `0025-clean-room-phase-gate-and-design-lifecycle.md`
