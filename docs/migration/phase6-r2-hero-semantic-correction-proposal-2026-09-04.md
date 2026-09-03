---
status: proposed
owner: migration
last_verified: 2026-09-04
canonical_for:
  - Phase 6 vibration-robot hero semantic correction proposal
---

# Phase 6 Old R2 Hero Semantic Correction Proposal — 2026-09-04

## Context

The current operator-accepted Phase 6 review payload is:

```text
f257ad5f2de8bc89afbb245c94bca60c820b7df725e81d372e634517727bba70
```

That accepted review currently plans the frozen locator below as the `blog:vibration-robot` hero and as an inline-used photo:

```text
r2:/blog/my-first-post/GDCH3152.JPG
```

At review time the object was non-local and its actual bytes were not available for visual inspection。The source has now been recovered read-only and reviewed under `phase6-r2-source-recovery-evidence-2026-09-04.md`。

## Recovery finding

Exact recovered source:

```text
source SHA-256: b64e664b30e8c980bdaa3dfd34a52d6b61dbf1a5c8e202c8de15943dcff84d54
size: 1420500 bytes
format: JPEG
pixels: 3024 x 4032
Actions artifact id: 9907188289
artifact digest: sha256:d289ce99daf895c04073347eb2626f5f7d2f25ac102e0ac3e599d2ed271a1a40
```

Visual review shows a ginger-and-white cat sitting on an exterior shutter/window structure。No vibration-robot subject matter is visible。

The frozen article itself labels this use `R2 image connectivity test`, which is consistent with a temporary connectivity-test image rather than an editorial hero。

## Proposed correction

For **only** `r2:/blog/my-first-post/GDCH3152.JPG`:

```text
current:
  disposition: recover_nonlocal_source
  mediaKindCandidate: photo
  asset: blog:vibration-robot / hero
  sourceAction: recover_nonlocal_source
  Blog hero origin: legacy_media

proposed:
  disposition: replace_with_deterministic_cover
  mediaKindCandidate: deterministic_cover
  rightsBasisCandidate: self_created
  asset: blog:vibration-robot / hero
  sourceAction: generate_deterministic
  ingestProfileId: diagram-svg-v1
  Blog hero origin: deterministic_cover
```

The recovered cat JPEG is retained only as historical recovery evidence and is **not** included in the vNext canonical source, public delivery, protected-copy, or Media Registry publication set。

The existing three content-relevant `vibration-robot` body photos (`img_7.jpg`, `img_8.png`, `img_9.png`) remain unchanged and continue to migrate as inline photos。

After this correction the Blog publication plan becomes:

```text
historically published Blogs: 44
deterministic hero covers: 44
legacy-media hero covers: 0
deterministic social cards: 44
```

## Rationale

A migration should preserve content identity and relevant evidence, not blindly preserve an accidental storage/connectivity-test visual。Keeping an unrelated cat image as the durable hero would pass source recovery while failing semantic/visual quality review。

Replacing it with the same deterministic hero system used for the other migrated Blogs:

- removes the last nonlocal source dependency;
- prevents an irrelevant test asset from becoming permanent publication metadata;
- retains the exact recovered object SHA and artifact as historical migration evidence;
- does not fabricate historical robot imagery;
- requires no external AI and no provider write。

## Expected machine effects after acceptance

If the operator accepts this proposal:

1. extend the Phase 6 review contract with an explicit rationale for a recovered-but-nonsemantic legacy hero replacement;
2. change only the R2 decision and `vibration-robot` Blog hero plan described above;
3. regenerate and bind a new exact review payload SHA;
4. update the Phase 6 review acceptance record with this explicit correction authority;
5. regenerate the repository candidate; expected deterministic source count increases from 88 to 89 and `nonlocal_source_recovery` drops to 0;
6. regenerate local processing; expected coverage becomes `processed=101 / deferred=0`;
7. run full `vNext CI` and `Phase 6 media readiness` on a new exact revision。

## Safety boundary

This proposal does **not** authorize:

- R2 canonical-source persistence;
- R2 public delivery writes;
- protected-copy writes;
- Cloudflare/DNS/Worker/provider mutation;
- production deployment or cutover;
- deletion of the old R2 object;
- legacy source deletion。

Because the current acceptance is exact-review-hash-bound, this semantic correction is not applied until the operator explicitly accepts this proposal。
