---
status: canonical
owner: migration
accepted_at: 2026-08-30
canonical_for:
  - Phase 5 taxonomy human review acceptance
  - exact taxonomy review payload adoption
---

# Phase 5 Taxonomy Review Acceptance — 2026-08-30

## Decision

The operator explicitly accepts the exact Phase 5 taxonomy review payload described below as the human-reviewed initial taxonomy migration decision set.

This acceptance closes the human-review prerequisite for the exact reviewed taxonomy mapping only. It does **not** by itself declare Phase 5 complete, merge PR #47, authorize media publication, archive/route activation, provider mutation, production deployment, cutover, rollback retirement, legacy deletion, or production external-AI activation.

A fresh read-only clean-room re-audit of the post-acceptance revision is still required before Phase 5 may be accepted as complete or merged.

## Accepted exact review identity

```text
pre-acceptance feature revision: ace019084b90247544f0302e0ea06d2ed0b9b703
raw taxonomy inventory manifest SHA-256: 306abbeaf9775e9a00efc4278f3841fa35a9e825d34c356a6ad902fe1d2cb522
review artifact: docs/migration/taxonomy-review-v1.json
review payload SHA-256: eaaa43c0c45786f545333de0af4aba4c2b6887cbb3b38167488364c9e097e64a
Phase 5 materialization manifest SHA-256: 6d24e342d5b52cca1659915177abbb1aa5bdcf1cb87592b1917f0e7a6ab82bc1
```

The accepted review is byte/hash-bound to the review payload above. A changed taxonomy review payload requires a new human review/acceptance; this record must not be used to authorize modified review bytes.

## Accepted review scope

The accepted machine review covers all 98 exact raw taxonomy identities found in the frozen Phase 4 migration evidence.

```text
explicit decisions: 98
active: 71
alias: 18
merge: 5
retire: 4
canonical migration tags: 70
technology tags: 43
reader-facing archive tags: 20
```

Key accepted semantics include:

- Blog categories: `devlog -> software`, `infra -> infrastructure`, `network -> infrastructure + network tag`, and the frozen `diary` fallback entry -> `robotics`;
- Note subject `infrastructure` and Tool category `calculation` remain the initial seeds;
- spelling/display variants such as `TypeScript/typescript`, `AnythingLLM/anythingllm`, `Qdrant/qdrant`, `RAG/rag`, `vLLM/vllm`, `WSL/wsl/wsl2`, and `Tailwind CSS/tailwind` resolve to one stable ID each;
- `webサーバー -> web-server`, `公開鍵認証 -> public-key-auth`, and `TEI` is retained as Text Embeddings Inference;
- `programing`, `univ`, `初心者向け`, and redundant tag `calculation` are explicitly retired as recorded by the review artifact;
- retained metadata-only terms are represented as active stable IDs with `archive=false` and `indexable=false`;
- Project technology values resolve only to active `kind=technology` tags;
- the accepted foundation taxonomy identities, including `astro`, `wsl`, and `static-site`, remain preserved rather than being replaced by legacy-derived inference.

The exact machine artifact is authoritative over this prose summary if any wording ambiguity exists.

## Safety boundary

This review acceptance does not alter the frozen legacy tag/source, the accepted historical Phase 4 manifest, publication holds, media/provider state, deployment authority, redirect/provider rules, or legacy deletion gates.

The next gate is a fresh exact-revision clean-room re-audit of PR #47 after this acceptance record is committed.