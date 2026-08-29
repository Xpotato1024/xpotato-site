---
status: supporting
owner: migration
last_verified: 2026-08-29
canonical_for: []
---

# Legacy Visual / Performance Baseline — 2026-08-29

## Purpose

This is the Phase 1B observational baseline for the exact frozen legacy site. It exists to give later migration/parity review a reproducible visual reference set and a measured lab-performance reference without inventing new hard performance budgets.

It is **not** production field telemetry, a Core Web Vitals compliance certificate, a pixel-equality CI gate, or migration/cutover authorization.

Phase 1A legacy freeze/inventory/reproduction was already accepted and merged before this capture task began. Migration/cutover, old implementation deletion, Cloudflare/R2/DNS mutation, production deployment, and production external-AI activation remain independently blocked.

## Frozen source identity

```text
repository: Xpotato1024/xpotato-site
tag: legacy-pre-vnext-2026-08-28
tag object SHA: 8503f5a50a5fb3d27a02422da0b50dc66c818b02
peeled commit: 927d105713561309fc5e2374396f86646b5aeb2a
package-lock blob SHA: bb805f8a5558bf1eebe6d57d8292f7f69cb06d5a
```

The capture command builds this detached immutable snapshot with exact lockfile semantics. It does not patch legacy source/dependencies and verifies tracked legacy source remains unchanged.

## Capture implementation / reviewed run

Reviewed capture implementation revision:

```text
b3fa938edee5de53cd9bfbf29eebbe8e4f95b834
```

GitHub-hosted capture:

```text
workflow: Legacy visual and performance baseline
run: 33241358064
job: 99071144392
result: PASS
artifact ID: 9711461055
artifact digest: sha256:e3b18a85dd27dc881039005f717dcf4e6500df0c9753c56fdf58ad3defa58202
```

Observed environment:

```text
runner OS class: ubuntu-24.04 / Linux x64
Node: v24.19.0
Chrome: Google Chrome 151.0.7922.173
capture profile: legacy-visual-performance-v1
```

The complete Actions artifact contains:

- `capture-report.json` — detailed runtime/resource observations;
- `compact-baseline-candidate.json` — reviewed compact observations promoted to the Git fixture;
- 12 full-page PNG screenshots.

The PNG files are **artifact-only** and are not committed to Git. This preserves the vNext raster-media guard while retaining visual legacy evidence for review.

## Capture matrix

Viewports:

| ID | Width | Height | DPR | Mobile emulation |
|---|---:|---:|---:|---|
| desktop | 1440 | 900 | 1 | no |
| mobile | 390 | 844 | 1 | yes |

Representative routes:

| ID | Path | Route class |
|---|---|---|
| home | `/` | home |
| blog-archive | `/blog/` | archive |
| blog-category-diary | `/blog/category/diary/` | generated archive |
| vibration-robot | `/blog/vibration-robot/` | content / LegacyHtml fixture |
| xpotato-site | `/projects/xpotato-site/` | Project / raster fixture |
| prime-factorizer | `/tools/prime-factorizer/` | interactive Tool fixture |

Total: **6 routes × 2 viewports = 12 observations / 12 screenshots**.

The reviewed run recorded zero failed browser requests and zero `console.error` calls for all 12 observations.

## Reviewed lab observations

These values are observations from the reviewed hosted run, not pass/fail thresholds.

| Route | Viewport | FCP ms | LCP ms | CLS | Observed transfer bytes | CSS | Image | JS | DOM elements |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| home | desktop | 452 | 712 | 0.002141 | 2,203,307 | 220,297 | 1,983,010 | 0 | 447 |
| blog-archive | desktop | 396 | 396 | 0.006455 | 220,297 | 220,297 | 0 | 0 | 820 |
| blog-category-diary | desktop | 348 | 348 | 0.008007 | 220,297 | 220,297 | 0 | 0 | 615 |
| vibration-robot | desktop | 328 | 408 | 0.205672 | 1,327,725 | 220,297 | 1,107,428 | 0 | 291 |
| xpotato-site | desktop | 216 | 216 | 0.012079 | 1,441,022 | 220,297 | 1,220,725 | 0 | 145 |
| prime-factorizer | desktop | 196 | 196 | 0.107518 | 223,263 | 220,297 | 2,966 | 0 | 154 |
| home | mobile | 268 | 268 | 0 | 2,202,998 | 220,297 | 1,982,701 | 0 | 447 |
| blog-archive | mobile | 352 | 352 | 0 | 220,297 | 220,297 | 0 | 0 | 820 |
| blog-category-diary | mobile | 272 | 272 | 0 | 220,297 | 220,297 | 0 | 0 | 615 |
| vibration-robot | mobile | 300 | 300 | 0 | 1,327,725 | 220,297 | 1,107,428 | 0 | 291 |
| xpotato-site | mobile | 172 | 172 | 0 | 1,441,022 | 220,297 | 1,220,725 | 0 | 145 |
| prime-factorizer | mobile | 152 | 152 | 0 | 223,263 | 220,297 | 2,966 | 0 | 154 |

