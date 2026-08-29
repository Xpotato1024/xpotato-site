---
status: proposed
owner: architecture
last_verified: 2026-08-29
canonical_for:
  - vNext implementation migration plan
  - legacy implementation archive strategy
---

# Greenfield Rebuild and Legacy Archive Plan

## Current gate

Current lifecycle authority is `architecture/design-status.md`: Design=`FROZEN`; implementation=`IN PROGRESS` with the greenfield foundation accepted/merged and migration preparation underway。Legacy migration/cutover, Cloudflare provider mutation, and production external-AI activation remain BLOCKED by their own gates。

This plan is target sequence only; it is not permission to delete legacy code/create provider resources/deploy/enable production AI provider calls。

The phase headings below define ordering and acceptance conditions, not a second current-progress ledger。Current implementation status must be read only from `architecture/design-status.md`。

Design-time legacy inventory source=`927d105713561309fc5e2374396f86646b5aeb2a`。Actual migration regenerates inventory from exact cutover legacy tag。

## Phase 0 — Clean-room Design Freeze

Before implementation:

1. freeze exact site design revision
2. use exact infrastructure-handoff counterpart
3. read-only clean-room audit
4. require P0=0/P1=0
5. operator explicitly accepts Design Freeze
6. deliberately promote selected ADR/docs to accepted/canonical
7. record exact freeze revision/audit basis

P2/measurement-dependent items may remain only when later implementation can safely measure/fix them without changing material architecture。

## Phase 1 — Legacy freeze / deterministic inventory

- current main audit
- annotated immutable legacy tag
- optional legacy branch only if real hotfix need
- reproduce the exact frozen legacy build under the explicitly accepted legacy-build reproduction/equivalence contract (`contracts/legacy-build-reproduction-contract.md` + the bounded ADR-0030 Astro/React island UID amendment)
- screenshot/performance baseline
- exact content/route/media/taxonomy/interactive/LegacyHtml/client-JS inventories from same tag

Design-time baseline:

- Blog44 / Projects6 / Notes1 / Tools1 / Pages1
- user-facing React Tool1
- known Git raster/photo ≈4.54MB

Any cutover-tag delta is explicitly reviewed。

## Phase 2 — Workspace + CI skeleton

Create after freeze on feature branch:

```text
.github/workflows/ci.yml
.github/workflows/deploy-site.yml
apps/site
packages/content-contracts
packages/article-pipeline
packages/media-ingest
packages/example-verifier
packages/site-validators
```

Old source remains until parity/cutover gates pass。Foundation deterministic CI uses no Cloudflare credential/provider mutation and no live external AI request。

## Phase 3 — Contracts / profiles / site foundation

Implement machine SoTs before enabling external semantic providers or migration publication:

- Node/npm workspaces
- supported Astro
- Tailwind4/tokens
- Zod content contracts
- stable ContentId/routes
- ADR-0027 portable MDX/taxonomy/content-module/Interactive Registry schemas
- Media Registry + Publication Provenance schemas
- source/evidence/claim/citation schemas
- **ExternalAiDisclosureRecord / ExternalAiDisclosureManifest schemas**
- **initial machine profile `article-external-ai-disclosure-v1` from `operations/external-ai-disclosure-profile.md`**
- AI execution profile schemas
- technical-example verifier profile schemas
- base layouts/modules/SEO/security
- archive/RSS/related
- MiniSearch + shared `xpotato-ja-tech-bigram-v1`
- GitHub Actions deterministic CI
- application-local Wrangler config

Required pre-AI-provider fixtures:

- private/unknown disclosure default deny
- hard-secret denial
- public anonymous source admission
- ArticleJobBrief explicit user authorization
- derived-only redaction/raw-byte exclusion
- exact request-manifest = outbound artifact set
- provider adapter hidden-context rejection

Representative site production build remains network-free。

## Phase 4 — Content identity/content migration

```text
legacy file/path
 -> reviewed legacy record
 -> one stable vNext ContentId
 -> portable vNext content + registry bindings
```

- no slug/numeric ID reuse as ContentId
- semantic MDX conversion where possible
- presentation/storage/runtime fields to registries/system-derived output
- direct runtime component paths -> Interactive Module Registry
- LegacyHtml isolated/manual reviewed rather than treated as new authoring API
- `origin=legacy_migration` provenance only for evidence actually known

Do not fabricate historical evidence/AI/disclosure provenance for legacy content。

## Phase 5 — Taxonomy migration

Initial Blog seed:

```text
software        31
infrastructure  12
robotics         1
```

Notes subject=`infrastructure`; Tool category=`calculation`。

Raw tags/technologies -> reviewed active/alias/merge/retire/archive policy。Unknown term silent fallback prohibited。

## Phase 6 — Legacy media migration

Scope:

- WordPress photos/screenshots
- Project raster overview
- raster Tool/site visuals
- legacy R2 semantic-path objects

Small deterministic SVG/logo/favicon/icon only Git candidates。

Flow:

```text
legacy inventory
 -> semantic asset/role mapping
 -> rights/provenance classification
 -> private ingest
 -> privacy-normalized canonical source
 -> visual/manual review
 -> deterministic delivery variants
 -> migration candidate/operator authorization
 -> private canonical source persistence/verify
 -> public delivery persistence/verify
 -> exact protected copy/verify
 -> cleanup-safe media recovery binding
 -> Media Registry/migration provenance
```

Requirements before old active Git raster removal:

- raw camera original not copied as canonical source
- canonical source re-read/reprofile fixture PASS
- public required variants complete
- full protection receipt exact object equality
- durable recovery binding restores representative object without legacy Git bytes/job workspace
- rights unresolved=0 for republished objects

