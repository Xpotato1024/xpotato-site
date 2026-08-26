---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - vNext implementation migration plan
  - legacy implementation archive strategy
---

# Greenfield Rebuild and Legacy Archive Plan

## Current gate

Design=`PRE_FREEZE_REVIEW`。Implementation/migration/provider mutation are currently BLOCKED by `architecture/design-status.md`。

This plan is target sequence only; it is not permission to delete legacy code/create provider resources/deploy。

## Decision summary

After explicit Design Freeze, preserve old site by immutable Git ref and rebuild active implementation into vNext workspaces rather than incremental refactoring old responsibility boundaries。

Do not keep full old code under active `archive/old-src`。

Design-time legacy inventory source=`927d105713561309fc5e2374396f86646b5aeb2a`。Actual migration regenerates inventory from exact cutover legacy tag。

## Phase 0 — Clean-room Design Freeze

Before implementation:

1. freeze exact site design revision
2. use exact `architecture/infrastructure-handoff.md` counterpart revision
3. read-only clean-room audit per governance
4. require P0=0/P1=0
5. operator explicitly accepts Design Freeze
6. promote selected proposed ADR/docs to accepted/canonical deliberately
7. record exact freeze revision/audit basis in design-status

P2/measurement-dependent open decisions may remain if implementation can safely measure them later。

## Phase 1 — Legacy freeze / deterministic inventory

- current main audit
- annotated immutable legacy tag
- optional legacy branch only if real hotfix need
- old build reproduction
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

Do not delete old source yet。Foundation deterministic CI requires no Cloudflare credentials/provider mutations。

## Phase 3 — New site foundation

- Node/npm workspaces
- supported Astro
- Tailwind4/tokens
- Zod contracts
- stable ContentId/routes/taxonomy
- logical media renderer/registry/provenance schema
- Interactive Module Registry
- base layouts/modules/SEO/security
- archive/RSS/related
- MiniSearch + shared `xpotato-ja-tech-bigram-v1`
- GitHub Actions deterministic CI
- application-local Wrangler config

Representative fixture production build must pass network-free。

## Phase 4 — Content identity/content migration

```text
legacy file/path
 -> reviewed legacy record
 -> one stable vNext ContentId
 -> vNext collection/route
```

- no slug/numeric ID reuse as ContentId
- semantic MDX conversion where possible
- presentation/media/runtime fields to registries
- LegacyHtml isolated/manual reviewed
- `origin=legacy_migration` provenance only for evidence actually known

Do not fabricate historical evidence/AI provenance for legacy content。

## Phase 5 — Taxonomy migration

Initial Blog seed from inventory:

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
 -> migration candidate/authorization
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
- durable recovery binding can restore representative object without legacy Git bytes/job workspace
- rights unresolved=0 for republished objects

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

- every legacy public route classified: same/redirect/provider_redirect/retired
- canonical/sitemap/robots/404
- Blog/Notes 12/page
- RSS20 summary
- related max4 + current weight profile
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

Provider rule activation remains infra-owned。

## Phase 9 — Provider control-plane acceptance/cutover preparation

Do not follow a mutable infra branch。Use `architecture/infrastructure-handoff.md`。

Before any provider mutation:

1. update handoff to exact infra revision where ADR-0024 is accepted/mutation permitted
2. verify exact website provider values have been deliberately promoted into infra machine desired SoT
3. affected clean-room/review gate passes
4. explicit action authorization

Target responsibilities:

- site: GitHub Actions/Worker application deploy
- infra: Worker domain/DNS/source/public/protected media resources/provider redirects
- R2 config admin remains operator-ephemeral/off persistent CP/site CI trust
- Dashboard not normal desired-state control plane

## Phase 10 — Old implementation/Git raster removal

Only after content/media/route/provider readiness and rollback gates pass:

- remove old active `src/`
- remove obsolete framework/deploy scripts/config
- remove migrated active raster copies

No history rewrite。Legacy tag remains recovery/reference source。

## Phase 11 — Article Job implementation

Recommended order:

1. ContentId/source/evidence/claim schemas
2. semantic exchange + exact Skill snapshots
3. citation compiler
4. technical-example verifier
5. content audit/revision
6. visual/canonical media ingest
7. visual audit
8. deterministic variants
9. candidate + **pre-approval cleanup-safe material-claim ledger proposal**
10. preview/human approval
11. canonical source persistence
12. public delivery publication
13. exact protection receipt
14. **cleanup-safe CompactMediaRecoveryBinding**
15. repository export/provenance
16. explicit cleanup operation

Do not implement “hash-only provenance then delete detailed artifacts”。

## Phase 12 — Visual redesign / measured budgets

After contracts/migration foundation stable:

- visual tokens/style profile
- generated hero/social card design
- actual route-class performance budgets
- PrimeFactorizer bundle class threshold
- Comparison module API fixture-driven finalization

## Golden migration fixtures

1. `gale-storage-backend-compare` — software/benchmark
2. `codex-sqlite-write-amplification-mitigation` — citations/metrics
3. `vibration-robot` — LegacyHtml/media/robotics/query redirect
4. `2025-10-06` — screenshot/Bash/PowerShell/infrastructure
5. `prime-factorizer` — React island
6. `xpotato-site` Project — frontmatter/raster->object storage/small SVG candidate

## Cutover gate

- exact legacy tag build reproduced
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
- production deploy path requires no Workers Builds/dashboard SoT
- exact accepted infra handoff revision verified
- provider state/read-back/redirects accepted before cutover
- rollback verified
- old source no longer referenced by active workspace/build
