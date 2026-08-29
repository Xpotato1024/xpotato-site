---
status: canonical
owner: migration
accepted_at: 2026-08-30
canonical_for:
  - Phase 4 content identity/content migration acceptance
  - Phase 5 taxonomy handoff
---

# Phase 4 Content Migration Acceptance — 2026-08-30

## Decision

Phase 4 of the vNext migration plan is accepted as complete.

This acceptance closes only content identity/content materialization. It does **not** authorize taxonomy publication, media publication, route/redirect activation, legacy cutover, old implementation deletion, production deployment, Cloudflare/R2/DNS provider mutation, or production external-AI activation.

## Accepted implementation/audit target

```text
feature revision: 1b4bb92bd6e285a7ce1c72ef704b1467ed57a06b
fresh Phase 4 re-audit: PASS — P0=0 / P1=0 / P2=1
PR: #45
main merge commit: a1275db87fe3d802373d3fcf9927153322485683
post-merge vNext CI: PASS
post-merge Phase 4 content readiness: PASS
```

The audit's single P2 was non-blocking lifecycle wording drift in `docs/README.md`. This lifecycle-close pass synchronizes that wording with `architecture/design-status.md`; it does not alter the audited Phase 4 implementation semantics or retroactively change the recorded audit verdict.

## Content identity/materialization evidence

Phase 4 accepted evidence includes:

- 53 frozen legacy identities bound to stable UUIDv4 `ContentId` values;
- exact ContentId allocation map and candidate baseline bound to the frozen legacy snapshot;
- 53 reproducible materialization records and active vNext content targets;
- source/target file, body, and frontmatter SHA lineage;
- 48 portable source-preserved bodies;
- 2 reviewed current-state editorial replacements with explicit review IDs;
- 2 statically verified `LegacyHtml` conversions;
- 1 PrimeFactorizer Interactive Module Registry conversion;
- normal CI drift checking from frozen source + candidate evidence;
- no silent historical provenance fabrication.

The accepted frozen legacy identity remains:

```text
tag: legacy-pre-vnext-2026-08-28
tag object: 8503f5a50a5fb3d27a02422da0b50dc66c818b02
peeled commit: 927d105713561309fc5e2374396f86646b5aeb2a
inventory payload SHA-256: 9151be197d9e48a12297d45dfdd2a72a15cf9ce16f143fdc16b60e5345d37493
```

## Publication staging retained

Phase 4 does not publish legacy Blog content prematurely.

- all 44 historically published Blog entries retain `sourceDraft=false` evidence;
- they are staged as `targetDraft=true` until Phase 6 media requirements are satisfied;
- each affected Blog retains `blog_media_registry` publication hold;
- no hero/social-card media binding is fabricated;
- no R2 object was read/written to close Phase 4.

## Deferred handoffs

### Phase 5 — Taxonomy

52 entities retain raw taxonomy evidence requiring reviewed mapping. Initial seeds remain:

```text
Blog category: software=31 / infrastructure=12 / robotics=1
Notes subject: infrastructure
Tool category: calculation
```

Raw tags/technologies still require explicit active/alias/merge/retire/archive decisions. Unknown terms must not be silently accepted or created.

### Phase 6 — Media/publication

11 entities retain explicit legacy media locators. Blog publication remains blocked until required Media Registry/provenance/recovery gates pass.

### Later phases

Route/SEO/discovery parity, provider acceptance, cutover, rollback, and legacy deletion remain independent blockers.

## Cloudflare build-authority closure

Before the Phase 4 merge, the legacy Cloudflare Workers Builds Git integration was disconnected by the operator. A fresh commit after disconnect produced repository-controlled GitHub Actions checks only and no `Workers Builds: xpotato-site` check. The audited Phase 4 head and the post-merge main revision therefore did not use Cloudflare Workers Builds as a second deployment authority.

The repository production deploy workflow remains hard-blocked until its later lifecycle gates open.

## Next implementation phase

The next repository implementation work is **Phase 5 — Taxonomy migration**.

Phase 5 may review and materialize taxonomy registry mappings for the retained raw terms, but must not activate media/provider/cutover behavior or remove the frozen legacy implementation.
