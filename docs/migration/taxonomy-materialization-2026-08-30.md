---
status: implementation-evidence
owner: content
last_verified: 2026-08-30
canonical_for:
  - Phase 5 taxonomy migration evidence
  - Phase 6 media/publication handoff
---

# Phase 5 Taxonomy Materialization Evidence

## Scope

Phase 5 converts the taxonomy evidence retained by accepted Phase 4 into reviewed stable registry IDs and applies that review as a deterministic overlay on top of the exact Phase 4 content materialization.

This evidence does **not** authorize media publication, route/redirect activation, provider mutation, production deployment, cutover, rollback retirement, or legacy deletion.

## Input lineage

Phase 5 remains bound to the accepted Phase 4/frozen legacy chain:

```text
legacy tag: legacy-pre-vnext-2026-08-28
legacy tag object: 8503f5a50a5fb3d27a02422da0b50dc66c818b02
legacy commit: 927d105713561309fc5e2374396f86646b5aeb2a
Phase 4 materialization manifest: 72ba1b79b550bb8e15ed68dfaa81d2ae8e730784497a96d419b32417a9f39fcb
```

Phase 4 content evidence is still regenerated exactly. Phase 5 does not rewrite the historical Phase 4 manifest. The active-file check is layered:

```text
frozen legacy + Phase 4 candidate evidence
 -> exact Phase 4 expected bytes / immutable Phase 4 manifest
 -> Phase 5 raw taxonomy inventory
 -> explicit taxonomy review
 -> Phase 5 taxonomy overlay
 -> active content + active taxonomy registry
```

## Raw inventory

Machine artifact:

`docs/migration/taxonomy-raw-inventory-v1.json`

Result:

- candidate entities: 53
- entities with deferred taxonomy: 52
- raw occurrences: 354
- exact raw identities: 98
- namespaces:
  - Blog category: 4
  - Note subject: 1
  - Tag/Project technology: 92
  - Tool category: 1
- manifest SHA-256: `306abbeaf9775e9a00efc4278f3841fa35a9e825d34c356a6ad902fe1d2cb522`

Raw strings are preserved byte-for-byte in evidence. NFKC + trim + lowercase is recorded only as a normalization aid; it does not silently merge semantic identities.

## Review

Machine artifact:

`docs/migration/taxonomy-review-v1.json`

Every one of the 98 raw identities has exactly one explicit machine decision.

```text
active: 71
alias: 18
merge: 5
retire: 4
canonical migration tags: 70
technology tags: 43
reader-facing archive tags selected by migration review: 20
review SHA-256: eaaa43c0c45786f545333de0af4aba4c2b6887cbb3b38167488364c9e097e64a
```

The prose taxonomy contract names `metadata_only` as a review concept while its validation rule requires published raw terms to resolve through `active | alias | merge | retire`. Phase 5 represents metadata-only retained terms as:

```text
disposition = active
archive = false
indexable = false
```

This keeps the stable metadata ID without generating a thin archive page.

### Explicit normalization examples

- `TypeScript` / `typescript` -> `typescript`
- `Tailwind CSS` / `tailwind` -> `tailwind-css`
- `AnythingLLM` / `anythingllm` -> `anythingllm`
- `Qdrant` / `qdrant` -> `qdrant`
- `RAG` / `rag` -> `rag`
- `vLLM` / `vllm` -> `vllm`
- `WSL` / `wsl` / `wsl2` -> `wsl`
- `webサーバー` -> `web-server`
- `公開鍵認証` -> `public-key-auth`
- `TEI` is retained as the technology **Text Embeddings Inference (TEI)** after context review

### Explicit retirements

- `programing` — typo
- `univ` — one-off metadata
- `初心者向け` — one-off audience metadata
- tag `calculation` — redundant with Tool category `calculation`

The raw values remain in Phase 5 evidence even when retired.

## Category/subject/tool mapping

Frozen Blog category evidence is reviewed against the accepted three-category seed:

- `devlog` -> `software`
- `infra` -> `infrastructure`
- `network` -> `infrastructure` + supplemental `network` topic tag
- `diary` -> `robotics` for the frozen vibration-robot entry

The Phase 5 overlay verifies that these decisions agree with the Phase 4 seed partition rather than silently changing category semantics.

Other fixed seeds remain:

- Note subject `infrastructure`
- Tool category `calculation`

## Foundation registry preservation

Phase 5 does not replace the accepted pre-migration registry from legacy evidence alone. It merges reviewed migration tags onto the accepted foundation registry and preserves its existing IDs/semantics, including:

- `astro`
- `wsl`
- `static-site`

A duplicate migration tag may extend aliases/archive flags only when its `id`, `label`, `slug`, and `kind` agree with the accepted foundation definition. Conflict fails closed.

The resulting TypeScript registry under `apps/site/src/content-registry/taxonomy/` is the active machine SoT after Phase 5 materialization.

## Final overlay

Machine artifact:

`docs/migration/taxonomy-materialization-v1.json`

Result:

```text
records: 53
tagged legacy entities: 51
Projects with stack: 6
explicit retired raw-term records: 4
final taxonomy registry SHA-256: 5b2f4f6c3ad6748fccb92a1cb1cd9393f36d2b27d7adb693a3f4da921974479d
Phase 5 materialization manifest SHA-256: 6d24e342d5b52cca1659915177abbb1aa5bdcf1cb87592b1917f0e7a6ab82bc1
```

Every active legacy-derived file is reconstructed from exact Phase 4 expected bytes plus the reviewed Phase 5 taxonomy overlay. The Phase 5 checker exact-compares all 53 active files, generated taxonomy registry data/index, and the materialization manifest.

Project `stack` accepts only active `kind=technology` tag IDs. Unknown IDs, unreviewed raw terms, ambiguous aliases, an attempted Project-technology retirement, and registry conflicts fail closed.

## Hosted validation

Permanent repository gates include:

- `migration:content:materialization:evidence:check`
- `migration:taxonomy:inventory:check`
- `migration:taxonomy:review:check`
- `migration:taxonomy:materialization:check`
- root `npm run ci`
- `Migration content readiness`
- `Phase 5 taxonomy readiness`

The Phase 5 taxonomy-readiness run on the layered CI candidate passed with:

- Phase 4 evidence: PASS
- raw taxonomy inventory: PASS
- taxonomy review: PASS
- taxonomy materialization: PASS
- 24 test files / 202 tests: PASS
- TypeScript typecheck: PASS
- repository validation: PASS
- Astro check: 54 files / 0 errors / 0 warnings / 0 hints
- static Astro build: PASS / 17 pages
- CSP: PASS
- search index: PASS / 10 documents
- static validation: PASS
- `git diff --check`: PASS

The repository still reports the existing npm dependency observations (5 vulnerabilities: 1 moderate / 4 high and install-script warnings). No frozen dependency-audit threshold is introduced by Phase 5.

## Deferred work

Phase 5 resolves the retained taxonomy mapping itself. It does not open later lifecycle gates.

Still blocked:

- Phase 6 media recovery/publication and removal of Blog `blog_media_registry` holds
- route/redirect parity and activation
- SEO/RSS/search final parity after publication state changes
- provider desired-state activation
- production deployment
- legacy cutover and deletion
- rollback closure

No Cloudflare/R2/DNS mutation or production deployment occurs in Phase 5.
