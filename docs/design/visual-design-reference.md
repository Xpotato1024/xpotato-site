# Visual design reference

Verified: 2026-10-06. Implementation snapshot: `b50239df1df88f73189761ddf4e604550a67ee5f`, Draft PR 65. This is a human-readable reference, not a second token store or an architecture/lifecycle acceptance manifest. Exact executable values remain in [global.css](../../apps/site/src/styles/global.css), [fonts.css](../../apps/site/src/styles/fonts.css), component markup and [site-config.ts](../../apps/site/src/lib/site-config.ts). Update this reference when those sources change; do not generate runtime settings from this table.

## Status and document responsibilities

| Layer | Status / authority |
| --- | --- |
| Editorial identity, XP logo, typography, two-line slogan | Accepted visual direction: [ADR 0034](adr/0034-editorial-identity-and-photo-led-home.md). Acceptance does not imply production deployment. |
| Transparent glass material | Accepted after physical phone review: [ADR 0039](adr/0039-transparent-glass-after-phone-review.md); supersedes the tinted glass portion of ADR 0037. |
| Current surrounding hero action styling | Implemented review candidate: [ADR 0040](adr/0040-hero-action-row-harmony.md). Committed order is About text left, Projects glass right. |
| Private A/B comparison, revision `cta-ab-v5` | Not adopted, not in source/public output. Projects left in both; A has About text, B has weaker secondary glass. Both compare **1rem radius**, not the committed 1.1rem. |
| Architecture, publication and deployment lifecycle | [Design status](../architecture/design-status.md), its referenced acceptance manifests, and existing contracts remain authoritative and unchanged. |

This document collects the present visual vocabulary. ADRs record why decisions changed and their review status. [Design-system policy](../architecture/design-system-policy.md) owns token architecture; [performance/accessibility policy](../architecture/performance-accessibility-policy.md) owns targets. Neither frozen policy is rewritten here.

## Brand and composition

Use **Xpotato**, the geometric XP SVG and the **Xpotato.net** wordmark with a smaller `.net`. The logo source is [xpotato-logo.svg](../../apps/site/public/xpotato-logo.svg); preserve its geometry instead of drawing another interpretation. Brand wordmark uses system sans-serif, 1.55rem/1.2, weight 650, tracking -.04em; mobile is 1.1rem. SVG width is 48px desktop / 35px mobile.

The slogan has two equally weighted Noto Serif lines, **Think. Build.** then **Run.** The English display and Japanese headings provide character; readable sans-serif prose, restrained purple, rules and whitespace carry the rest. Real project summaries and published records lead. Articles retains `/blog/`; Education, Projects, Tools, About and Search are primary navigation, Notes auxiliary. Do not invent achievements, fill empty publication lists with held articles, add ambient animation, generic SaaS gradients, repetitive marketing card grids, or photo lookalikes. The reflected rim gradient is a local material effect, not a page branding motif.

## Colors

| Semantic CSS token | Value | Use |
| --- | --- | --- |
| `--surface` | `#faf9f7` | Warm light page/header background |
| `--text-primary` | `#15141d` | Main text |
| `--text-muted` | `#625e6e` | Descriptions and metadata |
| `--border` | `#d8d4dc` | Dividers and standard control borders |
| `--accent` | `#745399` | Links, current navigation, solid Tool action |
| `--focus` | `#5b4177` | General keyboard outline / glass outer ring |

These are the implemented global semantic colors; there is no global danger/success token yet. Local states remain local: copy success `#85e89d`, failure `#ffab70`; code surface `#0d1117`, toolbar `#161b22`, label `#b1bac4`, copy control `#21262d` / hover `#30363d`, foreground `#f0f6fc`. Shiki uses the scoped GitHub-dark syntax palette. Hero warm white is `#faf9f7`, primary glass text `#fff`, kicker `#f1eaf8`, photo-less full-bleed fallback `#26262a`. A disabled glass control uses surface `#46414e`, text `#d1cdd5`, border `#827b8b`; disabled carousel controls use opacity .3. Do not treat those contextual values as new global palette tokens.

## Corners and controls

Pixel equivalents below assume a 16px browser root; rem values follow user settings. There is no global radius token. Structural sections/list rows are square and separated by rules rather than rounded card shells.

| Context | Actual selector / implementation | Radius / target |
| --- | --- | --- |
| Solid | `.prose form button`: Tool submit, purple fill / white text | 2px; minimum height 44px. **Context style**, no reusable `.button-solid` class. |
| Ghost-like | `.project-controls button`: transparent, purple arrows | 2px; 44 x 44px. **Context style**, no reusable `.button-ghost` class. |
| Text action | Native About anchor in `.intro-links` | No container radius; 48px height in photo hero, weight 500, warm white and text shadow. |
| Glass | `.button-glass`, native anchor or button | **1.1rem (17.6px)**, minimum height 48px, padding .65rem 1.2rem; weight 600, 1rem/1.5. |
| Copy icon | `.code-copy-button` | .25rem (4px), 44 x 44px; copy icon becomes check for 2 seconds. |
| Code wrapper / tooltip / inline code | `.code-block` / copy tooltip / `.prose code` | .4rem (6.4px) / .25rem (4px) / 2px |
| Ordinary inputs/buttons | Global `input, button` | 2px; .6rem .85rem padding. Tool input minimum height 44px. |
| Navigation underline | Pseudo-element | 1px radius, 2px thickness; hover/current/focus without shifting text. |
| A/B private comparison only | Same glass geometry with altered radius | **1rem (16px)**, including inherited rim. Not a new committed default. |

