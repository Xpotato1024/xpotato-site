---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - vNext build artifact pipeline
  - deploy artifact composition
  - build network boundary
---

# Build Artifact Pipeline

## Goal

`xpotato-site`のproduction artifactをArticle Job / R2 / AI provider / Cloudflare control-plane availabilityから独立して再現可能に生成する。

Astro HTMLとPagefind search indexを同一site revisionから生成し、別revisionのartifactを混在させない。

## Inputs

production site buildのcanonical inputs:

- repository commit
- root lockfile
- pinned Node toolchain
- `apps/site` source/content
- `packages/content-contracts`
- site registries:
  - taxonomy
  - media master/variant manifests
  - interactive
  - provenance
  - discovery profile
- generated schemas where build requires them
- build/dependency profiles

R2 media bytes、AI provider response、private Article Job workspace、Cloudflare API stateはnormal build inputではない。

## Logical pipeline

```text
repository revision
      |
      v
1. toolchain / lock verification
      |
      v
2. generated-contract freshness
      |
      v
3. deterministic repository validation
      |
      v
4. Astro check / type validation
      |
      v
5. Astro production build
      |
      v
6. Pagefind Extended indexing
      |
      v
7. static output validation
      |
      v
8. deploy package manifest
      |
      v
single immutable deploy artifact
      |
      v
GitHub Actions deploy job
      |
      v
Wrangler -> Worker service
```

exact scriptsはroot/workspace `package.json`をmachine-readable SoTとする。

## Stage 1 — Toolchain / lock verification

verify:

- supported pinned Node version
- npm/packageManager policy where pinned
- root `package-lock.json`
- workspace declarations
- no unexpected second lockfile
- workspace dependency boundary

production buildで`npm install`によるlock mutationを許可しない。

## Stage 2 — Generated contract freshness

`packages/content-contracts`のZod schemaから必要なJSON Schema等をgenerateする。

expected outputと一致しない場合fail。stale generated schemaをbuild中にsilent修正しない。

## Stage 3 — Deterministic repository validation

`operations/validation.md`のnetwork-free gateを実行。

少なくとも:

- ContentId
- frontmatter / taxonomy
- logical media refs
- Media Registry master/variant manifests
- media rights / provenance chain
- interactive registry
- citation syntax
- route/redirect
- discovery profile
- Git media guards

を確認する。

## Stage 4 — Astro check

Astro / TypeScript / content schema / component typeをvalidate。

Article pipeline provider SDK、media encoder、example sandbox runtimeをsite check dependencyにしない。

## Stage 5 — Astro production build

outputはtemporary build directoryへ生成。

build-time requirements:

- no R2 master/variant download
- no AI API call
- no Cloudflare API call
- no external metadata scraping
- no Article Job workspace dependency
- no Cloudflare Images dependency

Media Registryのrecorded master/variant identityとdelivery configからpublic object URLs / `<picture>` / `srcset`をdeterministicにrenderする。

buildはremote image dimension/profile discoveryを行わない。

## Stage 6 — Pagefind Extended indexing

Astro build成功後、同じoutput treeをPagefind Extendedでindexする。

Pagefind indexはdeploy artifactの一部だがGit sourceではない。

search enabled profileでPagefind failureならbuild failure。検索なしsiteとしてsilent deployしない。

## Stage 7 — Static output validation

final build treeに対して:

- routes
- canonical
- sitemap
- RSS
- robots
- 404
- structured data
- search page noindex
- Pagefind representative queries
- no unintended client JS
- baseline responsive media markup / fallback

を検査する。

R2 object実在確認やCloudflare rule stateはexternal integration gate。

## Stage 8 — Deploy package manifest

```ts
interface SiteBuildManifest {
  schemaVersion: 1;
  repositoryCommit: string;
  nodeVersion: string;
  lockfileSha256: string;
  siteConfigSha256: string;
  taxonomyRegistrySha256: string;
  mediaRegistrySetSha256: string;
  interactiveRegistrySha256: string;
  discoveryProfileSha256: string;
  pagefindVersion: string;
  outputTreeSha256: string;
  generatedAt: string;
}
```

manifestはdeploy revision / debugging / rollback identityに利用できる。

## Deploy artifact

Cloudflare Worker deployへ渡すのは最終site output tree + build manifest。

含む:

- prerendered HTML
- CSS/JS hashed assets
- small deterministic bundled site assets
- Pagefind index/runtime
- sitemap/RSS/robots/redirect/header control files

含まない:

- source MDX
- Article Job private artifacts
- AI responses/evidence ledgers
- HEIC/raw photo
- R2 master/variant bytes
- example verifier logs
- Node/npm/node_modules

## CI/CD ownership

production site CI/CD SoT:

```text
.github/workflows/ci.yml
.github/workflows/deploy-site.yml
```

Cloudflare Workers Builds / Pages dashboard build settingをproduction deploy authorityにしない。

`deploy-site.yml`はexact reviewed revisionからこのbuild artifactを再生成/取得し、scoped Worker deploy credentialでWrangler deployする。

DNS / Worker custom-domain / R2 config / Cloudflare Rulesはこのworkflowから変更しない。

## Atomic revision rule

Astro outputとPagefind outputを別々にproductionへ更新しない。

1 build manifest = 1 deploy artifact revision。

site HTMLが新しいのにsearch indexが旧い状態をnormal deploy pathで作らない。

## Preview artifact

PR/site previewも同じbuild pathを使う。

Article Job pre-approval previewはprivate candidate master/variant adapterを利用するため、repository PR previewとは別workflow。

### Repository PR preview

Git treeにexport済みMedia Registryがpublic R2 object identitiesを指す。buildはbytesを取得しない。

### Article candidate preview

private candidate tree + local master/variant adapterを使い、public R2 upload前にapproval対象をrenderする。

## Build cache

CI cacheはperformance optimizationでありcorrectness SoTではない。

cache keyにはrelevant lock/config/source identityを含め、cache missでもsame logical outputを生成できること。

## Deployment gate

production deploy prerequisite:

- deterministic build PASS
- static output PASS
- deploy manifest complete
- change classに必要なexternal integration checks PASS

media/infra無関係PRで全R2/Cloudflare checkを常時要求しない。

## Rollback

rollback targetはrepository revision + build manifestへ解決できることが望ましい。

R2 master/variantsはimmutable/versionedなのでold Git revisionのMedia Registryがold media setを参照できる。

published mediaがGitへexportされる前にprotected recovery receiptを要求するため、rollbackで必要なmediaはrecovery planeにも存在することをtargetとする。

## Validation

- same source/config -> expected reproducible logical output
- Pagefind after Astro only
- no live provider dependency during normal build
- no R2 media download
- no Cloudflare Images dependency
- deploy tree has no private/source artifacts
- build manifest binds exact revision/config/index version
- deploy workflow definition is Git-controlled
- Cloudflare Dashboard build settings are not required
