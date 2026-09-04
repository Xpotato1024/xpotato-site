---
status: proposed
owner: migration
last_verified: 2026-09-04
canonical_for:
  - Phase 6 Project overview visual-profile correction proposal
---

# Phase 6 Project Overview Profile Correction Proposal — 2026-09-04

## Context

The operator-accepted Phase 6 media review payload is:

```text
a01171ac3c95230259a3173d2fccb823e71ac8e80c9a228c070673478bf81a39
```

That payload correctly classifies three Project overview raster assets as `mediaKindCandidate = screenshot`, but their `variantProfileId` was written as `project-overview-v1`。That profile ID does not exist in the frozen v1 profile registry。

Frozen implementation authority `packages/media-ingest/src/profiles.ts` defines:

```text
photo-overview-v1  -> photographic/raster Project overview
screenshot-ui-v1  -> UI/text-heavy screenshot
```

Therefore the profile cannot be corrected by name substitution alone; the exact frozen bytes were visually reviewed first。

## Exact visual evidence

Read-only GitHub Actions run:

```text
run: 33786193746
artifact: phase6-project-overview-review
artifact id: 9905501781
artifact digest: sha256:c9d6233bc3f20545c1f49f5a6d7eb9cd752a1e670a2ff536110315352a8b5f8a
source commit: 927d105713561309fc5e2374396f86646b5aeb2a
```

The three exact source objects are:

| Legacy locator | Frozen source SHA-256 | Visual classification |
|---|---|---|
| `/images/projects/meidaisai-overview.png` | `a8ac62ef3267d64032dd96ae2946e9ad3bf374bf911c32f0c8fafae56207532e` | UI/text-heavy application screenshot |
| `/images/projects/syu-katsu-management-overview.png` | `970bf70f5b07ae780cc3b2d81709d87bab732e712f8545caca8a041b0acd5e9a` | UI/text-heavy application screenshot |
| `/images/projects/xpotato-site-overview.png` | `4a6b1bbeec5655266a36b8b1fc986b2be59ff63f789d4b30907d790e2b2df6a4` | UI/text-heavy website screenshot |

All three therefore map to the frozen `screenshot-ui-v1` delivery profile。

## Exact proposed correction

For only these three review decisions:

```text
variantProfileId:
  project-overview-v1
  -> screenshot-ui-v1
```

No other review field changes。

In particular, these accepted semantics remain unchanged:

- `disposition = migrate_existing`
- `mediaKindCandidate = screenshot`
- `rightsBasisCandidate = self_created`
- `role = overview`
- `sourceAction = ingest_git_object`
- `ingestProfileId = canonical-raster-srgb8-lossless-webp-v1`
- publication/provider mutation remains blocked
- ConoHa screenshot remains replaced by the deterministic explanatory diagram under the separately accepted 案B amendment

## Gate

Because `phase6-media-review-acceptance-2026-09-04.md` binds acceptance to the exact review payload, this correction is **not applied to the accepted review artifact until the operator explicitly accepts this proposal**。

After acceptance:

1. update the review generator for these three assets to `screenshot-ui-v1`;
2. regenerate `media-review-proposal-v1.json` and record its new exact payload SHA;
3. extend the Phase 6 acceptance record to bind the corrected payload and this correction proposal;
4. regenerate the repository media candidate;
5. add fail-closed validation so unknown/non-frozen profile IDs cannot pass again;
6. rerun `vNext CI` and `Phase 6 media readiness` on the new exact SHA。

This proposal authorizes no persistent R2/Cloudflare/provider write。
