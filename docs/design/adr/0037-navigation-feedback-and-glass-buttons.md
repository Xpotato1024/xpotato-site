# ADR 0037: Navigation feedback and glass button variant

Status: Accepted (2026-10-05, requested during PR 65 review)

The glass surface below was subsequently rejected after physical iPhone review. ADR 0039 replaces its tint/blur/rim treatment and records the limits of Safari refraction. Navigation behavior remains adopted.

Header navigation retains Zen Kaku Gothic New at weight 600. A stationary purple underline marks the current section, keyboard focus and fine-pointer hover, without changing layout. Keyboard focus also retains an outline. Hover rules are limited to devices with a fine pointer and hover support, avoiding a persistent touch hover treatment.

The reusable `.button-glass` class supports native links and buttons. The homepage's “制作物を見る” CTA is the single example, over the existing review-only workshop photo. About remains a plain text link. The variant uses a dark translucent purple tint, background blur, a fine light border and inset highlight; opaque purple is the fallback when backdrop filtering is unavailable. Text stays white with sufficient dark backing. Pressed, keyboard focus and disabled states are explicit, and reduced motion disables transitions.

For navigation use a native anchor with a valid href. For actions use a native button; its native disabled attribute prevents activation. An unavailable link must omit href and use aria-disabled=true with tabindex=-1. The CSS does not replace those semantics. No new dependency, client script, shader, provider permission, publication or deployment change is required.
