---
status: supporting
owner: migration
last_verified: 2026-08-29
canonical_for: []
---

# Legacy Freeze — 2026-08-28

## Scope and gate

Phase 1A froze the legacy production-source snapshot and created deterministic inventory evidence。The initial raw-byte reproduction attempt exposed genuine legacy output-order nondeterminism and therefore failed under the then-implicit byte-identity interpretation。

That observation was not erased。It led to post-Freeze ADR-0028/0029 and later ADR-0030, each separately clean-room audited and explicitly accepted by the operator。The current machine implementation now reproduces the frozen build successfully under the accepted, fail-closed characterized-equivalence contract while preserving every raw build manifest as evidence。

Current machine state on the migration-preparation feature branch:

```text
legacy inventory gate: PASS
legacy build baseline: PASS
hosted legacy reproduction: PASS — characterized equivalence
rawByteIdentical: false
equivalenceVerified: true
```

Phase 1A phase acceptance still requires a fresh read-only implementation re-audit of the final exact feature-branch SHA。This document does not self-certify that audit。

Migration/cutover remains **BLOCKED**。Phase 1B screenshot/performance capture is not included here。No vNext ContentIds were allocated, no content/media/taxonomy/routes were migrated, the old implementation was not deleted, and no Cloudflare/R2/DNS/deploy mutation was performed。

## Immutable legacy identity

```text
repository: Xpotato1024/xpotato-site
tag: legacy-pre-vnext-2026-08-28
tag type: annotated
tag object SHA: 8503f5a50a5fb3d27a02422da0b50dc66c818b02
peeled commit: 927d105713561309fc5e2374396f86646b5aeb2a
expected commit: 927d105713561309fc5e2374396f86646b5aeb2a
```

The tag object identity and peeled commit are machine-checked。CI never creates or replaces the tag。

## Deterministic inventory

```text
generator version: 1.0.0
hash rule version: legacy-source-bytes-v1
inventory payload SHA-256: 9151be197d9e48a12297d45dfdd2a72a15cf9ce16f143fdc16b60e5345d37493
repeated generation: PASS
```

`frontmatterSha256` hashes the exact UTF-8 source bytes between the opening and closing `---` delimiter lines, including the line terminator immediately before the closing delimiter and excluding the delimiters。`bodySha256` hashes the exact UTF-8 bytes after the closing delimiter line terminator。Neither hash uses reparsed or reformatted YAML。

`rawHtmlSha256` hashes the UTF-8 bytes of the safely decoded static string value passed to `LegacyHtml`/equivalent raw-HTML handling。No eval, dynamic module execution, MDX execution, or arbitrary expression execution is used。Git media hashes use exact Git blob bytes。

The canonical payload digest binds repository, exact commit/tag, generator/hash-rule versions, and canonically sorted content/route/media/taxonomy/interactive/LegacyHtml scan records。`generatedAt` is observational metadata and is excluded。Future migration disposition arrays are a separate decision layer and are not legacy snapshot bytes。

### Counts

| Record | Published | Total |
|---|---:|---:|
| Blog | 44 | 44 |
| Projects | 6 | 6 |
| Notes | 1 | 1 |
| Tools | 1 | 1 |
| Pages | 1 | 1 |

Additional exact inventory:

- content total: 53
- route identities: 72（69 built static/generated endpoints + 3 WordPress query identities）
- Git-backed media: 16 files / 4,559,586 bytes
- raw taxonomy records: 100
- user-facing interactive records: 1（`PrimeFactorizer.tsx` / React / `client:visible`）
- LegacyHtml records: 2（`vibration-robot` and `2025-10-06`; both `manual_review`）
- unresolved/non-local media locators: 2

Unresolved locators are preserved exactly:

- `/blog-placeholder-1.jpg` — referenced by four Blog entries but absent from the frozen Git tree
- `r2:/blog/my-first-post/GDCH3152.JPG` — referenced by `vibration-robot`; not hash-verifiable from repository evidence

No provider URL was guessed, and R2 was not accessed or mutated。

## Design-time inventory comparison

`current-site-inventory-2026-08-26.md` remains unchanged supporting evidence。Machine extraction deltas are:

- published content counts: 0 for every collection
- WordPress query identity count: 0
- Git media bytes: 0（exact machine total 4,559,586 bytes）
- interactive record count: 0
- route/taxonomy/LegacyHtml: exact Phase 1A machine baselines established; the design-time note did not define complete numeric totals

## Initial raw-byte reproduction finding

The original Phase 1A reproduction evidence remains historical evidence:

```text
source tag: legacy-pre-vnext-2026-08-28
source commit: 927d105713561309fc5e2374396f86646b5aeb2a
package-lock Git blob SHA: bb805f8a5558bf1eebe6d57d8292f7f69cb06d5a
Node: v24.19.0
npm: 11.19.0
npm ci: 0
npm run check: 0
npm run build #1: 0
npm run build #2: 0
build files: 90
observed raw manifest #1: 570f9ae9419136c5ae47ea49e0000d43b20df44e86bbd41d010bea1680d928f6
observed raw manifest #2: 235c3fe4083645eb65990a15d7c38e05579d67fde4346daedbf7d5f73cad7358
raw-byte repeated build: FAIL
differing artifacts in that observation: 30 HTML files
```