The glass supports both prefixed and standard backdrop filters: 6% white (`#ffffff0f`), border `#ffffff55`, blur 2px, saturation 125%, brightness 112%, reflected pseudo-element rim, inset highlights and external shadow. Unsupported browsers get opaque `#3c2c52`. It approximates translucent reflected material; it does not perform spatial refraction or reproduce native Liquid Glass.

Fine-pointer hover brightens the border/shadows, pressed uses `#ffffff08` in supported browsers, focus has a 3px white outline at 4px offset plus the purple outer ring. Disabled removes reflections/shadow. Use actual disabled buttons; an unavailable anchor has no href, `aria-disabled="true"` and tabindex -1. Never use glass appearance as the only cue that an action exists. Copy has a 2px `#d2a8ff` inset focus outline, hidden live success feedback and visible failure feedback. The complete state recipes remain in CSS, not duplicated as another implementation here.

## Typography and layout

No root font-size is forced. `font-synthesis: none`; declared weights are requests, not a promise of a dedicated font file at every weight. The bundled Zen faces cover 400/500; a 600 control request resolves through browser font matching rather than synthesized bold. All fonts are self-hosted WOFF2 with OFL provenance, Unicode ranges and swap. Mono is system `ui-monospace`, Cascadia Code, monospace; JetBrains Mono and Lato are not selected.

| Role | Family / weight | Size and line-height |
| --- | --- | --- |
| Body / prose | Zen Kaku Gothic New, system-ui, Yu Gothic, sans-serif / 400 | 1rem; root 1.8, prose 2 desktop / 1.9 at <=760px |
| Japanese h1 / h2 | Noto Serif JP, Yu Mincho, serif / 400 | General h1 clamp(2.2rem, 5vw, 4.6rem), h2 clamp(1.4rem, 2.3vw, 2rem); 1.3 |
| Article/page title | Same Japanese display / 400 | clamp(2rem, 4vw, 3.3rem), 1.3; description 1.05rem |
| Prose h2 / h3 | Japanese serif 400 / Zen 500 | 1.7rem / 1.4rem, 1.3 |
| Photo hero slogan | Noto Serif, Georgia, serif / 400 | clamp(2rem, 6.45vw, 6rem) desktop; clamp(2rem, 11.8vw, 5rem) <=760px; 1.08, tracking -.045em |
| Normal photo-less home slogan | Same English display / 400 | clamp(4rem, 6.45vw, 6rem), 1.07; <=760px clamp(3.75rem, 16vw, 5rem) |
| Hero description | Zen / 400 | Desktop clamp(1rem, 1.5vw, 1.375rem), mobile 1.05rem; 1.9 |
| Home section / project headings | Japanese serif 400 / Zen 500 | clamp(1.6rem, 2.4vw, 2.25rem) / clamp(1.35rem, 2vw, 1.9rem), project 1.4; mobile project 1.5rem |
| Archive title / description / metadata | Japanese serif / Zen / mono | 1.5rem / .95rem / .75rem; metadata 1.8 |
| Fixed-content list title | Zen / 500 | clamp(1.35rem, 2.3vw, 1.8rem), 1.5 |
| Desktop nav / mobile nav | Zen / declared 600 | 1rem; .85rem at 761-1100px; mobile .8rem |
| Code / language label | System mono | .85rem/1.8 / .8rem/1.5; inline code .88em |

Desktop content width is 82rem, article content 52rem, with gutter `clamp(1.25rem, 6vw, 5.5rem)` added to the container maximum and applied as inline padding. Sticky header minimum height is 88px desktop / 68px mobile; scroll offset is 6.5rem / 5rem. Mobile native details menu replaces desktop nav at 760px, with a two-column menu and separate Search action.

Spacing is currently component-local, not a fabricated universal scale: prose block spacing 1.5rem; h2 margin 3rem/1rem; page heading bottom padding/margin 2.5rem; article rows 1.75rem. Archive metadata column is 9rem with 2rem gap, stacking at <=760px with .5rem gap. Project carousel shows two slides with 3rem gap desktop, one slide with 1.5rem gap mobile; native scrolling, pagination and manual controls, no autoplay.

Photo hero minimum height is clamp(34rem, 51.5vw, 48rem), vertical padding 5rem; mobile minimum 34rem/padding 4rem. Committed action row gap is 1.5rem (24px), margin above 2rem desktop / 1.5rem mobile, arrow gap .75rem. At <=360px preserve 1.75rem row gap, 1rem top margin and 1rem arrow gap. These compact overrides maintain the accepted material's placement over darker photo backing.

