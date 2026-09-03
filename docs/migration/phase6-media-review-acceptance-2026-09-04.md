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
- `r2:/blog/my-first-post/GDCH3152.JPG` remains a source-recovery candidate for the vibration-robot hero/inline semantic asset;
- the ConoHa control-panel screenshot `/wp-content/uploads/2025/10/19EBD197-78A0-4E6A-82A4-7365DF22AF13.png` is **not** a publication candidate; its semantic instructional role is replaced by a self-created deterministic SVG diagram;
- historically published Blogs receive the reviewed hero/social-card plan: one hero and one deterministic social card per Blog, with the vibration-robot hero retaining its reviewed legacy-source recovery path and other missing Blog heroes using deterministic covers.

## Project overview profile correction acceptance

The operator explicitly accepted `docs/migration/phase6-media-profile-correction-proposal-2026-09-04.md` after read-only visual review of the three exact frozen Project overview PNG objects.

```text
correction proposal Git blob SHA: e9a33c83bde4a860ad3fb0bacc300fd1af0285f8
previous effective review payload: a01171ac3c95230259a3173d2fccb823e71ac8e80c9a228c070673478bf81a39
correction: project-overview-v1 -> screenshot-ui-v1 (three Project overview decisions only)
current effective accepted review payload: f257ad5f2de8bc89afbb245c94bca60c820b7df725e81d372e634517727bba70
```

No disposition, rights basis, source action, semantic role, ConoHa 案B decision, or provider/publication boundary changed. The three assets remain `mediaKindCandidate=screenshot`; only their invalid/nonexistent delivery profile reference was corrected to the frozen `screenshot-ui-v1` profile.

This acceptance is exact-hash-bound to `f257ad5f2de8bc89afbb245c94bca60c820b7df725e81d372e634517727bba70`. A later review-payload change requires new operator acceptance.

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