Both builds completed and emitted the same endpoint set and byte-identical non-HTML assets, but HTML ordering differed。The legacy source has under-specified equal-key ordering: `getPublishedEntries()` sorts only by `pubDate`; related articles sort only by score then `pubDate`; featured projects sort only by `featuredOrder` then `pubDate`。When complete legacy sort keys are equal, loader completion order becomes an implicit tie-breaker。

This behavior was also observed under Windows Node 22 and WSL2 Linux。The frozen source was deliberately not patched with artificial tie-breakers。

## Accepted reproduction semantics

ADR-0028 + `contracts/legacy-build-reproduction-contract.md` define `legacy-build-equivalence-v1`。Raw byte identity is the stronger special case, but a non-identical build may be reproduced only when all output variance is positively proven inside accepted classes。

Exact invariants remain:

- exact annotated tag object / commit / lockfile / Node / npm / command identity;
- at least two clean isolated builds;
- exact endpoint set and inventory agreement;
- every non-HTML artifact byte-identical;
- no HTML membership/material-content/link change;
- no movement across unequal complete sort keys;
- unknown or ambiguous variance = FAIL。

Accepted tie classes are limited to the legacy sort tuples defined in ADR-0028。

ADR-0030 adds one separately accepted generated-metadata class, `astro-react-island-uid-v1`, limited to the exact frozen PrimeFactorizer React `client:visible` binding。It may admit only a changed value of an already-present `astro-island uid` after proving all other island attributes, SSR children, DOM position, page bytes, interactive inventory binding, source identity, and non-HTML assets remain exact。Raw UID values remain recorded rather than rewritten as historical output。

## Hosted characterized-equivalence evidence

A successful hosted reproduction on implementation revision `96d3846b8ef9e62c280dfea25c92d02b636e166c` produced reviewed evidence used by the compact baseline:

```text
status: PASS
rawByteIdentical: false
equivalenceVerified: true
fileCount: 90
endpointPathsSha256: 3bdb9ced87a60ee4bb9d52c680b274ba1ed8438e813fd7d0c09ee5e39879fd92
nonHtmlManifestSha256: 2dc8ca780cab874fce931dfe227f2326498bf89788a80676e706b48efc8214c6
observed raw dist manifests:
  f3c8ef72cba6f7666f0d238f1102758fbfb9eb2f0038791acfee5a556738ceb0
  5578ac76e795671a84af1af1f3e9eab71dd93242335e70db41e098febc2fdc2d
observed differing HTML paths: 3
permitted tie groups: 2
permitted generated metadata variances: 1
```

Those raw manifest/count values are **observations from that reviewed run, not deterministic expected raw-output identities**。The deterministic invariants are the source identity, endpoint identity, non-HTML identity, and the positive equivalence proof rules。

A later hosted reproduction on final-candidate revision `44d47e73d26ff5bce821cf4fd391071e10b33cea` independently passed with a different valid raw manifestation:

```text
status: PASS
rawByteIdentical: false
equivalenceVerified: true
raw manifests:
  fe1ed82b973ab5e79fb81b4c99cb753ae739aba8a43cc5811d6870e5b06d39a2
  6b127c4f88f6d1e9ca3edd8ef4bdad125619909ef33ad40222ebf32bd41cbd7f
endpointPathsSha256: 3bdb9ced87a60ee4bb9d52c680b274ba1ed8438e813fd7d0c09ee5e39879fd92
nonHtmlManifestSha256: 2dc8ca780cab874fce931dfe227f2326498bf89788a80676e706b48efc8214c6
differing HTML paths: 4
permitted tie groups: 4
permitted generated metadata variances: 1
```

Every difference in the latter run was positively classified; no filename-level ignore rule is used。Generated evidence remains under `.local/migration/legacy-pre-vnext-2026-08-28/build/` during execution and the hosted workflow uploads it as an evidence artifact。

## Current Phase 1A machine gate

The committed compact baseline is schema version 2 and distinguishes:

- `status`;
- `rawByteIdentical`;
- `equivalenceVerified`;
- `equivalenceProfileId`;
- observed raw dist manifests;
- endpoint/non-HTML identities;
- observed differing HTML/tie/generated-metadata counts。

Normal vNext CI validates the baseline schema, immutable tag identity, deterministic inventory digest, design-time deltas, and cross-record invariants。The expensive two-build reproduction remains a dedicated workflow/explicit command rather than being nested into every normal CI run。

Current machine result:

```text
migration:legacy:check: PASS
legacyBuild.status: PASS
dedicated hosted reproduction: PASS
```

This is candidate evidence for Phase 1A acceptance; a separate fresh read-only audit is still required before that phase is declared accepted。

## Remaining migration work

The legacy build reproduction blocker is closed at the machine-evidence level, but later migration/cutover blockers remain:

- no vNext ContentId allocation or content disposition mapping
- all 72 routes still require migration parity disposition
- raw taxonomy terms await review/mapping
- the React Tool awaits final Interactive Module Registry migration disposition
- both LegacyHtml records await manual conversion review
- Git and non-local media await semantic mapping, ingest/publication/protection/recovery work
- provider counterpart/redirect activation remains blocked
- rollback/cutover parity is not established
- Phase 1B screenshot/performance baseline is not captured

These are expected later-phase blockers。None of the Phase 1A evidence authorizes migration/cutover, old implementation deletion, deployment, or provider mutation。