## Photo delivery and performance

The original workshop photo and responsive variants remain **private review assets**, absent Git and normal release output. Media registration/publication/recovery approval is still pending. Normal builds do not turn review access into publication. Preserve the existing dark photo-less release fallback and the held-article boundary.

Review uses AVIF/WebP/JPEG variants at 640/960/1440/1920 widths. CSS saturation .2 / contrast .9 preserves workshop detail without competing with text. Desktop cover crop is centered, mobile 58% center. Overlay is dark left-to-right on desktop (`#101014cc`, `#101014b3`, `#10101426`), solid `#101014b3` mobile. Treat photo crop, overlay, label placement and contrast together; a radius or action reorder can put text over brighter details.

Delivery retains known dimensions, responsive sources and no lazy LCP photo; no extra UI library or global script. Four core font requests total 168,168 bytes in the reviewed mobile run; fallback glyph slices remain available. Hashed assets/fonts have immutable caching, HTML/search/copy script revalidation, unchanged CSP. Enforced budgets and recorded conditions are in [performance evidence](../performance/README.md), [budget](../performance/budget-v1.json), [glass review](../performance/glass-review-v1.json) and [hero harmony](../performance/hero-harmony-v1.json). Lab figures are not field Core Web Vitals or a Lighthouse score.

## A/B design engineering assessment (not adoption)

Assumption: **Projects is primary; About is secondary**. Under that assumption, recommend **A** as the next candidate. Its single glass container separates the action hierarchy while Projects shares the heading's left edge. The shared 48px heights, centered labels, 16px row gap and equal radii remove conflicting geometry. About stays legible and operable without a second competing container. This is a design rationale, not a measured conversion improvement or a universal formula for beauty.

B is a defensible alternative when both destinations deserve similar prominence: matching materials convey a common action family; weaker About reflections, border/shadow and weight provide secondary emphasis. The remaining cost is two adjacent button silhouettes competing with the slogan. The smaller About padding at <=360px also adds a special-case rule. Neither equal radii nor a particular ratio proves aesthetic superiority; priority, reading order, text/background contrast and stable interaction geometry are the actionable constraints.

| Comparison evidence | Result / limit |
| --- | --- |
| v5 Edge and WebKit 26.6, desktop and 390/375/320px | No horizontal overflow; action height >=48px and width >=44px; actual mobile taps and destination/back/forward checks. A/B keep the same heading, description, photo and primary glass surface. Radius-only change from v4 preserves layout and rim inherits 16px. |
| Conservative backing sample, primary label | About 6.27:1 desktop, 4.94:1 at 390px, 4.87:1 at 375px; **320px about 4.34:1 in both A/B**. Must resolve and recheck before adoption; do not round to 4.5. |
| Sampling limitation | Maximum background luminance within the label bounding rectangle, not a glyph-by-glyph audit or full WCAG certification. Current committed compact placement has a separate ~4.74:1 result; do not substitute it for the candidates. |
| Private v4 same-condition lab | Edge 390px, DPR1, 4x CPU, 150ms latency, 200,000 B/s download, cache off, gzip, three runs: median LCP home 1676ms / A 1676ms / B 1680ms, CLS 0. Four font requests unchanged; no extra JS. This timing predates the v5 radius-only revision; not a fresh v5 timing measurement. |
| Browser/device boundary | Windows WebKit is engine QA, not physical iPhone Safari. Its default Tab behavior skipped links; programmatic focus/activation checks do not prove physical keyboard traversal. Physical phone acceptance of the underlying glass does not approve A/B order, radius or hierarchy. |

Next adoption criteria: user selects hierarchy/variant, fix narrow-width primary contrast while preserving the accepted material, verify hover/focus/pressed/disabled/fallback/reduced motion, real keyboard traversal, taps and repeated navigation, desktop/mobile crops and transfer budgets. Until then committed home and radius stay unchanged.

## Accessibility review rules

Keep native links/buttons/details, skip link, landmarks, headings, accessible names, visible focus, current-page state, honest form/copy errors, horizontally contained code/table overflow and reduced motion. General focus is 3px purple with 5px offset; glass/copy have contextual high-contrast focus above. Fine-pointer-only hover avoids sticky touch hover. Reduced motion makes scrolling immediate and suppresses transition/animation duration; glass transitions are removed.

The project targets WCAG 2.2 AA. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) requires 4.5:1 for ordinary text (3:1 for qualifying large text), without rounding a failure into a pass. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) specifies 24 CSS px at AA with defined exceptions; this site's 44/48px control convention is a stronger design choice, not the AA minimum. Review focus visibility/occlusion, non-text contrast, zoom/reflow and touch spacing separately; dimensions alone do not certify accessibility.

## Remaining production boundaries

Draft PR review, physical-device checks for any newly selected candidate, workshop media approval/registry binding and the existing 44-article publication holds remain distinct. This reference adopts neither A nor B, changes no public route or publication state, and authorizes no merge/deploy, R2/media write, provider/credential/permission change or unrelated migration cleanup.
