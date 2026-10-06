# ADR 0039: Transparent glass after phone review

Status: Glass texture accepted after physical iPhone feedback (2026-10-06). Supersedes the glass surface in ADR 0037. ADR 0040 adjusts its surrounding action row without changing the surface.

The user rejected the earlier CTA on a physical iPhone: it looked like a purple filled button rather than glass. The previous supported-state background was 70% opaque purple, with 88% on hover and 90% pressed, over an already darkened photo. The 14px blur also removed the remaining photographic detail. This is the concrete cause in the CSS; the exact rejected iPhone's computed styles were not remotely inspected.

The revised surface uses 6% white background alpha, 2px blur, restrained saturation/brightness and an asymmetric specular rim. Upper-left and lower-right reflected highlights, inset edge shadows and rounded corners suggest the thickness of a lens while the center retains visible background texture. Hover and pressed feedback keep that transparency. It uses background alpha, not element opacity; decorations ignore pointer events. Focus outline, 48px target, native link semantics, disabled behavior, touch hover restrictions and reduced motion remain. The unsupported-browser opaque fallback remains readable. Copy icons, fonts, photo delivery, routing and runtime contracts are unchanged. There is no new client script, animation loop, library, SVG filter or WebGL.

## Compatibility and optical limits

[WebKit's backdrop-filter introduction](https://webkit.org/blog/3632/introducing-backdrop-filters/) explains compositing and the extra rendering passes. [Safari 18](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/) added unprefixed syntax; this is separate from SVG reference-filter support. Both prefixed and standard plain CSS functions are retained in the emitted stylesheet.

The [CSSWG Filter Effects Level 2 draft](https://drafts.csswg.org/filter-effects-2/#BackdropRoot) describes how ancestor opacity, filter, masking, clipping and blend effects can bound backdrop sampling. The actual CTA ancestor chain was inspected in WebKit and Edge: opacity is 1, filter/mask/clip-path are none, blend mode is normal, and no ancestor backdrop-filter is present. The photo's own filter is on a sibling image, not a CTA ancestor. The hero's stacking isolation/z-index was not treated as proof of a broken backdrop root.

[WebKit bug 317059](https://bugs.webkit.org/show_bug.cgi?id=317059) reports that URL references can cause a backdrop filter chain to be dropped. The author's [CSS/SVG refraction experiment](https://kube.io/blog/liquid-glass-css-svg/) explicitly describes its browser demo as Chrome-only. It was reviewed as an experiment, not adopted as a Safari-compatible library or copied implementation.

A private striped-background test used a constant-vector `feDisplacementMap` probe, independently of the adopted button. Identical-region screenshot pixels changed in Edge (mean absolute RGB difference about 162/255) and did not change in WebKit (0). This is a rendered probe, not a `CSS.supports` inference. SVG URL filters were therefore rejected for the iPhone-facing implementation. Random turbulence and heavy WebGL were also not adopted.

**The chosen CSS produces transparency and reflected/beveled highlights. It does not spatially refract arbitrary background pixels, and is not Apple's native Liquid Glass.** The native-style request is only partially approximated by interoperable CSS. Do not describe the WebKit result as genuine refraction. A stronger browser-specific enhancement remains a separate decision if the user requests it after viewing the candidate.

## Verification

Playwright 1.63.0 and its official WebKit build were installed only into the task's temporary tools directory. No repository dependency or external account was added. WebKit 26.6 on Windows and Edge were checked at 1487/820/390/320px against exact CSP: low-alpha background, live backdrop filter, ancestor chain, photograph rendering, target size, no horizontal overflow, keyboard activation and repeated back/forward navigation. Existing Edge checks also cover hover, focus, opaque fallback, disabled and reduced motion. Browser screenshots show the dark photo area used by the CTA. With glyphs temporarily hidden, screenshots of the actual text backing were sampled against white text: all tested widths exceeded 4.5:1 (390px WebKit approximately 4.94:1). This is specific to the existing darkened hero, not a guarantee over arbitrary light backgrounds.

The same private-home benchmark returned LCP medians of 1.668s before and 1.664s after, with CLS 0. CSS gzip increased by 141 bytes; image/font/JS bytes did not change. This negligible timing difference is within local lab variability, not evidence of an additional speed gain. Existing actual HTTP fallback/secure clipboard checks were rerun successfully.

This WebKit run is not a physical iPhone or the user's exact Safari version. The user subsequently accepted the button design on 2026-10-06 and requested better harmony with its surroundings. The user's earlier speed approval is retained; transfer budgets and the same local mobile benchmark are rechecked without changing image/font outputs or zero-JS static-page behavior. Exact head/CI and final measurements are recorded in PR 65 and `docs/performance/glass-review-v1.json`.