Resource transfer categories are mutually exclusive in the adopted capture implementation. The normal baseline integrity check requires the recorded categories to sum exactly to the total observed transfer bytes.

### External resources

The detailed report records external origins separately. The reviewed capture observed:

- `https://fonts.googleapis.com` on the representative pages;
- `https://assets.xpotato.net` additionally on `vibration-robot`.

Resource Timing `transferSize` is an **observable browser value**, not guaranteed total wire bytes for cross-origin resources. Cross-origin responses without suitable timing exposure may report zero body/transfer details. External origins are therefore retained separately from observed byte totals.

### PrimeFactorizer JavaScript observation

The compact baseline records `javascriptTransferBytes = 0` for the initial PrimeFactorizer captures. This must **not** be interpreted as “the Tool has no JavaScript” or as a vNext bundle target.

The frozen Tool is a React `client:visible` island. Under this initial-load capture profile, the island may not enter the viewport and hydrate during the measurement window. Phase 1B intentionally does not synthesize a scroll/interaction workload. A later measured Tool/runtime task should deliberately trigger hydration before setting any interactive bundle/performance budget.

## Performance semantics and limits

Capture behavior:

- browser cache disabled and cleared between route captures;
- local static server uses `Cache-Control: no-store`;
- reduced-motion emulation enabled;
- animations/transitions disabled after load before screenshot capture;
- page images and fonts are given a bounded settle period;
- current-page DOM element count is captured rather than process-global cumulative Chrome node/heap counters;
- no credentials are exposed to the browser/capture process;
- no provider write/mutation occurs.

Interpretation:

- FCP/LCP/CLS are **hosted local lab observations**;
- they are not field p75 Core Web Vitals evidence;
- INP is not measured because Phase 1B defines no representative interaction workload;
- no hard KiB/latency/CLS/LCP budget is created by this baseline;
- exact thresholds remain measurement-driven design values for later vNext route-class benchmarking.

The desktop `vibration-robot` CLS observation (`0.205672`) and desktop PrimeFactorizer CLS observation (`0.107518`) are preserved as legacy observations rather than converted into acceptance thresholds or silently normalized away.

## Screenshot evidence semantics

Each reviewed screenshot is represented in the committed compact fixture by SHA-256 and byte size. Those hashes identify the **reviewed artifact from run 33241358064**.

They are not a requirement that a later clean Chrome capture reproduce byte-identical PNG output. Browser version, font rasterization, accepted legacy ordering variance, and rendering implementation details can change PNG bytes without establishing a semantic visual regression.

Later parity review should use the retained artifact as human/visual evidence and may add an explicitly designed visual-diff tolerance/profile. Normal CI validates baseline integrity and coverage; it does not regenerate screenshots and demand pixel identity.

## Machine integration

Commands:

```text
npm run migration:legacy:baseline:capture
npm run migration:legacy:baseline:check
```

`baseline:capture` is the expensive browser capture and remains a dedicated workflow/explicit command.

`baseline:check` is lightweight and belongs to normal vNext CI. It verifies:

- exact frozen repository/tag/tag-object/commit/lock identity;
- exact capture profile, viewports, and representative routes;
- exactly one screenshot and measurement record for every route×viewport pair;
- screenshot SHA/size record validity;
- finite/non-negative observation fields;
- resource-category accounting consistency;
- no PNG/JPEG/WebP/etc. screenshot fixture is committed alongside the compact JSON.

It intentionally does **not** convert reviewed performance numbers or screenshot hashes into deterministic regeneration thresholds.

## Phase status

The hosted evidence and compact baseline complete the intended Phase 1B implementation candidate. A separate fresh read-only Phase 1B audit of the final exact feature-branch SHA is still required before Phase 1 is declared accepted/closed.

Even after Phase 1 completion, migration/cutover remains blocked by later content, taxonomy, media, route, provider, recovery, rollback, and parity gates.
