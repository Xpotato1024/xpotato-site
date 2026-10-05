# ADR 0038: Measured static delivery

Status: Accepted for Draft PR 65 (2026-10-05)

## Acceptance criteria

- Preserve the accepted typography, composition, navigation, code-copy behavior and existing content/security contracts.
- Measure before and after with the same browser, viewport, network, CPU and cache conditions; distinguish the private photo preview from public output.
- Reduce route CSS, downloaded fonts and review-photo bytes without adding browser libraries or build-time network access.
- Keep static pages at zero JavaScript, retain the registered Tool island and existing search runtime, and fail CI on asset-budget regressions.
- Keep all 44 held Blog articles and the workshop image outside normal public output. No deployment, account, credentials, DNS or storage mutation.

## Decisions and evidence

Original font definitions added about 103 KB gzip of CSS on every route. An Astro build integration now emits content-hashed, page-specific local font CSS. Original fonts and Unicode ranges remain available for future text; search receives the union of eligible public search content and local interface strings. Development still loads the complete local faces. Font files are self-hosted under the existing CSP.

Four offline core subsets consolidate frequently used glyphs from the existing fonts. The input records code points and original source hashes, never article bodies. FontTools 4.66.1 and Brotli 1.2.0 are pinned with wheel hashes for the documented CPython 3.12 / Windows x64 regeneration environment. Normal npm build and CI require neither Python nor downloads. Creation timestamps and hash seed are fixed; regeneration reproduces the checked-in bytes. All 1,330 core glyph outlines, advances and line metrics were compared against their source fonts. SIL OFL metadata remains intact. Node CI verifies original inputs, output hashes and content-addressed filenames.

A trial without font preloads caused an About-page CLS regression (~0.16). That configuration was rejected. Only core faces actually selected by a page are preloaded; original fallback slices are not indiscriminately preloaded. The final measurements in `docs/performance/review-performance-v1.json` record the resulting CLS.

The review-only workshop image uses a standard `picture` with AVIF, WebP and JPEG at 640/960/1440/1920 pixels. The existing photo-hero quality settings are reused through Sharp 0.35.4, already present in Astro's dependency graph and now explicitly pinned. The original remains private. Mobile sizes account for the tall hero's landscape-image cover crop; reducing to viewport width alone would visibly undersample it. Dimensions, eager loading, high fetch priority and object position preserve composition and avoid shifts. Generation refuses output outside a temporary directory; the preview flag still gates every reference. Public media conversion remains subject to the existing media/publication gates.

Only content-addressed `/_astro/*` and `/fonts/font-*.woff2` assets receive immutable one-year cache headers. HTML, unversioned copy scripts and search data retain the platform's revalidation behavior. CSP and other security headers remain unchanged. This is a source contract, not a claim of production CDN behavior.

`performance:check` runs after the one normal build in `ci:final`. It checks every emitted HTML page, linked CSS, recursive module dependencies, search data, image dimensions/loading and unexpected islands against measured budgets. Static-page JS is zero; code-copy, search and Tool have separate caps. It also validates font provenance. Timing is recorded by an opt-in local browser command, not a flaky CI LCP threshold.

## Tools considered

- [Astro Image/Picture](https://docs.astro.build/en/guides/images/) provides standard responsive transforms. The current photo is review-only and must not enter a public source pipeline; a contained Sharp generator plus native picture is sufficient. Sharp is Apache-2.0; its exact transitive native versions are recorded in the private generation report. No additional browser package is needed.
- [Astro fonts](https://docs.astro.build/en/guides/fonts/) supports local and provider workflows. Existing licensed local slices already supply the chosen families, so changing providers or adding remote retrieval would not address the measured route payload as directly.
- [FontTools subset](https://fonttools.readthedocs.io/en/latest/subset/index.html) and [merge](https://fonttools.readthedocs.io/en/latest/merge.html) enable reproducible offline consolidation. [FontTools is MIT licensed](https://github.com/fonttools/fonttools/blob/main/LICENSE); Brotli is MIT. Generated font derivatives remain SIL OFL. Provenance, tool versions and optional regeneration are committed.
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring) is an established alternative, but its aggregate score varies with host conditions. This change uses Chromium's native CDP and performance observers directly to record exact resource bytes plus repeatable LCP/CLS conditions. No Lighthouse score or audit is claimed.
- [Cloudflare static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/) permit the narrowly scoped cache rules. Fingerprinted assets can be immutable; public HTML and mutable search data must revalidate.

## Limits and follow-up

These are three-run local lab observations on simulated mobile networking/CPU, not field p75, INP, real-phone or production CDN results. No new external service or account was used. Real cache hits, Brotli negotiation, ETags, media publication and field metrics require the existing production approvals. The private responsive-image trial does not authorize publishing the workshop photo or held articles. See `docs/performance/README.md` for the evidence, commands and budgets.
