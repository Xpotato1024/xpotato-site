---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - vNext implementation migration plan
  - legacy implementation archive strategy
---

# Greenfield Rebuild and Legacy Archive Plan

## Decision summary

vNext実装開始時、旧directory structure上でincremental refactorを続けない。

**旧実装をGit tagでimmutableに保存し、legacy inventoryを固定した後、active treeをnpm-workspace構成へ再構築する。**

2026-08-26 design inventory source=`927d105713561309fc5e2374396f86646b5aeb2a`。

実装開始時はactual cutover tagからinventoryを再生成する。

## Archive mechanism

```text
annotated tag required
optional legacy branch only if hotfix need exists
```

active vNext mainへfull `archive/old-src`を置かない。

## Rebuild phases

### Phase 0 — Design freeze

- SoT/contracts/ADR review
- remaining measurement-only decision plan
- workspace/CI/Cloudflare boundary freeze
- migration acceptance criteria

### Phase 1 — Legacy freeze/inventory

- current main audit
- annotated legacy tag
- old build reproduction
- screenshots/performance baseline
- content/route/media/taxonomy/interactive/LegacyHtml/JS inventory

2026-08-26 baseline:

- Blog 44
- Projects 6
- Notes 1
- Tools 1
- Pages 1
- user-facing React Tool 1
- Git raster/photo ~4.54 MB

### Phase 2 — Workspace + CI skeleton

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

old sourceはまだ消さない。

### Phase 3 — New site foundation

- Node/npm workspace
- current supported Astro
- Tailwind 4
- Zod content contracts
- ContentId/taxonomy
- media logical renderer/registry
- Interactive Module Registry
- layouts/modules/SEO/security
- archive/RSS/related
- MiniSearch 7.2.0 + `xpotato-ja-tech-bigram-v1`
- GitHub Actions CI
- application-local Wrangler config

network-free production build PASSをfixtureで確認する。

### Phase 4 — Content identity/content migration

```text
legacy file/path
 -> legacy record
 -> stable vNext ContentId
 -> vNext collection/path
```

- IDをslug/numeric IDから流用しない
- LegacyHtmlをsemantic MDXへ移す
- presentation/media/runtime fieldsをregistriesへ分離
- `origin=legacy_migration` provenance

### Phase 5 — Taxonomy migration

initial Blog:

```text
software        31
infrastructure  12
robotics         1
```

Notes subject=`infrastructure`、Tool category=`calculation`。

raw tags/technologiesはactive/alias/merge/retire/archive policyへreviewする。

### Phase 6 — Media migration: raw/legacy -> canonical source -> delivery -> protection

対象:

- WordPress photos/screenshots
- Project raster overview
- photographic/raster Tool/site visual
- legacy R2 semantic-path object

small deterministic SVG/logo/favicon/iconのみGit candidate。

flow:

```text
legacy media inventory
 -> semantic asset/role mapping
 -> rights/provenance
 -> private ingest
 -> privacy-normalized lossless canonical master
 -> semantic/visual review
 -> deterministic responsive variants
 -> operator-reviewed migration candidate
 -> private source-media R2 canonical source upload/verify
 -> public R2 delivery master/variants upload/verify
 -> protected-media exact-byte copy/verify
 -> Media Registry / migration provenance
```

requirements:

- raw camera originalをsource-media bucketへそのままcopyしない
- source-media = privacy-normalized canonical only
- public delivery = prebuilt variants; Cloudflare Images不要
- protected media = exact public object set
- no raster media remains in active Git unless explicit tiny fixture exception
- old Git copy削除前にsource re-encode fixture + protected restore fixture PASS

### Phase 7 — Interactive Tool migration

PrimeFactorizer:

```text
Tool ContentId
 -> Interactive Module Registry prime-factorizer
 -> React
 -> hydration visible
```

content-only routeへReact漏出なし。

### Phase 8 — Route/SEO/discovery/search parity

- all legacy routes classify
- path redirects + provider redirects
- canonical/sitemap/robots/404
- Blog/Notes 12/page
- RSS 20 summary
- related max4 / weights profile
- MiniSearch serialized index
- Japanese/katakana/mixed technical regression fixtures
- Pagefind issue regression (`新幹線`)をfalse-positive guardにする

known path redirects:

- `/blog/prime-factorizer/` -> `/tools/prime-factorizer/`
- `/blog/category/tools/` -> `/tools/`

known provider query redirects:

- `/?p=34`
- `/?p=693`
- `/?p=811`

### Phase 9 — Cloudflare control-plane preparation

site repo:

- Worker application config
- GitHub Actions deploy
- Wrangler

`Xpotato-Server`:

- `xpotato.net` Worker binding/DNS
- website private source-media R2
- website public media R2/custom domain
- website private protected-media R2 + lock
- provider query redirects

principles:

- no Workers Builds/Pages dashboard production authority
- OpenTofu first where compatible
- official API adapter for provider gaps
- R2 config admin operator-ephemeral only
- Dashboard bootstrap/billing/recovery/break-glass only

actual mutation is separate explicit infra change/authorization。

### Phase 10 — Old implementation/Git raster removal

parity/media/control-plane readiness後だけold `src/`、obsolete configs/scripts、mapped raster copiesを削除する。

Git history rewriteなし。

### Phase 11 — Article pipeline implementation

order:

1. source/evidence
2. AI exchange/citation
3. technical example verifier profiles
4. content audit/revision
5. visual/canonical media ingest
6. visual audit
7. deterministic variants
8. candidate/preview/human approval
9. private canonical source storage
10. public media publication
11. protected media receipt
12. repository export/provenance
13. explicit Article Job cleanup operation

### Phase 12 — Visual redesign

tokens/semantic modules上でvisual design/style profile/social cardsを確定する。

## Golden migration fixtures

1. `gale-storage-backend-compare` — software/benchmark
2. `codex-sqlite-write-amplification-mitigation` — citations/metrics
3. `vibration-robot` — LegacyHtml/local+R2 media/robotics/query redirect
4. `2025-10-06` — screenshot/Bash/PowerShell/infrastructure
5. `prime-factorizer` — React island
6. `xpotato-site` Project — frontmatter cleanup/raster->R2/SVG candidate

## Rollback/cutover gate

- legacy tag build reproduced
- all published content has disposition + ContentId
- all media mapped/retired
- all routes classified
- taxonomy/interactive/LegacyHtml blockers resolved
- canonical source-media storage verified for migrated raster
- public master/variants verified
- protected exact-byte coverage/restore verified
- SEO/sitemap/RSS/MiniSearch/robots/404 PASS
- Japanese search regressions PASS
- no unintended content-route hydration
- Git media guard PASS
- deterministic CI PASS
- production deploy does not require Dashboard build config
- required Xpotato-Server Cloudflare proposal accepted/implemented before cutover
- rollback verified
- old source no longer referenced
