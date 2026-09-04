---
status: proposed
owner: architecture
last_verified: 2026-09-04
canonical_for:
  - proposed ranked finite-prefix boundary tie equivalence amendment
---

# Legacy Build Ranked Prefix Boundary Tie Equivalence Amendment

## Amendment status

This is a **post-Freeze proposed amendment** associated with ADR-0031. It is not accepted by ADR-0028, ADR-0030, or their existing acceptance records.

Until a fresh clean-room design audit passes and the operator explicitly accepts ADR-0031, the current comparator must continue to reject sequence membership differences.

## Parent contract

Parent accepted semantics:

- `legacy-build-reproduction-contract.md`
- profile `legacy-build-equivalence-v1`
- ADR-0028 exact-membership tie permutation rules
- ADR-0030 independent frozen Astro/React island `uid` variance class

This proposal adds one membership-variance class for code-proven finite ranked prefixes. It does not change exact source identity, endpoint equality, non-HTML byte equality, or fail-closed handling of unknown HTML variance.

## Proposed class

ID:

```text
ranked-prefix-boundary-tie-v1
```

It permits different selected identities only when an equal complete sort-key group straddles an exact finite prefix cutoff and both naturally generated outputs independently satisfy the same frozen ranking/truncation semantics.

## Frozen scope

```text
legacy repository: Xpotato1024/xpotato-site
legacy tag: legacy-pre-vnext-2026-08-28
legacy tag object: 8503f5a50a5fb3d27a02422da0b50dc66c818b02
legacy commit: 927d105713561309fc5e2374396f86646b5aeb2a
legacy package-lock blob: bb805f8a5558bf1eebe6d57d8292f7f69cb06d5a
```

Initial recognized regions are only:

1. Home latest Blog region on `/`
   - eligible universe: all published Blog entries
   - complete rank key: `(pubDate DESC)`
   - limit: `3`
   - renderer: frozen `ArticleCard compact=true`

2. Related Blog region on frozen published Blog detail pages
   - eligible universe: all published Blog entries except current post
   - complete rank key: `(score DESC, pubDate DESC)`
   - exact score implementation: create a set from current-post tags; count candidate-tag **occurrences** whose value is in that set; `score = occurrenceCount * 4`; add `2` when current and candidate category strings are both present/equal
   - limit: `3`
   - renderer: frozen `ArticleCard compact=true`

No other finite sequence, pagination boundary, feed/search result, Featured Project sequence, or later call site inherits this class.

## Formal boundary proof

For a recognized region define:

- `C`: exact eligible candidate universe from frozen Git source;
- `K(x)`: complete accepted sort-key tuple;
- `N`: exact finite prefix limit;
- `G1...Gm`: candidates partitioned into equal-key groups ordered by `K`;
- `Gj`: first group whose cumulative count reaches or exceeds `N`;
- `P = G1 ∪ ... ∪ G(j-1)`;
- `B = Gj`;
- `r = N - |P|`.

If `|C| <= N`, this amendment does not permit membership variance.

Each rendered sequence `S` must independently prove:

1. `|S| = min(N, |C|)`;
2. every candidate in `P` appears exactly once;
3. exactly `r` distinct candidates from `B` appear;
4. no candidate below `B` appears;
5. no candidate outside `C` appears;
6. unequal key groups remain in declared order;
7. only order inside an equal-key group is unconstrained.

Two outputs may have different membership only when both pass this proof against identical `C`, `K`, and `N`, and every identity in the symmetric membership difference belongs to `B`.

## Candidate-universe proof

The candidate universe must be reconstructed from the exact frozen Git source, not inferred from the two rendered sequences.

For each candidate, deterministic evidence must bind enough source data to recompute eligibility and the complete ranking key, including:

- route / legacy identity;
- collection;
- draft/published state;
- `pubDate`;
- category;
- tags with original order and multiplicity;
- current route for Related Blog calculation where applicable.

For Related Blog, the score computation must exactly reproduce the frozen implementation. In particular, it must not replace the candidate-side occurrence count with a deduplicated set-intersection cardinality.

The candidate universe plus computed key groups must have a deterministic SHA-256 identity using repository canonical JSON rules.

Missing, ambiguous, unparseable, duplicate-identity, or non-finite candidate evidence is `FAIL`.

## Rendered material and template proof

The boundary class does not authorize arbitrary item-content or markup replacement.

Every selected item must be positively identified as one frozen compact Blog card and validated against an expected representation derived from **both** exact frozen source metadata and the exact frozen `ArticleCard.astro` renderer with `compact=true`.

### Complete expected representation

For a selected card, the validator must prove all of the following:

1. exact element/node tree and child order;
2. exact attribute names, multiplicity, and values;
3. exact static classes and `class` values produced by the compact renderer;
4. exact `data-*` attributes, including `data-reveal="card"` and the source-derived `data-category`;
5. exact ARIA attributes, including the CTA arrow's `aria-hidden="true"`;
6. exact wrapper/list structure and tag order;
7. exact static text/CTA text;
8. exact source-derived text/targets/datetime values;
9. no extra node, attribute, text, wrapper, dynamic field, or omitted expected field.

The proof must not treat classes, accessibility metadata, static attributes, or wrappers as ignorable merely because they do not affect ranking.

### Source-derived fields

The expected source-derived payload includes:

