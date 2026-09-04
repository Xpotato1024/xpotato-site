---
status: proposed
date: 2026-09-04
owner: architecture
---

# ADR-0031: Ranked finite-prefix cutoff may admit bounded boundary-tie membership variance

## Status boundary

This ADR is a **post-Freeze proposal**. It does not amend the accepted ADR-0028 / ADR-0030 reproduction semantics until a fresh clean-room design audit passes and the operator explicitly accepts this amendment.

The current machine comparator must continue to reject ranked-sequence membership differences until that acceptance and a later separate implementation change.

## Context

Frozen legacy identity remains:

```text
repository: Xpotato1024/xpotato-site
tag: legacy-pre-vnext-2026-08-28
tag object: 8503f5a50a5fb3d27a02422da0b50dc66c818b02
commit: 927d105713561309fc5e2374396f86646b5aeb2a
package-lock blob: bb805f8a5558bf1eebe6d57d8292f7f69cb06d5a
```

ADR-0028 accepted three ordering variance classes and deliberately required exact sequence membership. That is sufficient for a complete rendered sequence, but it is stronger than the frozen code semantics when a partially ordered sequence is truncated to a finite prefix.

PR #49 exact head `646a3c8edcef22a45f39dcd7a17bb45728f02110` exposed that gap in `Legacy reproduction evidence` run `33794765738`. The initial run and an explicit diagnostic rerun both failed with:

```text
Sequence membership differs at /html[0]/body[1]/main[2]/div[0]/section[1]/div[3]
```

Both clean legacy builds completed successfully. Endpoint identity and non-HTML identity remained equal. The failure is inside naturally generated HTML.

### Frozen ranked truncation paths

The exact frozen source has two relevant finite-prefix paths using the same Blog compact card rendering.

Home latest Blog list:

```ts
const blogPosts = await getPublishedEntries("blog");
const latestPosts = blogPosts.slice(0, 3);
```

`getPublishedEntries("blog")` ranks only by:

```text
(pubDate DESC)
```

Related Blog list:

```ts
const ranked = candidates
  .map(...)
  .sort((left, right) => score DESC, then pubDate DESC);
...
return [...preferred, ...fallback].slice(0, limit);
```

The only current call uses the default `limit = 3`. The declared ranking tuple is:

```text
(score DESC, pubDate DESC)
```

The frozen code has no final identity tie-breaker.

### Hosted observation

For `/blog/2025-10-06/`, one clean build rendered these related entries:

```text
/blog/codex-sqlite-write-amplification-mitigation/
/blog/gale-adaptive-conservative-planner/
/blog/gale-adaptive-multi-run-review/
```

and the other rendered:

```text
/blog/codex-sqlite-write-amplification-mitigation/
/blog/gale-adaptive-conservative-planner/
/blog/gale-adaptive-review-checklist/
```

The home latest-three region showed the same boundary membership change.

The two differing Gale entries have equal `pubDate` and, for the observed related page, equal related score. They are therefore indistinguishable under the complete ranking tuple actually declared by the frozen code. The membership difference occurs only because an equal-key group straddles the finite `slice(0, 3)` cutoff.

A rerun does not solve this. A pass can occur only when the arbitrary source order happens to select the same members from the boundary tie group in both builds.

## Decision proposal

Add one bounded variance class under the existing `legacy-build-equivalence-v1` profile:

```text
ranked-prefix-boundary-tie-v1
```

This class permits different selected identities **only inside the exact tie group that intersects a code-proven finite prefix cutoff**.

It does not permit arbitrary membership changes, arbitrary top-N sets, filename allowlists, broad HTML normalization, or modification of frozen source/output.

## Formal model

For one recognized ranked finite-prefix region, let:

- `C` be the exact eligible candidate universe reconstructed from frozen source;
- `K(x)` be the complete accepted legacy sort-key tuple for candidate `x`;
- `N` be the exact code-proven prefix limit;
- candidates be partitioned into ordered equal-key groups `G1, G2, ..., Gm` by `K`;
- `Gj` be the first group for which the cumulative candidate count reaches or exceeds `N`;
- `P = G1 ∪ ... ∪ G(j-1)` be the strict-prefix candidate set;
- `B = Gj` be the boundary tie group;
- `r = N - |P|` be the number of boundary-group members that must be selected.

When `|C| <= N`, the whole candidate universe is rendered and this amendment provides no membership relaxation.

A naturally generated output sequence `S` is a valid ranked-prefix realization only when all of the following hold:

