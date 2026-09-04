---
status: accepted
owner: migration
last_verified: 2026-09-04
canonical_for:
  - Phase 6 media migration human review acceptance
  - accepted legacy media disposition and rights-candidate authority
---

# Phase 6 Media Review Acceptance — 2026-09-04

## Authority

The operator explicitly accepted the Phase 6 media review proposal, then explicitly amended the ConoHa UI screenshot decision by choosing **案B**: do not republish the third-party UI screenshot; replace it with a repository-owned deterministic explanatory diagram.

The effective accepted machine review is therefore the amended payload:

```text
raw media inventory payload:
  1e4721d1c02c4f15c3a7faf2a121870997a67717b552f010145ca956ddadf96e
original reviewed proposal payload:
  05db11598552df659d70ac60c80060d0bdf86584969e4c914605e187e5387eb6
operator amendment:
  ConoHa screenshot -> deterministic self-created diagram (案B)
effective accepted review payload after 案B:
  a01171ac3c95230259a3173d2fccb823e71ac8e80c9a228c070673478bf81a39
effective proposal regeneration revision:
  8272b1c6186cf43337d88f9ee236fec4d234ad5d
```

The 案B payload above is retained as historical accepted authority. The operator subsequently accepted the narrowly scoped Project overview profile correction recorded below; the current effective review payload is therefore the corrected hash in that section.

## Accepted repository-side decisions

- all 15 frozen legacy media locators have exactly one explicit disposition;
- `/blog-placeholder-1.jpg` is not recovered and is replaced by per-content deterministic hero media;
- existing repository-owned Project/Tool SVG assets remain migration candidates as deterministic diagrams;
- Project overview raster assets remain migration candidates under the reviewed screenshot/overview profile;
- vibration-robot Git-backed media remain photo candidates;
- recovered `r2:/blog/my-first-post/GDCH3152.JPG` is retained only as historical recovery evidence and is excluded from the vNext canonical/public/Media Registry publication set;
- the ConoHa control-panel screenshot `/wp-content/uploads/2025/10/19EBD197-78A0-4E6A-82A4-7365DF22AF13.png` is **not** a publication candidate; its semantic instructional role is replaced by a self-created deterministic SVG diagram;
- all 44 historically published Blogs receive one deterministic hero cover and one deterministic social card; `blog:vibration-robot` no longer depends on a nonlocal legacy hero.

## Project overview profile correction acceptance

The operator explicitly accepted `docs/migration/phase6-media-profile-correction-proposal-2026-09-04.md` after read-only visual review of the three exact frozen Project overview PNG objects.

```text
correction proposal Git blob SHA: e9a33c83bde4a860ad3fb0bacc300fd1af0285f8
previous effective review payload: a01171ac3c95230259a3173d2fccb823e71ac8e80c9a228c070673478bf81a39
correction: project-overview-v1 -> screenshot-ui-v1 (three Project overview decisions only)
current effective accepted review payload: f257ad5f2de8bc89afbb245c94bca60c820b7df725e81d372e634517727bba70
```

No disposition, rights basis, source action, semantic role, ConoHa 案B decision, or provider/publication boundary changed. The three assets remain `mediaKindCandidate=screenshot`; only their invalid/nonexistent delivery profile reference was corrected to the frozen `screenshot-ui-v1` profile.

The Project overview profile-correction acceptance above was exact-hash-bound to `f257ad5f2de8bc89afbb245c94bca60c820b7df725e81d372e634517727bba70`. It is superseded only by the separately accepted R2 semantic correction below.

## Old R2 hero semantic correction acceptance

The operator explicitly accepted `docs/migration/phase6-r2-hero-semantic-correction-proposal-2026-09-04.md` after read-only recovery and visual inspection of the exact frozen `r2:/blog/my-first-post/GDCH3152.JPG` object.

```text
accepted correction proposal pre-acceptance Git blob SHA: 5cd64675a3e44c7c4564f0b530128c202c038b04
recovered source SHA-256: b64e664b30e8c980bdaa3dfd34a52d6b61dbf1a5c8e202c8de15943dcff84d54
recovered source: JPEG 3024 x 4032, 1420500 bytes
recovery Actions artifact id: 9907188289
recovery artifact digest: sha256:d289ce99daf895c04073347eb2626f5f7d2f25ac102e0ac3e599d2ed271a1a40
previous effective review payload: f257ad5f2de8bc89afbb245c94bca60c820b7df725e81d372e634517727bba70
correction: retire recovered connectivity-test cat image from publication semantics; use deterministic cover for blog:vibration-robot hero
current effective accepted review payload: 49fe35022d3a573c2575b81add0195921673b17e8ba2da1c8f4707668b8ee3e8
operator acceptance time: 2026-09-04T03:45:00+09:00
```

The recovered JPEG remains evidence only; it is not a vNext canonical source, public delivery object, protected-copy candidate, or Media Registry publication asset. The three content-relevant Git-backed `vibration-robot` body photos remain unchanged. No historical robot image is fabricated.

This acceptance is exact-hash-bound to `49fe35022d3a573c2575b81add0195921673b17e8ba2da1c8f4707668b8ee3e8`. A later review-payload change requires new operator acceptance.

## Safety boundary

This acceptance authorizes repository-side Phase 6 implementation only, including:

- rights/provenance records derived from the accepted review;
- deterministic media generation and validation;
- local/CI canonical ingest and variant candidate generation;
- Media Registry candidate construction;
- recovery planning/evidence that does not mutate an external provider.

This acceptance **does not authorize persistent external mutation**. In particular it does not authorize:

- upload to public R2;
- upload to private canonical-source R2;
- protected-copy creation;
- Cloudflare provider mutation;
- DNS/custom-domain mutation;
- production deployment;
- publication/cutover;
- legacy source deletion.

A later persistent-provider mutation requires a separate explicit authorization and its own readiness gate.
