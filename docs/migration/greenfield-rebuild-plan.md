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

**旧実装をGitでimmutableに保存し、legacy inventoryを固定した後、active implementation treeをnpm-workspace構成へ再構築する。**

2026-08-26 design inventoryは`current-site-inventory-2026-08-26.md`。source revision=`927d105713561309fc5e2374396f86646b5aeb2a`。

実装開始時はcutover対象legacy tagからdeterministic inventoryを再生成し、design-time baselineとの差分をreviewする。

## Why not `archive/old-src`

active repo内へfull old sourceを残すとcode search/AI context/dependency scanner/IDEへlegacyが混ざり、duplicate route/config/assetとrepository size増加を招く。

full code archiveはGit history/tagへ委ねる。

## Archive mechanism

cutover前legacy mainを固定する。

```text
annotated tag: legacy-site-v1-final   # exact nameはimplementation時確定
optional branch: legacy/site-v1       # hotfix needがある場合のみ
```

minimum:

- exact commit SHA
- annotated remote tag
- production identity/date/migration reference
- tagからold site build再現
- inventory generatorがexact tag/commitを入力

## What remains in vNext main

Git:

- migrated MDX/content
- stable ContentId
- taxonomy / media / interactive / provenance registry
- legacy URL / redirect mapping
- small deterministic site assets
- reusable factual docs

Gitに残さない:

- old components/layout/CSS
- obsolete build/deploy config
- obsolete WordPress importer as active tool
- article/project/site photographic or raster media
- responsive media variants
- old build artifact

## Rebuild phases

### Phase 0 — Design freeze

- proposed SoT/contracts review
- ADR acceptance
- remaining parameter decision plan
- npm workspace layout freeze
- GitHub Actions CI/CD boundary freeze
- Cloudflare Dashboard/control-plane boundary freeze
- migration acceptance criteria

### Phase 1 — Legacy freeze and deterministic inventory

- current main audit
- annotated legacy tag
- legacy build reproduction
- production screenshots/performance baseline
- deterministic inventories:
  - content
  - routes
  - media
  - taxonomy
  - interactive components
  - raw legacy HTML
  - client JS baseline

all inventories bind same legacy commit/tag。

2026-08-26 baseline:

- Blog 44
- Projects 6
- Notes 1
- Tools 1
- Pages 1
- user-facing React Tool implementation 1
- known Git photographic/raster media約4.54 MB

### Phase 2 — Workspace + CI skeleton

feature branch上で:

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

を作る。

この時点ではold sourceを消さない。

CI workflowはCloudflare credentialなしでfoundation fixtureをvalidate/buildできること。

production deploy workflowはまだ実production deployを実行しなくてよいが、Wrangler/static artifact boundaryを定義する。

### Phase 3 — New site foundation

- current supported Node / npm workspace baseline
- current supported Astro
- Tailwind 4
- `content-contracts` Zod schema
- Content Layer
- ContentId
- taxonomy registries
- logical media renderer
- media master + prebuilt variant registry support
- interactive registry shell
- base layouts/modules
- SEO/security headers
- archive/RSS/related foundation
- Pagefind integration
- GitHub Actions CI
- application-local Wrangler static-assets config
- validation

representative fixtureで`apps/site` production buildがnetwork-free PASS。

Cloudflare Workers Builds/Pages dashboard build settingをfoundation dependencyにしない。

### Phase 4 — Content identity and content migration

collection単位でcontentを移す。

```text
legacy file/path
 -> legacy content record
 -> vNext ContentId
 -> vNext collection/path
```

rules:

- semantic contentをnew IDへ1回だけmap
- slug/WordPress numeric IDをContentIdにしない
- legacy bodyは可能な範囲でsemantic Markdown/MDX化
- presentation/media/runtime fieldをnew registriesへ分離
- LegacyHtmlはmanual-review inventoryへ限定
- `origin=legacy_migration` provenance

### Phase 5 — Taxonomy migration

initial Blog category seed:

```text
software        31
infrastructure  12
robotics         1
```

rules:

- raw/current `devlog` -> software topic; build-log semanticsはArticle mode
- current network 1件 -> infrastructure + network/ssh/vps tags
- diary fallbackを継承しない
- published 0件appをseedしない
- vibration-robot -> robotics

Notes subject seed=`infrastructure`。
Tools category seed=`calculation`。

Tags/technologiesはfrozen inventoryからactive/alias/merge/retire/archive policyをreviewする。

unknown term silent fallback禁止。

### Phase 6 — Media migration: normalized master -> prebuilt variants -> R2 -> protection

対象:

- WordPress photo/screenshot
- Project overview raster
- photographic/raster Tool visual
- photographic/raster site hero/background
- legacy R2 semantic-path object

small deterministic SVG/logo/favicon/iconだけGit candidate。

flow:

```text
legacy media inventory
 -> semantic asset / role mapping
 -> rights/provenance classification
 -> private normalization
 -> semantic/visual review
 -> deterministic delivery profile
 -> AVIF/WebP/fallback variant generation
 -> master/variant manifest
 -> content-addressed public object plan
 -> migration operator authorization
 -> public R2 master/variant upload/reuse
 -> complete-set verification
 -> protected recovery copy
 -> MediaProtectionReceipt
 -> Media Registry generation
```

rules:

