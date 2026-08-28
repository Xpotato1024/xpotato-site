---
status: proposed
date: 2026-08-29
owner: architecture
---

# ADR-0029: Legacy inventory preserves unresolved external and non-static evidence

## Status boundary

This ADR is a **post-Freeze proposal**。It does not amend the accepted Frozen Design until a fresh clean-room design audit passes and the operator explicitly accepts it。It documents design semantics only; this pass does not change the existing migration schemas or inventory implementation。

## Context

The immutable legacy Git snapshot contains references whose source bytes cannot always be proven from Git evidence alone:

- non-Git locators such as `r2:/blog/...`;
- referenced paths such as `/wp-content/uploads/...` whose corresponding Git object may be missing;
- raw imported HTML expressions that are not a static string literal or substitution-free template literal。

Requiring a file SHA and size for every such record would force the inventory to fabricate facts, access an external provider without authorization, silently drop evidence, or execute arbitrary MDX/JavaScript。Each outcome violates the purpose of a snapshot-bound inventory。

The current Phase 1A machine schema already distinguishes verified and unresolved evidence, but that shape was not defined in the accepted frozen prose contract。

## Decision

Propose amending the Migration Inventory Contract so the inventory preserves evidence it cannot fully verify instead of presenting it as migrated or inventing artifact identity。

The proposed normative amendment is `../../contracts/migration-inventory-contract.md`。

## Legacy locator

A `LegacyLocator` is an exact, non-empty legacy locator string with NUL prohibited。It can represent repository paths and unchanged legacy forms such as:

```text
/wp-content/uploads/2025/09/img_7.jpg
r2:/blog/my-first-post/GDCH3152.JPG
```

The inventory must not reinterpret `r2:/...` as a provider URL or enrich it with account IDs, bucket IDs, credentials, signed URLs, or guessed provider state。

## Media evidence states

`LegacyMediaRecord` becomes a discriminated union:

- `git_verified`: source bytes are present in the frozen Git snapshot and therefore have exact SHA-256, size, format, references, and origin evidence;
- `unresolved_non_local`: the exact locator and referencing content IDs are preserved, together with `non_git_locator` or `missing_git_object` as the reason。

An unresolved record must not contain a fabricated file SHA, size, or claimed provider verification。It is inventory evidence, not a migrated-media state。

`non_git_locator` and `missing_git_object` remain distinct so later work can distinguish a deliberately external locator from a repository-relative reference whose object is absent。

## LegacyHtml evidence states

`LegacyHtmlRecord` becomes a discriminated union:

- `static`: safe static extraction proves raw HTML bytes, so an exact `rawHtmlSha256` can be recorded;
- `blocked`: raw HTML use is detected, but a bounded static extractor cannot prove the bytes。It records an explicit blocker and has `disposition: "manual_review"`。

A blocked record must not contain a fabricated `rawHtmlSha256`。Inventory generation must not evaluate arbitrary MDX or JavaScript, execute imported modules, or use dynamic evaluation to recover HTML。

## Integrity versus readiness

Inventory integrity may pass when non-local/missing media is explicitly preserved as unresolved and non-static raw HTML is explicitly preserved as blocked, provided no evidence is silently lost and all cross-record invariants hold。

That does not make those records migrated, resolved, or cutover-ready。Migration/cutover remains blocked until each unresolved record receives an accepted mapping, verification, retirement, or other allowed disposition and all later content, storage, route, provider, recovery, and parity requirements pass。

## Alternatives

### Require SHA/size for every media locator

This would fabricate identity for unavailable bytes or force unauthorized provider access, so it is rejected。

### Drop unresolved locators or raw HTML uses

This produces a falsely complete inventory and risks silent content/media loss, so it is rejected。

### Execute legacy MDX/JavaScript to recover HTML

This executes arbitrary historical code during inventory and exceeds the safe static-evidence boundary, so it is rejected。

### Treat unresolved evidence as inventory failure

This conflates faithful observation with later migration readiness。Explicit unresolved evidence can be internally valid while still blocking cutover, so the concepts remain separate。

## Consequences

- real legacy locators survive byte-for-byte;
- unavailable bytes are never assigned fabricated hashes or sizes;
- provider access is not required merely to inventory Git evidence;
- blocked raw HTML remains visible for manual review;
- inventory integrity can be evaluated independently of future migration completion;
- unresolved records remain explicit migration/cutover blockers。

## Related

- `../../contracts/migration-inventory-contract.md`
- `../../migration/legacy-freeze-2026-08-28.md`
- `../../architecture/design-status.md`
- `0025-clean-room-phase-gate-and-design-lifecycle.md`
