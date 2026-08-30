---
status: canonical
owner: migration
accepted_at: 2026-08-30
canonical_for:
  - Phase 5 taxonomy migration acceptance
  - Phase 6 media migration handoff
---

# Phase 5 Taxonomy Migration Acceptance — 2026-08-30

## Decision

Phase 5 of the vNext migration plan is accepted as complete.

The operator explicitly accepted the exact human-reviewed taxonomy payload before the final re-audit. The post-acceptance feature revision then passed a fresh clean-room re-audit and was merged through the normal PR path.

This acceptance closes taxonomy migration only. It does **not** authorize legacy media publication, removal of Blog publication holds, archive/route activation, provider mutation, production deployment, legacy cutover, old implementation deletion, rollback retirement, or production external-AI activation.

## Accepted implementation/audit target

```text
pre-acceptance implementation revision: ace019084b90247544f0302e0ea06d2ed0b9b703
operator acceptance record revision: 0650300d249e1e0ede8a4ac41e56a12c63b62433
fresh Phase 5 re-audit: PASS — P0=0 / P1=0 / P2=0
PR: #47
main merge commit: 395f096e509a006b007028862f69f629f20d7ae1
post-merge vNext CI: PASS
post-merge Phase 5 taxonomy readiness: PASS
post-merge Migration content readiness: PASS
Workers Builds check on merge revision: absent
```

The initial Phase 5 audit of `ace019084b90247544f0302e0ea06d2ed0b9b703` failed only because the Frozen taxonomy contract required human review and the exact review payload had not yet been explicitly accepted by the operator. The operator then accepted the exact payload, and `docs/migration/phase5-taxonomy-review-acceptance-2026-08-30.md` records that authority without changing the reviewed machine payload. The fresh re-audit of `0650300d249e1e0ede8a4ac41e56a12c63b62433` closed that P1 with no new findings.

## Accepted taxonomy evidence

Phase 5 accepted evidence includes:

- accepted Phase 4 immutable materialization manifest: `72ba1b79b550bb8e15ed68dfaa81d2ae8e730784497a96d419b32417a9f39fcb`;
- raw taxonomy inventory manifest: `306abbeaf9775e9a00efc4278f3841fa35a9e825d34c356a6ad902fe1d2cb522`;
- exact human-reviewed taxonomy payload: `eaaa43c0c45786f545333de0af4aba4c2b6887cbb3b38167488364c9e097e64a`;
- final taxonomy registry payload: `5b2f4f6c3ad6748fccb92a1cb1cd9393f36d2b27d7adb693a3f4da921974479d`;
- Phase 5 materialization manifest: `6d24e342d5b52cca1659915177abbb1aa5bdcf1cb87592b1917f0e7a6ab82bc1`;
- 52 entities with retained raw taxonomy evidence;
- 354 raw occurrences and 98 exact raw identities;
- 98 explicit decisions: active 71 / alias 18 / merge 5 / retire 4;
- 70 canonical migration tags, including 43 technology tags;
- 20 reader-facing archive-policy tags;
- 53 exact final content overlays, 51 tagged entities, and 6 Project stacks;
- exact preservation of accepted foundation taxonomy identities including `astro`, `wsl`, and `static-site`;
- deterministic validation that Project `stack` resolves only to active `kind=technology` tags;
- exact raw-term evidence retained for retired/aliased/merged terms rather than silently discarded.

## Accepted classification semantics

The accepted human-reviewed payload includes the initial three Blog categories:

```text
software        31
infrastructure  12
robotics         1
```

and retains:

- Note subject `infrastructure`;
- Tool category `calculation`;
- raw `network` as Blog category `infrastructure` plus the `network` topic tag;
- spelling/display variants resolving to stable IDs rather than duplicate taxonomy records;
- metadata-only retained terms as active IDs with `archive=false` / `indexable=false`;
- explicit retirement of `programing`, `univ`, `初心者向け`, and redundant tag `calculation`.

The exact machine artifact `docs/migration/taxonomy-review-v1.json` remains authoritative over prose summaries.

## Publication staging retained

Phase 5 does not publish legacy Blog content prematurely.

- Phase 4 Blog publication holds remain in force;
- media recovery/publication is still Phase 6 work;
- archive policy is selected, but public archive/route/discovery parity remains later derived-route work;
- no Cloudflare/R2/DNS/provider mutation occurred;
- no production deploy or legacy cutover occurred.

## Next implementation phase

The next repository implementation work is **Phase 6 — Legacy media migration**.

Phase 6 must preserve the existing publication/provider safety boundaries and complete the required media mapping, rights/provenance, canonical-source, public-delivery, protection, and cleanup-safe recovery evidence before affected Blog publication holds or old raster copies can be removed.

Interactive Tool migration, route/SEO/discovery parity, provider acceptance, cutover, rollback, and legacy deletion remain independent later gates.