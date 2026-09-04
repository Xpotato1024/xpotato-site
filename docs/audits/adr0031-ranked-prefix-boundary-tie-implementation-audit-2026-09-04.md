---
status: historical
owner: architecture
observed_at: 2026-09-04
canonical_for:
  - historical ADR-0031 implementation audit observation
---

# ADR-0031 Ranked Prefix Boundary Tie — Implementation Audit — 2026-09-04

## Verdict

**PASS — P0=0 / P1=0 / P2=1**

This report is a read-only clean-room implementation audit observation. It does not redefine architecture and does not by itself authorize deploy/cutover/provider mutation.

## Exact audit target

```text
repository: Xpotato1024/xpotato-site
PR: #51
base: 1d3e4d28dbed402b1c106aa1c847e6aed464f6b7
audited implementation revision: 9945ce2fcea8c21ae99c262808174acb23738ab0
design authority: ADR-0031 accepted by amendment-acceptance-adr-0031-2026-09-04.md
frozen legacy commit: 927d105713561309fc5e2374396f86646b5aeb2a
```

The audited implementation revision is one commit over the accepted design main revision and changes exactly seven files.

## Evidence boundary

Read from the audited revision / accepted repository authority:

- `docs/design/adr/0031-ranked-prefix-boundary-tie-equivalence.md`
- `docs/contracts/legacy-build-ranked-prefix-boundary-tie-amendment.md`
- `docs/design/amendment-acceptance-adr-0031-2026-09-04.md`
- `docs/governance/audit.md`
- `docs/governance/severity.md`
- `packages/site-validators/src/legacy-equivalence.ts`
- `packages/site-validators/src/legacy-ranked-prefix-equivalence.ts`
- `packages/site-validators/src/legacy-reproduce-cli.ts`
- ADR-0031 unit/integration tests
- `tests/fixtures/migration/legacy-adr0031-observed-boundary-witness.json`
- exact frozen source required to reconstruct Blog ranking/card semantics
- GitHub-hosted CI/reproduction evidence for the audited SHA

PR #49/run history is used only as observed regression provenance, not as architecture authority.

## Hosted gates on audited SHA

### vNext CI

```text
run: 33864718186
job: 100996835986
result: SUCCESS
```

Observed:

- 26 test files passed
- 210 tests passed
- exact prior-failure witness test passed against all 44 frozen Blog records
- typecheck passed
- repository validation passed
- Astro check passed with 0 errors / 0 warnings / 0 hints
- site build/security/search/static validation passed

### Legacy reproduction evidence

```text
run: 33864717978
job: 100996835044
artifact: 9933828284
artifact digest: sha256:183f2d3f133888bc5cc44c6cbb2c2ab74dfee8e90dc45442cc898667ad46846e
result: SUCCESS
```

Evidence result:

```text
status: PASS
rawByteIdentical: false
equivalenceVerified: true
permittedTiePermutationCount: 2
permittedBoundarySelectionVariances: 0 for this natural run
permittedGeneratedMetadataVariances: 1
endpointPathsSha256: 3bdb9ced87a60ee4bb9d52c680b274ba1ed8438e813fd7d0c09ee5e39879fd92 on both builds
nonHtmlManifestSha256: 2dc8ca780cab874fce931dfe227f2326498bf89788a80676e706b48efc8214c6 on both builds
```

The hosted pair did not naturally cross the ranked cutoff with different membership. This is not treated as proof that the class is unused or unnecessary. The exact earlier PR #49 failure artifact is preserved as deterministic regression witness and is replayed against the complete frozen 44-Blog candidate universe.

## Prior-failure witness

Regression provenance:

```text
workflow run: 33794765738
artifact: 9908740089
path: blog/2025-10-06/index.html
original failure: Sequence membership differs
```

The fixture retains only raw selected-card bytes/identities plus provenance. Candidate metadata is not duplicated in the fixture. The test reconstructs the entire Blog catalog directly from exact frozen Git commit `927d105...` using `git ls-tree` / `git cat-file` + the repository legacy frontmatter parser.

The observed pair proves:

- `/blog/codex-sqlite-write-amplification-mitigation/` is strict-prefix membership;
- the selected Gale posts belong to the same exact cutoff key group;
- exactly two boundary members are selected;
- the observed membership delta is confined to that cutoff group;
- selected compact cards match the frozen renderer/source projection.

