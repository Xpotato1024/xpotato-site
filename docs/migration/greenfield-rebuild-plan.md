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

2026-08-26時点のdesign inventoryは`current-site-inventory-2026-08-26.md`に保存しており、main `927d105713561309fc5e2374396f86646b5aeb2a`をsource revisionとする。

実装開始時にmainが進んでいる場合は、このsupporting inventoryをそのままcurrent扱いせず、cutover対象legacy tagからdeterministic inventoryを再生成して差分を明示する。

## Why not `archive/old-src`

active repo内へfull old sourceを残すと:

- code search / AI agent contextにlegacyが混ざる
- dependency scanner / IDEがobsolete package/configを拾う
- duplicate route / type / assetが発生し得る
- repository sizeが増える

ためfull code archiveはGit history/tagへ委ねる。

## Archive mechanism

cutover前のlegacy main commitを固定する。

```text
annotated tag: legacy-site-v1-final   # exact nameはimplementation時確定
optional branch: legacy/site-v1       # hotfix needがある場合のみ
```

minimum:

- commit SHAをmigration recordへ記録
- annotated tagをremoteへ作成
- old production identity / date / migration referenceをtag messageへ記録
- tagからold site buildを再現確認
- inventory generatorがexact tag/commitを入力にする

## What remains in vNext main

Gitに残す:

- migrated MDX/content
- stable ContentId
- taxonomy / media / interactive / provenance registry
- legacy URL / redirect mapping
- small deterministic site assets
- reusable factual docs
- unresolved legacy HTML inventory where truly necessary

Gitに残さない:

- old components/layout/CSS
- obsolete build/deploy config
- obsolete WordPress importer as active tool
- article/project/site photographic or raster media
- old responsive image copies
- old build artifact

## Rebuild phases

### Phase 0 — Design freeze

- proposed SoT / contracts review
- accepted ADRs
- open decision resolution plan
- npm workspace layout freeze
- migration acceptance criteria
- current inventory findings incorporated

### Phase 1 — Legacy freeze and deterministic inventory

- current main audit
- annotated legacy tag
- legacy build reproduction
- production screenshot / performance baseline
- deterministic inventories:
  - content
  - route
  - media
  - taxonomy
  - interactive component
  - raw legacy HTML
  - client JS baseline

all inventories bind same legacy commit/tag。

2026-08-26 supporting inventory baseline:

- Blog 44
- Projects 6
- Notes 1
- Tools 1
- Pages 1
- user-facing React Tool implementation 1
- known Git photographic/raster media約4.54 MB

cutover tagのgenerated inventoryがこのbaselineと違う場合、差分をreviewする。

### Phase 2 — Workspace skeleton

feature branch上で:

```text
apps/site
packages/content-contracts
packages/article-pipeline
packages/media-ingest
packages/example-verifier
packages/site-validators
```

を作る。

この時点ではold sourceを消さず、new workspace foundationだけを独立validationする。

### Phase 3 — New site foundation

- Node / npm workspace baseline
- current supported Astro
- Tailwind 4
- `content-contracts` Zod schema
- Content Layer
- stable ContentId support
- taxonomy registries
- media logical-reference renderer
- interactive registry shell
- base layouts / modules
- SEO / security headers
- archive / RSS / related discovery foundation
- Pagefind post-build integration foundation
- CI / validation

representative fixture contentでnew `apps/site`がbuildできること。

### Phase 4 — Content identity and content migration

collection単位でcontentを移す。

各legacy entryにnew stable ContentIdを割り当て、migration mappingを固定する。

```text
legacy file/path
  -> legacy content record
  -> vNext ContentId
  -> vNext collection/path
```

rules:

- existing semantic contentをnew IDで1回だけmap
- slug / WordPress numeric IDをContentIdとして流用しない
- legacy bodyは可能な限りMarkdown/MDXを保持
- `summary` / image path / React import等はnew contractsへ分離
- LegacyHtmlはmanual-review inventoryへ限定
- migrated contentに`origin=legacy_migration` publication provenanceを生成

content count / disposition / ID uniquenessを検証する。

### Phase 5 — Taxonomy migration

2026-08-26 inventoryからinitial Blog category seedは確定済み:

```text
software        31
infrastructure  12
robotics         1
```

cutover tagでsame current content setならこのmappingを使用する。

意味:

- raw/current `devlog` -> `software` topical category。devlog semanticsはArticle Job `build_log`等へ移す
- current `network` 1件 -> `infrastructure` + network/ssh/vps topic tags
- current `diary` fallbackを継承しない
- current published 0件の`app`を初期categoryにしない
- `vibration-robot` -> robotics

Notes initial subject seed:

- `infrastructure`

Tools initial category seed:

- `calculation`

Tag / Project technologyはfrozen inventoryからfrequency集計し:

- active
- alias
- merge
- retire
- metadata-only/archive-enabled

へexplicit mappingする。

unknown published termをsilent fallbackしない。

vNext registry確定後、content frontmatterをstable IDsへ変換する。

### Phase 6 — Media migration to R2-first + protection

legacy photographic/raster mediaをR2 mediaへ移す。

対象はarticleだけではない。

- WordPress photo/screenshot
- Project overview raster
- Tool raster if any
- photographic/raster site hero/background
- legacy R2 semantic-path object

small deterministic SVG / logo / favicon / iconはGit candidateとしてreviewできる。

flow:

```text
legacy media inventory
  -> content/site role + semantic asset mapping
  -> rights/provenance classification
  -> normalize in private staging
  -> content-addressed object key
  -> operator-reviewed migration publication plan
  -> public R2 upload/reuse
  -> post-upload verification
  -> protected recovery copy
  -> protection receipt verification
  -> Media Registry generation
```

