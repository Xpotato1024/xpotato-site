---
status: accepted
owner: migration
last_verified: 2026-09-04
canonical_for:
  - Phase 6 vibration-robot hero semantic correction proposal
---

# Phase 6 Old R2 Hero Semantic Correction Proposal — 2026-09-04

## Context

At proposal creation, the operator-accepted Phase 6 review payload was:

```text
f257ad5f2de8bc89afbb245c94bca60c820b7df725e81d372e634517727bba70
```

That accepted review planned the frozen locator below as the `blog:vibration-robot` hero and as an inline-used photo:

```text
r2:/blog/my-first-post/GDCH3152.JPG
```

At review time the object was non-local and its actual bytes were not available for visual inspection. The source was subsequently recovered read-only and reviewed under `phase6-r2-source-recovery-evidence-2026-09-04.md`.

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

Visual review shows a ginger-and-white cat sitting on an exterior shutter/window structure. No vibration-robot subject matter is visible.

The frozen article itself labels this use `R2 image connectivity test`, which is consistent with a temporary connectivity-test image rather than an editorial hero.

## Accepted correction

For **only** `r2:/blog/my-first-post/GDCH3152.JPG`:

```text
before:
  disposition: recover_nonlocal_source
  mediaKindCandidate: photo
  asset: blog:vibration-robot / hero
  sourceAction: recover_nonlocal_source
  Blog hero origin: legacy_media

after:
  disposition: replace_with_deterministic_cover
  mediaKindCandidate: deterministic_cover
  rightsBasisCandidate: self_created
  asset: blog:vibration-robot / hero
  sourceAction: generate_deterministic
  ingestProfileId: diagram-svg-v1
  Blog hero origin: deterministic_cover
```

The recovered cat JPEG is retained only as historical recovery evidence and is **not** included in the vNext canonical source, public delivery, protected-copy, or Media Registry publication set.

The existing three content-relevant `vibration-robot` body photos (`img_7.jpg`, `img_8.png`, `img_9.png`) remain unchanged and continue to migrate as inline photos.

After this correction the Blog publication plan is:

```text
historically published Blogs: 44
deterministic hero covers: 44
legacy-media hero covers: 0
deterministic social cards: 44
```

## Rationale

A migration should preserve content identity and relevant evidence, not blindly preserve an accidental storage/connectivity-test visual. Keeping an unrelated cat image as the durable hero would pass source recovery while failing semantic/visual quality review.

Replacing it with the same deterministic hero system used for the other migrated Blogs:

- removes the last nonlocal source dependency;
- prevents an irrelevant test asset from becoming permanent publication metadata;
- retains the exact recovered object SHA and artifact as historical migration evidence;
- does not fabricate historical robot imagery;
- requires no external AI and no provider write.

## Realized machine effects

The operator accepted this correction at `2026-09-04T03:45:00+09:00`, as recorded in `phase6-media-review-acceptance-2026-09-04.md`. The semantic correction remains bound to the same accepted review and candidate payloads; a later security remediation changed only the image-processing toolchain and its derived processing evidence:

```text
accepted review payload:
  49fe35022d3a573c2575b81add0195921673b17e8ba2da1c8f4707668b8ee3e8
repository candidate payload:
  2ab2aecf16e5d0e6bb5b1a3dddf602a4a2f9a6a65ec55208d6f442cd1ec24874
local processing payload:
  28122e3aad998652e531493637d69848faee253a0271634011d2279d25b74a35
media toolchain payload:
  f48c772c2f41b83733f6fcc8fd258986e66cb399e956a11a1d1500b089188de4
Sharp runtime:
  0.35.4
deterministic sources: 89
nonlocal recovery provenance: 0
local processing: 101 processed / 0 deferred
```

The processing bytes regenerated with the patched Sharp runtime were emitted as Actions artifact `9908474842` with ZIP SHA-256 `acd977405260eaa97e6a640941b421553053bd98ca6430a65bedc34d78572fff`.

The security-remediation gate also asserted that `npm audit` no longer reports a `sharp` vulnerability. Five unrelated repository-baseline findings remained (`1 moderate`, `4 high`), matching the pre-Phase-6 main-branch baseline count; they are not introduced by this Phase 6 direct Sharp dependency.

## Safety boundary

This accepted correction does **not** authorize:

- R2 canonical-source persistence;
- R2 public delivery writes;
- protected-copy writes;
- Cloudflare/DNS/Worker/provider mutation;
- production deployment or cutover;
- deletion of the old R2 object;
- legacy source deletion.

The correction is repository-side only and remains governed by the exact-hash-bound authority in `phase6-media-review-acceptance-2026-09-04.md`. Any persistent external mutation still requires separate explicit authorization and its own readiness gate.