An intermediate deliberately/mistakenly transcribed card-class mismatch caused vNext CI to fail with `Compact Blog source/renderer projection mismatch`, demonstrating that the regression witness actually enforces renderer material rather than merely list membership. The corrected raw fixture was verified against the machine-extracted old artifact bytes before the final audited revision was formed.

## Architecture/implementation reconstruction

### Scope recognition

The implementation admits the new proof only for:

1. `index.html` + published Blog sequence, corresponding to the frozen Home latest Blog top-3 call site;
2. frozen Blog-detail `blog/.../index.html` + Related sequence with a resolvable current Blog record.

No pagination/feed/search/Featured sequence receives the class.

### Candidate universe and ranking

The production reproduction CLI builds the catalog from exact frozen Git objects and now retains the source fields ADR-0031 requires: collection, route, title, description, pubDate, tags with multiplicity/order, raw category, draft state, and existing featured metadata.

The boundary proof filters exact published Blog candidates, excludes current post for Related, and computes:

- Home key: `(-pubDateMs)`;
- Related key: `(-score, -pubDateMs)`;
- Related score: candidate tag occurrence count against current-tag Set × 4, plus 2 for exact raw category equality.

### Boundary validity

Each side is independently required to prove:

- exactly three unique selected identities;
- all strict-prefix identities selected;
- only strict-prefix or boundary-group candidates selected;
- exact number selected from the boundary group;
- no lower-ranked/out-of-universe candidate;
- no unequal-key inversion;
- symmetric membership delta confined to the boundary group.

The class is unavailable unless a true tie group is truncated by the top-3 cutoff.

### Rendered material

For every selected card the implementation constructs the expected frozen `ArticleCard compact=true` representation from frozen metadata and frozen renderer semantics. Parsed structure retains text/comment child order and exact attribute names/values; raw parse errors including duplicate attributes fail closed.

Selected-only identities therefore cannot use the new class to hide changed classes, `data-*`, ARIA, wrappers, source text, dates, tags, route, or CTA. Shared identities additionally retain the pre-existing exact rendered-byte comparison.

### Comparator composition

The existing ADR-0028 path remains the default. Membership-identical sequences use the existing exact-material/tie-permutation proof. Only membership-different sequences attempt ADR-0031; inability to prove the class falls back to failure. ADR-0030 UID proof remains a separate preprocessing/evidence class.

Raw dist trees and manifests remain untouched.

## Findings

### P2-ADR0031-IMPL-01 — Stored evidence validator does not re-derive every cross-field relationship

**Severity: P2**

The runtime generator derives `RankedPrefixBoundaryTieVarianceEvidence` only after the full positive proof, and the raw source/build artifacts remain available for independent re-evaluation. `validateRankedPrefixBoundaryTieVarianceEvidence()` validates the expected field/type/basic-value shape but does not independently re-calculate every relation such as symmetric delta equality, boundary-subset membership, and strict-prefix/selection consistency from the evidence object alone.

Failure mode is therefore limited to a later standalone consumer accepting an internally inconsistent *copied/modified evidence object* if it trusts the shape validator without re-running proof. It does not let the current comparator classify invalid generated HTML as equivalent, because equivalence is decided before evidence emission from raw inputs.

**Done condition:** harden the evidence validator or add a dedicated re-evaluator that cross-checks the evidence fields and, when used as archival authority, binds/recomputes them against the exact frozen source identity.

This does not block the current implementation gate under the severity policy.

## No blocking findings

No P0/P1 finding was found for:

- accepted variance scope;
- exact frozen candidate authority;
- cutoff/ranking proof;
- candidate-tag occurrence semantics;
- selected-only complete renderer proof;
- shared identity exact material;
- unknown/non-recognized variance fail-closed behavior;
- ADR-0028/ADR-0030 separation;
- endpoint/non-HTML identity;
- source/tag/lock mutation boundary;
- provider/deploy/cutover safety boundary.

## Gate result

P0=0 and P1=0, therefore the ADR-0031 implementation gate may PASS.

This PASS permits normal PR review/merge of the audited implementation. It does not itself permit PR #49 merge until PR #49 is synchronized with the accepted implementation and its full checks are re-run. Production provider/deploy/cutover/legacy-deletion gates remain unchanged.