Legacy media migration does not imply external AI disclosure。If an external vision/image service is deliberately used during migration, the same ADR-0026 admission policy applies to the exact image/context artifacts and requires explicit migration/user disclosure authorization as appropriate。

## Phase 7 — Interactive Tool migration

PrimeFactorizer target:

```text
Tool ContentId
 -> Interactive Module Registry prime-factorizer
 -> React island
 -> client:visible candidate
```

Tool source/hydration path stays out of MDX。Content-only routes receive no React runtime leakage。

## Phase 8 — Route/SEO/discovery/search parity

- every legacy route classified: same/redirect/provider_redirect/retired
- canonical/sitemap/robots/404
- Blog/Notes12/page
- RSS20 summary
- related max4/current weight profile
- MiniSearch serialized index
- Japanese/katakana/mixed technical fixtures
- Pagefind-class `新幹線` regression fixture

Known path redirects:

- `/blog/prime-factorizer/` -> `/tools/prime-factorizer/`
- `/blog/category/tools/` -> `/tools/`

Known provider query redirect requirements:

- `/?p=34`
- `/?p=693`
- `/?p=811`

Provider rule activation remains infra-owned/blocked until accepted counterpart state。

## Phase 9 — Provider control-plane acceptance/cutover preparation

Do not follow a mutable infra branch。Use `architecture/infrastructure-handoff.md` exact revision。

Before provider mutation:

1. handoff points to exact accepted/mutation-permitted infra revision
2. exact website provider values deliberately promoted to infra machine desired SoT
3. affected clean-room/review gate passes
4. explicit action authorization

Target responsibilities:

- site: GitHub Actions/Worker application deploy
- infra: Worker domain/DNS/source/public/protected media resources/provider redirects
- R2 config admin operator-ephemeral/off persistent CP/site CI trust
- Dashboard not normal desired-state control plane

External AI provider activation is a separate application-side gate: accepted ADR-0026/profile machine SoT + disclosure validation fixtures + runtime provider credentials must exist before live Article Job semantic calls。

## Phase 10 — Old implementation/Git raster removal

Only after content/media/route/provider readiness and rollback gates pass:

- remove old active `src/`
- remove obsolete framework/deploy scripts/config
- remove migrated active raster copies

No history rewrite。Legacy tag remains recovery/reference source。

## Phase 11 — Article Job implementation

Recommended dependency order:

1. ArticleJobSpec/ContentId/source artifact schemas
2. **external-AI disclosure policy machine profile + records/authorizations/derived-artifact/manifest compiler**
3. **request exact-set/final-secret-scan provider transport gate**
4. source discovery candidate exchange + deterministic pinning/disclosure classification
5. source/evidence/claim schemas and evidence semantic exchange
6. author semantic exchange + exact Skill snapshots
7. citation compiler
8. technical-example verifier
9. independent content audit/revision
10. visual planning + image-generation request admission
11. visual/canonical media ingest
12. external/local visual audit admission
13. deterministic variants
14. candidate + pre-approval cleanup-safe material-claim ledger proposal
15. preview/human approval
16. canonical source persistence
17. public delivery publication
18. exact protection receipt
19. cleanup-safe CompactMediaRecoveryBinding
20. repository export/provenance including safe external AI policy/manifest/run hash lineage
21. explicit cleanup operation with disclosure-security incident hold check

Do not enable a live external semantic provider earlier than steps 2–3 validation fixtures。Do not implement “provider-use boolean means all job sources can be sent”。Do not implement hash-only provenance then delete detailed artifacts when required support/recovery semantics would disappear。

## Phase 12 — Visual redesign / measured budgets

After contracts/migration foundation stable:

- visual tokens/style profile
- generated hero/social card design
- actual route-class performance budgets
- PrimeFactorizer bundle class threshold
- Comparison module API fixture-driven finalization

## Golden migration / Article Job fixtures

1. `gale-storage-backend-compare` — software/benchmark
2. `codex-sqlite-write-amplification-mitigation` — citations/metrics
3. `vibration-robot` — LegacyHtml/media/robotics/query redirect
4. `2025-10-06` — screenshot/Bash/PowerShell/infrastructure
5. `prime-factorizer` — React island
6. `xpotato-site` Project — frontmatter/raster->object storage/small SVG candidate
7. disclosure fixture — public official source + private user log derived-only + hard-secret negative case

## Cutover / production-activation gate

- exact legacy tag build reproduced under the explicitly accepted legacy-build reproduction/equivalence contract
- every published content has disposition + ContentId
- every referenced media mapped/retired
- every public route classified
- taxonomy/interactive/LegacyHtml blockers resolved
- canonical source/public/protected media coverage verified
- durable media recovery binding verified from retained Git state
- representative protected restore exact SHA PASS
- SEO/sitemap/RSS/MiniSearch/robots/404 PASS
- Japanese search regressions PASS
- no unintended content-route hydration
- Git media guard PASS
- deterministic CI PASS
- external-AI disclosure profile/schema/fixtures PASS before live Article Job provider use
- production deploy path requires no Workers Builds/dashboard SoT
- exact accepted infra handoff verified
- provider state/read-back/redirects accepted before cutover
- rollback verified
- old source no longer referenced by active workspace/build

ADR-0028 and ADR-0030 have passed their required fresh design audits, were explicitly accepted, and now have Phase 1A machine evidence。That closes only the legacy-build reproduction prerequisite; all other content/media/route/provider/recovery/rollback requirements above remain independently blocking for cutover。
