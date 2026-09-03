---
status: reviewed
owner: migration
last_verified: 2026-09-04
canonical_for:
  - Phase 6 old R2 hero read-only source recovery evidence
  - GDCH3152.JPG source identity and visual review
---

# Phase 6 Old R2 Hero Recovery Evidence — 2026-09-04

## Scope

This record documents a **read-only** recovery of the frozen legacy locator:

```text
r2:/blog/my-first-post/GDCH3152.JPG
```

No R2 object, Cloudflare resource, DNS state, Worker, bucket setting, or public deployment was created, changed, or deleted by this recovery pass。

The frozen legacy code binds `r2:` delivery to `assetsUrl = https://assets.xpotato.net`, so the exact read-only source URL was derived as:

```text
https://assets.xpotato.net/blog/my-first-post/GDCH3152.JPG
```

## Exact source identity

```text
frozen legacy commit: 927d105713561309fc5e2374396f86646b5aeb2a
recovery workflow run: 33790655704
artifact: phase6-old-r2-hero-recovery
artifact id: 9907188289
artifact digest: sha256:d289ce99daf895c04073347eb2626f5f7d2f25ac102e0ac3e599d2ed271a1a40
source SHA-256: b64e664b30e8c980bdaa3dfd34a52d6b61dbf1a5c8e202c8de15943dcff84d54
source size: 1420500 bytes
detected format: JPEG
pixel dimensions: 3024 x 4032
orientation: 1
ICC profile: present
provider mutation performed: false
```

The artifact contains the recovered original only as temporary Actions evidence; the recovered JPEG is **not** added to Git as a migrated media object。

## Visual review

The exact recovered bytes were visually inspected after the SHA/metadata check。

Observed content:

- a ginger-and-white cat sitting on the exterior shutter/window structure of a building;
- no vibration robot, toothbrush mechanism, motor, test course, or other article-subject visual is present;
- the image is therefore not semantically representative of the `blog:vibration-robot` article。

This observation is consistent with the frozen MDX usage, whose explicit alt text was `R2 image connectivity test` rather than a vibration-robot description。

## Interpretation

The recovery was technically successful, so the legacy locator is no longer an unknown/missing source identity。

However, successful recovery does **not** make the object suitable for republication as the vNext article hero。The object appears to have served as an R2 connectivity-test image and fails the semantic relevance expected of a durable article hero。

A separate correction proposal determines whether it should be excluded from the migrated public media set。This evidence record alone changes no accepted review payload and authorizes no publication or provider mutation。
