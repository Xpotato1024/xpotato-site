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
- small site assets
- reusable factual docs
- unresolved legacy HTML inventory where truly necessary

Gitに残さない:

- old components/layout/CSS
- obsolete build/deploy config
- obsolete WordPress importer as active tool
- article photo/screenshot binary
- old responsive image copies
- old build artifact

## Rebuild phases

### Phase 0 — Design freeze

- proposed SoT / contracts review
- accepted ADRs
- open decision resolution plan
- npm workspace layout freeze
- migration acceptance criteria

### Phase 1 — Legacy freeze and inventory

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

all inventories bind same legacy commit/tag.

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

legacy raw category/tag/subject valuesをfrequency集計し:

- active term
- alias
- merge
- retire

へexplicit mappingする。

unknown published termをsilent fallbackしない。

vNext registry確定後、content frontmatterをstable IDsへ変換する。

### Phase 6 — Media migration to R2-first

legacy article photo / screenshot / project visualを原則R2 content mediaへ移す。

flow:

```text
legacy media inventory
  -> content/role/semantic asset mapping
  -> normalize in private staging
  -> content-addressed object key
  -> operator-reviewed migration publication plan
  -> R2 upload/reuse
  -> post-upload verification
  -> Media Registry generation
```

rules:

- normal content photoをnew Git treeへcopyしない
- old `public/wp-content/uploads`をvNext active media storeにしない
- favicon/logo/small UI icon等だけ`git_site_asset`候補
- same normalized bytesはsame R2 keyでdedupe可能
- camera/private metadataをpublic derivativeへ残さない
- referenced legacy mediaにmappingなしはcutover blocker

legacy mediaは既に公開済みであるため、Article Jobのper-candidate approval laneとは別の**migration operator authorization**でbulk publicationできる。external upload自体はexplicit migration plan review後のみ実行する。

### Phase 7 — Interactive Tool migration

旧MDXのReact/component importをinventoryから:

- registry_module
- rewrite
- retire

へ分類する。

Tool contentからsource path / `client:*`を除去し、Interactive Module Registryへ移す。

PrimeFactorizer等のrepresentative toolでroute-local bundleを確認する。

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

unclassified public routeはcutover blocker。

### Phase 9 — Old implementation removal

parity gate通過後に初めてold active implementation-only fileを削除する。

- root old `src/`
- old Astro/Tailwind config
- obsolete scripts/importer
- old image copies already mapped to R2

Git historyは消さない。history rewrite / orphan branch不要。

### Phase 10 — Article pipeline implementation

site contracts/runtime安定後にArticle Jobを実装する。

order candidate:

1. source/evidence contracts
2. semantic exchange
3. technical example verifier
4. content audit/revision
5. visual pipeline
6. candidate/preview/human approval
7. R2 media publication
8. repository export/provenance

site rendererとArticle pipelineを同時に全面debugしない。

### Phase 11 — Visual redesign

contracts / content migrationが安定した後、design token / semantic module上でvisual redesignする。

AI visual style profile / social card designもこのphaseで確定できる。

## Migration inventories

exact schemaは`contracts/migration-inventory-contract.md`。

raw scan outputは`.local/migration/`。

reviewed disposition mapping / small summaryだけversion control対象にできる。

## Rollback

cutover条件:

- legacy tagからold site build再現可能
- new Git revisionが参照するR2 objectがverify済み
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
- Git content media guard pass
- R2 media registry verification pass
- production deployment verified
- rollback verified
- old source no longer referenced by workspace/build/config