rules:

- normal photo/screenshot/raster visualをnew Git treeへcopyしない
- old `public/wp-content/uploads`をvNext active media storeにしない
- `public/images/projects/*.png`等のrasterもR2へ移す
- current `public/images/ui/hero-workshop-stage.jpg`のようなphotographic site heroもR2へ移す
- small deterministic SVG/icon等だけGit-bundled候補
- same normalized bytesはsame R2 keyでdedupe可能
- camera/private metadataをpublic derivativeへ残さない
- rights unknown external imageを再uploadしない
- referenced legacy mediaにmappingなしはcutover blocker
- legacy `r2:/...` pathをvNext semantic identityとして継承しない

legacy mediaは既に公開済みであるため、Article Jobのper-candidate approval laneとは別の**migration operator authorization**でbulk publicationできる。

ただしold Git/media copyを削除する前に、migrated R2 objectについてprotected-copy receiptが成立し、representative restore drillが成功していることを要求する。

### Phase 7 — Interactive Tool migration

2026-08-26 inventoryではuser-facing React ToolはPrimeFactorizer 1件。

旧MDXのReact/component importをinventoryから:

- registry_module
- rewrite
- retire

へ分類する。

PrimeFactorizer baseline:

```text
Tool content
 -> stable ContentId
 -> Interactive Module Registry `prime-factorizer`
 -> framework React
 -> hydration visible
```

Tool contentからsource path / `client:*`を除去する。

route-local bundleを確認し、normal content routesへReact runtimeを漏らさない。

### Phase 8 — Route / SEO / discovery parity

- legacy public route inventoryとnew build比較
- same / redirect / provider_redirect / retiredを全routeで分類
- path redirect生成
- WordPress query redirectをinfra ownerへhandoff
- canonical / sitemap / robots / 404整合
- archive counts確認
- RSS validation
- related content fixture確認
- Pagefind Japanese search fixture確認

known compatibility route baseline:

- `/blog/prime-factorizer/` -> `/tools/prime-factorizer/`
- `/blog/category/tools/` -> `/tools/`

current meta-refresh implementationをコピーせずreal 301 path redirectへ昇格する。

`/pages/`はcurrent fixed-page listing。vNextでretireするならroute inventoryへexplicit dispositionを持つ。

unclassified public routeはcutover blocker。

### Phase 9 — Old implementation / Git raster removal

parity gate通過後に初めてold active implementation-only fileを削除する。

- root old `src/`
- old Astro/Tailwind config
- obsolete scripts/importer
- old photographic/raster media copies mapped to R2 + protected recovery copy

small reusable deterministic SVG等をvNext Git assetとして明示adoptする場合だけ残せる。

Git historyは消さない。history rewrite / orphan branch不要。

### Phase 10 — Article pipeline implementation

site contracts/runtime安定後にArticle Jobを実装する。

order candidate:

1. source discovery / source/evidence contracts
2. semantic exchange
3. citation compilation
4. technical example verifier
5. content audit/revision
6. visual pipeline
7. candidate/preview/human approval
8. R2 media publication
9. media protection receipt integration
10. repository export/provenance

site rendererとArticle pipelineを同時に全面debugしない。

### Phase 11 — Visual redesign

contracts / content migrationが安定した後、design token / semantic module上でvisual redesignする。

AI visual style profile / social card designもこのphaseで確定できる。

## Golden migration fixtures

2026-08-26 current inventoryから最低限:

1. `gale-storage-backend-compare`
   - clean MDX
   - software/devlog taxonomy
   - benchmark claims
2. `codex-sqlite-write-amplification-mitigation`
   - long investigation
   - external citations
   - observed metrics
3. `vibration-robot`
   - LegacyHtml
   - legacy local images + legacy R2 hero
   - robotics category
   - WordPress query legacy URL
4. `2025-10-06`
   - LegacyHtml
   - screenshot
   - Bash/PowerShell examples
   - infrastructure/network mapping
5. `prime-factorizer`
   - Tool + React island
6. `xpotato-site` Project
   - project frontmatter cleanup
   - large raster overview -> R2
   - small SVG cover -> Git candidate

をmigration test fixtureにする。

## Migration inventories

exact schemaは`contracts/migration-inventory-contract.md`。

raw scan outputは`.local/migration/`。

reviewed disposition mapping / small summaryだけversion control対象にできる。

`current-site-inventory-2026-08-26.md`はdesign-time baseline evidenceであり、cutover tag由来generated inventoryを置き換えない。

## Rollback

cutover条件:

- legacy tagからold site build再現可能
- new Git revisionが参照するR2 objectがverify済み
- new Git revisionが参照するpublic mediaにvalid protection receipt
- representative protected-media restoreでSHA一致
- legacy build artifactまたはtag build pathをrollback window中保持
- R2 content-addressed old/new objectsはrollbackを妨げない

## Cutover gate

- every published legacy content has disposition + vNext ContentId
- content count / intended merge-retire差分説明済み
- every referenced media mapped / retired explicitly
- every public route classified
- required redirects prepared
- taxonomy unresolved 0
- interactive Tool unresolved 0
- material LegacyHtml unresolved 0 or explicit blocker acceptance
- representative screenshots reviewed
- SEO / sitemap / RSS / search / robots / 404 validation
- performance regression review
- no unintended React hydration on content-only routes
- Git media guard pass
- R2 media registry verification pass
- media protection receipt coverage pass
- representative protected-media restore pass
- production deployment verified
- rollback verified
- old source no longer referenced by workspace/build/config
