# ADR 0036: Static syntax highlighting and progressive code copy

Status: Accepted (2026-10-05, requested during PR 65 review)

Fenced code uses build-time Shiki with the existing GitHub Dark theme. A transformer emits static token classes rather than style attributes, preserving the strict CSP. Inline code retains its existing treatment. The editor panel has a language label, a keyboard-focusable horizontal scroll region, and a native copy button with a polite live result.

Only pages containing rendered fenced code load `/scripts/code-copy.js`. This small same-origin script adds no framework or dependency. Secure contexts use Clipboard API; rejected or unavailable access falls back to a synchronous selected-text copy operation. Success is shown only after the API resolves or the fallback explicitly returns true. Failure leaves the code selectable and explains manual copy. No clipboard reading, permission request, inline handler, unsafe-inline or unsafe-eval is introduced in the application.

The content-runtime gate admits exactly this one external script alongside an actual static code block, with no inline executable script or Astro island. Other content routes remain static. Search and registered Tool runtime gates retain their existing boundaries. This is the code-copy progressive enhancement allowed by the frontend policy, not a change to publication, routes, migration or deployment authority.

Review refinement: the 44px native button shows overlapping-paper copy artwork, changes to a check for two seconds after success, then restores the copy icon. Repeated successful copies restart that timer; pending copies are guarded. Hover and keyboard focus show a tooltip. The polite live status is visually hidden, so success adds no panel below the code. Failure retains a warning icon and a short visible manual-copy instruction until retry. Accessible action names remain stable.

User acceptance (2026-10-05): the copy-icon → transient-check interaction was explicitly adopted after review. Subsequent navigation and performance work preserves this interaction.
