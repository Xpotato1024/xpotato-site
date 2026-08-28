---
status: supporting
owner: migration
last_verified: 2026-08-28
canonical_for: []
---

# Legacy Freeze — 2026-08-28

## Scope and gate

Phase 1A froze the legacy production-source snapshot and created deterministic inventory evidence。The old build itself was **not reproducible across clean checkouts**, so Phase 1A is **FAIL / incomplete**。It did not allocate vNext ContentIds, migrate content/media/taxonomy/routes, delete the old implementation, perform cutover, deploy, or mutate Cloudflare/R2/DNS。

Migration/cutover remains **BLOCKED**。Phase 1B screenshot/performance capture is not included here。

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

## Legacy build reproduction

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
dist manifest SHA-256: no stable identity
observed manifest #1: 570f9ae9419136c5ae47ea49e0000d43b20df44e86bbd41d010bea1680d928f6
observed manifest #2: 235c3fe4083645eb65990a15d7c38e05579d67fde4346daedbf7d5f73cad7358
repeated build: FAIL
differing artifacts: 30 HTML files
```

Both builds completed and emitted 66 HTML pages plus robots/sitemap endpoints。The 69 built endpoint paths and all non-HTML assets matched, but 30 HTML files differed between separate clean worktrees in the recorded reproduction。The legacy package source remained byte-identical; dependencies were not upgraded or patched。

The exact cause is under-specified tie ordering in frozen legacy code。`getPublishedEntries()` sorts only by `pubDate`; related articles sort only by score then `pubDate`; featured projects sort only by `featuredOrder` then `pubDate`。When those keys are equal, Astro content-loader completion order becomes the effective tie-breaker, and that order changes between clean checkouts。This changes article lists, related-article cards, and featured-project order in generated HTML。

The behavior reproduced on Windows Node v24.19.0/npm 11.19.0, Windows Node v22.23.2/npm 10.9.8, and WSL2 Linux Node v24.14.0/npm 11.9.0。The Linux comparison still changed 36 HTML files。Changing the frozen source or injecting a synthetic ordering rule would violate the immutable-snapshot reproduction boundary, so the full reproduction command fails closed and preserves exact manifest/difference evidence under `.local/migration/legacy-pre-vnext-2026-08-28/build/`。

## Remaining migration blockers

- **inventory integrity blocker:** the frozen legacy build has no deterministic cross-checkout dist manifest identity
- no vNext ContentId allocation or content disposition mapping
- all 72 routes lack migration parity disposition
- all raw taxonomy terms await review/mapping
- the React Tool awaits Interactive Module Registry migration disposition
- both LegacyHtml records await manual conversion review
- Git and non-local media await semantic mapping, ingest/publication/protection/recovery work
- provider counterpart/redirect activation remains blocked
- rollback/cutover parity is not established
- Phase 1B screenshot/performance baseline is not captured

Except for the explicitly identified legacy-build nondeterminism, the remaining items are expected future migration blockers。None of them is cutover PASS evidence。