- normal photo/screenshot/raster visualをnew Gitへcopyしない
- `public/wp-content/uploads`をactive media storeにしない
- Project PNG / photographic site heroもR2へ移す
- responsive variantsもGitへ置かない
- variant generationはCloudflare Imagesを必要としない
- same bytesはcontent-addressed keyでdedupe
- private metadataをpublic derivativeへ残さない
- rights unknown external imageを再uploadしない
- referenced media mapping unresolvedはcutover blocker
- legacy `r2:/...` literalをvNext semantic identityとして継承しない

old Git/media copyを削除する前にpublic object + protection receipt + representative restoreを検証する。

### Phase 7 — Interactive Tool migration

current user-facing React ToolはPrimeFactorizer 1件。

```text
Tool content
 -> stable ContentId
 -> Interactive Module Registry prime-factorizer
 -> framework React
 -> hydration visible
```

MDXからsource path / `client:*`を除去する。

content-only routeへReact runtimeを漏らさない。

### Phase 8 — Route / SEO / discovery parity

- legacy/new route compare
- same / redirect / provider_redirect / retired分類
- path redirects
- query/domain redirects -> infra requirement
- canonical/sitemap/robots/404
- archives pagination: initial Blog 12/page
- RSS: initial 20 summary items
- related max 4
- Pagefind Japanese fixtures

known compatibility paths:

- `/blog/prime-factorizer/` -> `/tools/prime-factorizer/`
- `/blog/category/tools/` -> `/tools/`

meta refreshをcopyせず301へ昇格する。

`/pages/`をretireする場合もexplicit route disposition。

### Phase 9 — Cloudflare control-plane cutover preparation

production siteのCloudflare desired stateをDashboard手順ではなくGit contractへ揃える。

site repo:

- Worker service application config
- GitHub Actions deploy workflow
- Wrangler deploy

`Xpotato-Server`:

- `xpotato.net` Worker custom-domain binding
- DNS
- R2 public media custom domain/config requirement
- query/domain redirects
- optional Cache/Compression Rules
- media protection configuration

principles:

- Cloudflare Workers Builds/Pages dashboard pipelineをproduction authorityにしない
- OpenTofu first where supported
- provider gap -> official API reconcile adapter
- security-sensitive R2 bucket config desired valuesはGitに置くがadmin credentialをCP/site CIへ常設しない
- operator-authorized ephemeral admin credentialでCLI/API reconcile
- Dashboardはbootstrap/billing/recovery/break-glassのみ

actual provider mutationはseparate explicit infra change/authorization。

### Phase 10 — Old implementation / Git raster removal

parity + media + Cloudflare cutover readiness gate通過後にold implementation-only fileを削除する。

- root old `src/`
- old Astro/Tailwind config
- obsolete scripts/importer
- old photographic/raster media copies whose R2/protection path is verified

small adopted deterministic SVG等だけ明示的に残せる。

Git historyはrewriteしない。

### Phase 11 — Article pipeline implementation

site renderer/runtime安定後にArticle Jobを実装する。

order:

1. source discovery/evidence contracts
2. semantic exchange
3. citation compilation
4. technical example verifier
5. content audit/revision
6. visual master pipeline + independent visual audit
7. deterministic media variant generation
8. candidate/preview/human approval
9. R2 master/variant publication
10. media protection receipt integration
11. repository export/provenance

### Phase 12 — Visual redesign

contracts/content migration後、tokens/semantic modules上でvisual redesign。

AI visual style/social card designをここで確定できる。

## Golden migration fixtures

1. `gale-storage-backend-compare` — clean MDX / software taxonomy / benchmark claims
2. `codex-sqlite-write-amplification-mitigation` — long investigation / external citations / metrics
3. `vibration-robot` — LegacyHtml / local images + legacy R2 hero / robotics / query legacy URL
4. `2025-10-06` — LegacyHtml / screenshot / Bash+PowerShell / infrastructure mapping
5. `prime-factorizer` — Tool + React island
6. `xpotato-site` Project — frontmatter cleanup / large raster overview -> R2 / small SVG cover candidate

## Migration inventories

exact schema=`contracts/migration-inventory-contract.md`。

raw scan=`.local/migration/`。

reviewed disposition mapping/small summaryだけversion control可能。

## Rollback

cutover条件:

- legacy tagからold site build再現
- new Git revisionが参照するR2 master/variants verify済み
- valid media protection receipt
- representative protected restoreでSHA一致
- legacy build/tag build pathをrollback window中保持
- R2 immutable old/new objectsはrollbackを妨げない

## Cutover gate

- every published legacy content has disposition + ContentId
- content count差分説明済み
- every media mapped/retired
- every public route classified
- required redirects prepared
- taxonomy unresolved 0
- interactive Tool unresolved 0
- material LegacyHtml unresolved 0 or explicit acceptance
- representative screenshots reviewed
- SEO/sitemap/RSS/search/robots/404 PASS
- performance review
- content-only hydration regressionなし
- Git media guard PASS
- Media Registry master/variant verification PASS
- media protection receipt coverage PASS
- representative protected restore PASS
- GitHub Actions deterministic CI PASS
- production deploy path does not require Cloudflare Dashboard build setting
- required `Xpotato-Server` Cloudflare desired-state change prepared/verified
- rollback verified
- old source no longer referenced