1. `|S| = min(N, |C|)`;
2. every member of `P` appears exactly once in `S`;
3. exactly `r` distinct members of `B` appear in `S`;
4. no candidate ranked below `B` appears in `S`;
5. no candidate outside `C` appears in `S`;
6. unequal sort-key groups remain in declared order;
7. only order within an equal-key group is unconstrained by the legacy ranking.

Two builds may differ in membership only when **each build independently satisfies this validity proof against the same `C`, `K`, and `N`**, and the symmetric membership difference is a subset of `B`.

This is stronger than comparing the two rendered sequences to each other: each side must independently be proven to be a valid output of the frozen ranking/truncation semantics.

## Initial recognized call sites

`ranked-prefix-boundary-tie-v1` is initially limited to the exact frozen snapshot and these call sites.

### Home latest Blog

```text
route: /
collection: blog
rank: (pubDate DESC)
limit: 3
renderer: ArticleCard compact=true
```

### Related Blog

```text
route class: frozen published Blog detail routes
candidate universe: published Blog minus current post
rank: (score DESC, pubDate DESC)
limit: 3
renderer: ArticleCard compact=true
```

The related score remains the exact frozen formula implemented by `scoreRelatedPost`: construct a set from the current post tags, count candidate tag **occurrences** whose value is present in that set, multiply that count by `4`, then add `2` when the current and candidate category strings are both present/equal under the frozen comparison. This definition intentionally follows the exact frozen implementation rather than a mathematical set-intersection shorthand.

The current `preferred(score > 0) + fallback(score == 0)` split does not broaden the accepted ordering because this exact score function is non-negative and the preceding descending score sort already places positive scores before zero scores.

No other `slice`, pagination boundary, feed limit, search result limit, Featured Project region, or future call site inherits this class automatically.

## Candidate-universe proof

The comparator must reconstruct the candidate universe from the same exact frozen Git source identity used by reproduction. It must not infer candidate eligibility from only the two rendered outputs.

For every candidate, the proof must bind at minimum:

- route / stable legacy content identity;
- published/draft eligibility;
- `pubDate` used by the ranking;
- category and tags when the related score uses them;
- the exact current-post identity for a related region;
- the complete computed sort-key tuple.

The candidate universe and ordered key-group model must be deterministically hashable so evidence can be re-evaluated later.

## Rendered material proof

Membership relaxation at a boundary must not become permission to accept corrupted card content or markup.

Both recognized call sites render the exact frozen `ArticleCard` with `compact=true`. For every selected item, including an identity present on only one side, the comparator must positively validate a versioned expected compact-card representation derived from the exact frozen renderer and frozen source metadata.

The proof must validate **all** nodes, node order, attributes, attribute values, and text emitted by the frozen compact renderer. Source-derived fields are checked against their exact expected values; every non-source-derived/static renderer field must be byte/DOM-equivalent to the frozen template. No class, `data-*`, ARIA attribute, wrapper, list structure, static CTA text, or other markup may be silently ignored merely because it does not affect ranking.

The initial source-derived payload includes at least:

- exact Blog route / anchor target;
- exact `data-category` identity and displayed category label under the frozen category mapping;
- exact published datetime and displayed date under the frozen formatter;
- exact title;
- exact description;
- exact visible compact tag prefix (`tags.slice(0, 3)`), including order and multiplicity;
- exact fixed CTA label.

The expected structural/template proof includes the complete frozen compact-card element/attribute shape, including the exact static classes, `data-reveal`, tag/list wrappers, CTA wrapper, and `aria-hidden` marker on the arrow. Unexpected/missing nodes or attributes are `FAIL`.

Shared identities between both builds continue to require exact rendered item bytes, as in ADR-0028. Selected-only boundary identities require the full source-and-template-bound proof above.

The region gaps/static shell outside selected card material must remain exact. Page content outside independently proved ADR-0028, ADR-0030, and this ADR's bounded regions remains exact.

If the validator cannot prove a selected item's complete expected compact-card representation from frozen source + renderer evidence, it fails closed.

## Evidence requirements

A later implementation may add evidence equivalent to:

```ts
interface RankedPrefixBoundaryTieVarianceEvidence {
  kind: "ranked_prefix_boundary_tie";
  varianceClassId: "ranked-prefix-boundary-tie-v1";
  path: string;
  regionKey: string;
  sequenceKind: "published" | "related";
  limit: number;
  currentRoute?: string;
  candidateUniverseSha256: string;
  boundarySortKey: number[];
  strictPrefixIdentities: string[];
  boundaryCandidateIdentities: string[];
  selectedFromBoundaryCount: number;
  firstSelectedIdentities: string[];
  secondSelectedIdentities: string[];
  membershipDeltaIdentities: string[];
}
```