- one exact Blog route / anchor target;
- exact category identity and displayed category label under the frozen category mapping;
- exact publication datetime and displayed date under the frozen formatter;
- exact title;
- exact description;
- exact first three visible tags in source order and multiplicity (`tags.slice(0, 3)`);
- exact fixed CTA label.

### Shared vs selected-only identities

For identities rendered in both builds, exact rendered item bytes remain required as in ADR-0028.

For identities rendered on only one side because of the cutoff tie, the full source-and-template-bound expected representation proof above is required. A selected-only card that cannot be positively proved in full is `FAIL`.

Static region gaps/shell bytes outside item material must remain exact.

## Comparison representation

The comparator may create a comparison-only canonical token after all proof requirements succeed.

That token may represent the ranked-prefix region by:

- region identity;
- exact limit;
- candidate-universe digest;
- strict-prefix identities;
- boundary key and candidate identities;
- required boundary selection cardinality;
- validated static shell/gaps;
- validated source/template-bound material identities.

The comparator must not modify either generated dist tree, rewrite historical HTML, synthesize a canonical legacy site, or replace raw artifact manifests.

## Machine evidence

A later implementation should emit an additive evidence collection equivalent to:

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

Evidence should be emitted separately from existing `permittedGeneratedMetadataVariances` and from tie-permutation counts.

`permittedTiePermutationCount` retains its accepted ADR-0028 meaning and must not count boundary membership changes.

A PASS result may add a separate `permittedBoundarySelectionVarianceCount` or equivalent field that equals the number of positively proved ranked-prefix regions with different membership.

Raw build manifests and raw HTML remain preserved as observed.

## Exact allowed example

Suppose `N = 3` and ordered key groups are:

```text
G1 = { A }
G2 = { B, C, D, E }
G3 = { F, G }
```

A valid output must contain:

```text
A + exactly two distinct members of { B, C, D, E }
```

Therefore these two natural outputs may be equivalent after complete material/template proof:

```text
[A, B, C]
[A, D, B]
```

These outputs are not valid:

```text
[B, C, D]      # A missing
[A, B, F]      # lower-ranked F selected
[A, B]         # wrong cardinality
[A, B, B]      # duplicate
[A, B, X]      # X outside candidate universe
```

## Failure semantics

The class must fail closed on any of:

- unrecognized path/region/call site;
- unknown or inconsistent limit;
- candidate universe reconstruction failure;
- candidate-universe digest inconsistency;
- output cardinality mismatch;
- missing strict-prefix candidate;
- lower-ranked selected candidate;
- out-of-universe candidate;
- duplicate selected identity;
- membership delta outside the exact boundary group;
- incomplete or unequal sort tuple treated as a tie;
- Related score computation that does not reproduce candidate-tag occurrence semantics;
- unequal-key order inversion;
- source-derived material mismatch;
- any static renderer node/class/attribute/ARIA/data-*/wrapper/text mismatch;
- unknown card structure or unexpected/missing field;
- unexplained shell/gap difference;
- endpoint mismatch;
- non-HTML byte mismatch;
- frozen source/tag/lock/toolchain mismatch;
- any remaining HTML variance outside independently accepted classes.

Uncertainty is `FAIL`.

## Prohibited implementations

Do not implement:

- retry-until-green CI behavior;
- global suppression of `Sequence membership differs`;
- equality based only on rendered list length;
- equality based only on `score` without `pubDate` for Related Blog;
- deduplicated set-intersection scoring when the frozen code counts candidate tag occurrences;
- arbitrary equal-date membership replacement outside recognized top-N call sites;
- filename/path allowlists that bypass candidate-universe proof;
- semantic-only card checking that ignores classes/ARIA/data-* or other static renderer output;
- mutation of frozen source to add a deterministic tie-breaker;
- environment-specific file enumeration as the semantic authority;
- normalized HTML emitted or published as historical legacy output.

## SoT / adoption boundary

This proposal is not current accepted validation semantics by itself.

The affected SoT must expose both states unambiguously:

- before acceptance: sequence membership differences remain `FAIL`;
- after a fresh clean-room PASS + explicit operator acceptance: only the exact `ranked-prefix-boundary-tie-v1` proof described here may admit bounded cutoff membership variance.

`docs/README.md` should expose this amendment as proposed/not accepted, and `docs/operations/validation.md` should describe the conditional future exception without activating it early. Acceptance is recorded separately through lifecycle authority; the accepted ADR-0028 parent contract is not retroactively rewritten.

## Current observed motivation

PR #49 run `33794765738` and its diagnostic rerun both failed on the same sequence membership rule while all frozen build commands completed. On `/blog/2025-10-06/`, the observed boundary selected either:

```text
/blog/gale-adaptive-multi-run-review/
```

or:

```text
/blog/gale-adaptive-review-checklist/
```

behind the same higher-ranked item set. The home latest-three region exhibited the same top-three boundary phenomenon.

This observation motivates the proposal; it is not an accepted PASS claim.

## Non-goals

- changing frozen legacy source or dependency versions;
- declaring one arbitrary tied member canonical;
- broadening complete-sequence membership equivalence;
- changing vNext content discovery semantics;
- changing media, provider, deploy, cutover, or legacy deletion gates.

## Related

- `../design/adr/0031-ranked-prefix-boundary-tie-equivalence.md`
- `legacy-build-reproduction-contract.md`
- `legacy-build-astro-island-uid-amendment.md`
- `../architecture/design-status.md`
- `../operations/validation.md`
- `../governance/audit.md`
