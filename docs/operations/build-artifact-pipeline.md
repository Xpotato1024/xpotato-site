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

`xpotato-site`のproduction artifactを、Article Job / R2 / AI providerのruntime availabilityから独立して再現可能に生成する。

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
  - media
  - interactive
  - provenance
  - discovery profile
- generated schemas where build requires them
- build/dependency profiles

R2 master bytes、AI provider response、private Article Job workspaceはnormal site build inputではない。

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
```

exact scriptsはroot/workspace `package.json`をmachine-readable SoTとする。

## Stage 1 — Toolchain / lock verification

verify:

- supported pinned Node version
- npm version/packageManager policy where pinned
- root `package-lock.json`
- workspace declarations
- no unexpected second lockfile
- workspace dependency boundary

production buildで`npm install`によるlock mutationを許可しない。

## Stage 2 — Generated contract freshness

`packages/content-contracts`のZod schemaから必要なJSON Schema等をgenerateする。

working/generated filesがexpected outputと一致しない場合fail。

build途中でstale generated schemaを自動修正してsuccess扱いにしない。

## Stage 3 — Deterministic repository validation

`operations/validation.md`のnetwork-free gateを実行。

少なくとも:

- ContentId
- frontmatter
- taxonomy
- logical media refs / Media Registry
- interactive registry
- publication provenance
- citation syntax in published MDX
- route/redirect
- discovery profile
- Git binary/media guards

を確認する。

## Stage 4 — Astro check

Astro / TypeScript / content schema / component typeをvalidate。

Article pipeline provider SDKやexample sandbox runtimeをsite check dependencyにしない。

## Stage 5 — Astro production build

outputはtemporary build directoryへ生成。

build-time requirements:

- no R2 master download
- no AI API call
- no Cloudflare API call
- no external metadata scraping
- no Article Job workspace dependency

Media Registry + delivery adapterからremote responsive URLをdeterministicにrenderする。

## Stage 6 — Pagefind Extended indexing

Astro build成功後、同じoutput treeをPagefind Extendedでindexする。

Pagefind indexはdeploy artifactの一部だがGit sourceではない。

Pagefind failure時、検索なしsiteとしてsilent deployしない。search enabled profileならbuild failure。

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
- asset path integrity

を検査する。

R2 object実在確認はexternal integration gateであり、ここではregistry-level integrityを確認する。

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

exact tree-hash algorithmはimplementationで固定する。

manifestはdeploy revision / debugging / rollback identityに利用できる。

## Deploy artifact

Cloudflareへ渡すのは最終site output tree + build manifest。

含む:

- prerendered HTML
- CSS/JS hashed assets
- small bundled site assets
- Pagefind index/runtime
- sitemap/RSS/robots/redirect/header control files

含まない:

- source MDX
- Article Job private artifacts
- AI provider responses
- source/evidence ledgers
- HEIC/raw photo
- R2 media master bytes
- example verifier logs
- Node/npm/node_modules

## Atomic revision rule

Astro outputとPagefind outputを別々にproductionへ更新しない。

1 build manifest = 1 deploy artifact revision。

site HTMLが新しいのにsearch indexが旧い状態をnormal deploy pathで作らない。

## Preview artifact

PR/site previewも同じbuild pathを使う。

ただしArticle Job pre-approval previewはprivate candidate media adapterを利用するため、repository PR previewとは別workflow。

### Repository PR preview

Git treeに既にexportされたMedia RegistryがR2 objectを指す。

### Article candidate preview

private candidate tree + local media adapterを使い、public R2 upload前にrenderする。

両者を同一stateとして混同しない。

## Build cache

CI/provider build cacheはperformance optimizationでありcorrectness SoTではない。

cache keyには少なくともrelevant lock/config/source identityを含める。

cache missでもsame outputを生成できること。

## Deployment gate

production deploy prerequisite:

- deterministic build PASS
- static output PASS
- deploy artifact manifest complete
- external integration checks required by change class PASS

media / redirect / infrastructureに無関係なPRで全external expensive checkを常時要求する必要はない。change classificationからrequired external checksを導出できる。

## Rollback

rollback targetはrepository revisionだけでなくbuild manifestへ解決できることが望ましい。

R2 media objectはimmutable/versionedなのでold Git/build revisionのregistryがold mediaを引き続き参照できる。

## Validation

- same source/config -> expected reproducible logical output
- Pagefind after Astro only
- no live provider dependency during normal build
- no R2 master download
- deploy tree has no private/source artifacts
- build manifest binds exact revision/config/index version
