---
status: implementation-evidence
owner: content
last_verified: 2026-08-29
canonical_for:
  - Phase 4 legacy content materialization evidence
  - Phase 5 taxonomy handoff
  - Phase 6 media and publication handoff
---

# Phase 4 Content Materialization Evidence

## Result

The exact frozen legacy content set has been materialized into the vNext content workspace on the Phase 4 feature branch.

This record is implementation evidence. It does not authorize production publication, legacy cutover, old implementation deletion, provider mutation, or deployment.

## Exact source identity

- materialization implementation revision: `f031c85cffa82f3207c996cc12a2d2afe7d4a5b3`
- repository: `Xpotato1024/xpotato-site`
- annotated tag: `legacy-pre-vnext-2026-08-28`
- tag object: `8503f5a50a5fb3d27a02422da0b50dc66c818b02`
- peeled commit: `927d105713561309fc5e2374396f86646b5aeb2a`
- inventory payload SHA-256: `9151be197d9e48a12297d45dfdd2a72a15cf9ce16f143fdc16b60e5345d37493`
- ContentId mapping payload SHA-256: `f1f1bb4d49ffb838720cfbe417fcec34988dba1aec7c72c30daa4cd2fc30b3a9`
- candidate manifest payload SHA-256: `fc1cd9079b304c1c660de9ecf40c0201285de078cf5fe652b6df335dbbcf3745`
- materialization manifest payload SHA-256: `72ba1b79b550bb8e15ed68dfaa81d2ae8e730784497a96d419b32417a9f39fcb`

## Entity coverage

| Collection | Materialized |
|---|---:|
| Blog | 44 |
| Notes | 1 |
| Projects | 6 |
| Tools | 1 |
| Pages | 1 |
| **Total** | **53** |

Every materialized file is bound to:

- one frozen `LegacyContentId`;
- one stable UUID `ContentId`;
- the exact legacy file/body hashes;
- the exact target file/body/frontmatter hashes;
- the exact target repository path;
- one recorded body-conversion disposition.

Normal CI regenerates the expected files and manifest from the frozen tag and fails on drift.

## Body conversion

| Conversion | Count | Handling |
|---|---:|---|
| Portable source preserved | 48 | runtime imports/presentation-owned fields removed; portable MDX revalidated |
| Reviewed current-state editorial update | 2 | exact review IDs bind replacements for About and Xpotato Site; source hashes remain preserved |
| Static `LegacyHtml` to Markdown | 2 | static literal only; raw HTML SHA verified; no evaluation |
| Interactive Registry conversion | 1 | legacy PrimeFactorizer component path replaced by `Demo module="prime-factorizer"` |

The converter fails closed for unsupported raw HTML, non-static `LegacyHtml`, unknown interactive components, residual provider/media locators, arbitrary MDX runtime escape paths, and empty conversion output.

Media references removed from portable bodies are not discarded. Exact legacy locators remain in `content-materialization-v1.json` for Phase 6.

## Reviewed current-state corrections

Two pages whose legacy wording described an already superseded implementation plan receive explicit, version-controlled editorial replacements:

- `pages:about` -> `phase4-about-current-state-v1`
- `projects:xpotato-site` -> `phase4-xpotato-site-current-state-v1`

The replacements correct the workspace path, current static-first architecture, migration-phase status, target Cloudflare Static Assets boundary, and retained cutover/provider blocks. They do not alter ContentId, title, description, historical source hashes, or deferred taxonomy/media evidence.

All six Project frontmatter records were reviewed against the frozen source. Public repository links, legacy status, featured ordering, and source-availability semantics are retained. Raw technologies/tags remain Phase 5 evidence rather than being silently accepted into the target taxonomy.

## Publication staging

The frozen inventory contains 44 published Blog entries. A published vNext Blog requires exactly one active `hero` and one active `social_card` Media Registry record.

Phase 6 has not produced those records yet. The Phase 4 target therefore does not weaken the publication invariant and does not fabricate media bindings:

- `sourceDraft=false` is retained in the materialization manifest;
- each affected Blog is materialized as `targetDraft=true`;
- each receives the exact publication hold `blog_media_registry`;
- Blog publication remains blocked until the required Media Registry and related provenance/review gates pass.

The other 9 entities retain their source draft state.

This staging distinction is evidence-preserving. It is not a retirement decision and does not change the historical published state of the legacy site.

## Deferred work

### Phase 5 — Taxonomy

- 52 entities retain raw taxonomy evidence for reviewed mapping.
- Blog seed categories are instantiated as required: `software=31`, `infrastructure=12`, `robotics=1`.
- Notes seed subject is `infrastructure`.
- Tool seed category is `calculation`.
- Target tags/stacks remain empty until aliases/merges/retirements are reviewed; unknown terms are not silently accepted.

### Phase 6 — Media and publication

- 11 entities retain one or more explicit legacy media locators.
- All 44 Blog publication holds require active hero/social-card registry coverage before release.
- No R2 object was read, written, copied, renamed, or deleted in Phase 4.
- No source/media hash or provenance claim was fabricated.

### Later phases

Route classification/redirect activation, SEO/RSS/search parity, provider control-plane acceptance, cutover, and legacy deletion remain separately blocked.

## Safety boundaries retained

- frozen legacy tag/source: unchanged
- legacy active implementation: not deleted
- Cloudflare/R2/DNS: no mutation
- production deployment: not activated
- external-AI provider: not activated
- merge to `main`: requires fresh Phase 4 audit and normal operator authorization
