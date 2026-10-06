# ADR 0040: Hero action row harmony

Status: Implemented review candidate (2026-10-06); the underlying glass texture is accepted.

The user accepted the transparent/reflected button and requested harmony with surrounding content. The accepted 6% white surface, 2px backdrop treatment, reflected rim, border, shadow, radius, primary label weight, focus/pressed/disabled behavior and copy icons remain unchanged. There is still one glass CTA; About remains a text link.

Only the full-bleed hero's action row changes:

- About uses the existing Zen 500 face and the hero's warm white, with a small text shadow over the dark photograph. The primary CTA retains weight 600 and its white label.
- Both links use a 48px target, 24px line height and 12px label-to-arrow gap, explicitly centered. The row's column gap changes from 28px to 24px. This gives the text link comparable typographic presence without copying the glass container.
- The description-to-action margin changes from 28px to 32px on desktop and from 16px to 24px on mobile. This separates prose from actions while retaining the centered hero composition and existing heading/body spacing, typography and photo crop.

At compact widths up to 360px, the original 16px top margin, 28px column gap and 16px arrow gap remain. The first candidate moved the label onto a lighter photo detail at 320px WebKit and reduced sampled contrast to 4.40:1; it was rejected. Keeping the compact placement preserves readable backing without altering the accepted glass surface. About's weight/alignment improvement still applies.

The change is scoped CSS with no new assets, script, package or route. The normal photo/publication boundary, strict CSP, static-first architecture and content holds remain unchanged.

## Verification and review

Before images and geometry were captured from commit `9bcf32f82b4c723d56a663bce51daf3e75eddb8d`, then retained independently of the after images. WebKit 26.6 on Windows and Edge cover 1487/820/390/320px, identical glass computed surface values, action heights/centers/gaps, sampled dark-photo text contrast, keyboard activation and repeated back/forward navigation under exact CSP. This is browser-engine QA, not a replacement for physical iPhone appearance review.

The existing glass hover/focus/pressed/disabled/non-support/reduced-motion checks and actual clipboard checks are retained. The same three-run mobile home lab and repository asset budgets guard transfer and layout-shift regressions. Results and conditions are recorded in `docs/performance/hero-harmony-v1.json`; exact reviewed head and CI are in Draft PR 65. Before/after screenshots are available privately and contain no held article bodies. No merge or deployment is performed.