Equivalent field naming is permitted, but the evidence must preserve enough information to independently re-evaluate the proof.

Existing `permittedTiePermutationCount` keeps its current meaning: it counts equal-membership ordering permutations only. Boundary selection variance receives its own evidence collection/count and must not be hidden inside the permutation count.

Raw dist manifests remain preserved exactly. `rawByteIdentical` remains false whenever naturally generated membership differs.

## Failure semantics

The comparison remains `FAIL` when any of the following occurs:

- candidate universe cannot be reconstructed exactly;
- candidate universe differs from the exact frozen source identity;
- limit or recognized call-site identity is unknown;
- output cardinality is wrong;
- a strict-prefix candidate is missing;
- a candidate below the boundary group is selected;
- a selected identity is outside the eligible universe;
- a membership delta contains an identity outside the single boundary tie group;
- sort-key computation is unknown, non-finite, or inconsistent;
- unequal-key ordering changes;
- selected item content **or any expected compact-card markup/attribute/static field** does not match the frozen source+renderer projection;
- region shell/gaps contain unexplained bytes;
- a non-recognized finite-prefix path changes membership;
- non-HTML identity changes;
- endpoint identity changes;
- source/tag/lock/toolchain identity changes;
- any remaining HTML variance is not independently covered by an accepted class.

Uncertainty fails closed.

## Relationship to ADR-0028

ADR-0028 remains the parent reproduction model and remains unchanged for complete sequences.

This proposal changes only one previously absolute rule:

```text
HTML item membership difference => always FAIL
```

would become, only for a positively identified `ranked-prefix-boundary-tie-v1` region:

```text
HTML item membership difference => PASS only when both outputs independently prove
valid finite-prefix selection and all differing identities are confined to the exact cutoff tie group
```

For all other regions, ADR-0028 exact-membership semantics remain in force.

## Relationship to ADR-0030

ADR-0030 remains orthogonal. Astro island `uid` metadata variance may be proved independently before or after sequence proof. This amendment does not broaden generated metadata normalization.

## SoT adoption boundary

This proposal also requires the affected documentation SoT to remain lifecycle-consistent. Before this amendment can be accepted as current semantics:

- `docs/README.md` must expose this proposed amendment as the bounded extension of legacy reproduction semantics while clearly marking it unaccepted before operator adoption;
- `docs/operations/validation.md` must state the proposed exception without claiming it is active before acceptance;
- after a successful clean-room re-audit and explicit operator acceptance, the acceptance record + `architecture/design-status.md` become adoption authority for the exact audited proposal bytes.

The existing accepted parent contract is not rewritten retroactively.

## Alternatives

### Re-run until the workflow happens to pass

Rejected. This converts a semantic reproduction gate into a probabilistic gate and can mark identical code alternately PASS/FAIL.

### Pin one observed item order in the CI environment

Rejected. The frozen application itself does not declare that final order. Environment-specific discovery ordering is not the legacy content-ranking contract and is not a reliable cross-run guarantee.

### Add a slug tie-breaker to frozen source

Rejected. It changes the artifact being reproduced and destroys the exact legacy source identity.

### Ignore all membership differences inside equal sort keys

Rejected. Without a finite-prefix/candidate-universe proof, items could disappear from complete sequences or lower-ranked candidates could replace required items.

### Allow any equal-score Related Blog member to replace another

Rejected. `score` alone is not the complete related key; `pubDate` must also be equal. The amendment uses the complete accepted sort tuple.

### Remove exact rendered-material checking

Rejected. Ranking validity alone would not detect corrupted selected card content.

## Consequences

- reproduction becomes deterministic in verdict for the actual nondeterministic semantics of the frozen top-N paths;
- raw artifact differences remain truthful and preserved;
- higher-ranked membership and lower-ranked exclusion remain strict;
- the exception is limited to two exact frozen call sites and one exact boundary group per region;
- implementation complexity increases because candidate-universe and complete compact-card source/template proof are required;
- no provider, deploy, cutover, media publication, or legacy deletion authority changes.

## Related

- `0028-legacy-build-reproduction-equivalence.md`
- `0030-astro-react-island-uid-equivalence.md`
- `../../contracts/legacy-build-reproduction-contract.md`
- `../../contracts/legacy-build-ranked-prefix-boundary-tie-amendment.md`
- `../../architecture/design-status.md`
- `../../governance/audit.md`
