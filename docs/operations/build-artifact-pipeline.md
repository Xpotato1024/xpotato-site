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

Astro HTMLとserialized MiniSearch indexを同一site revisionから生成し、別revisionのartifactを混在させない。

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
- shared search tokenizer source/profile
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
5. Astro raw production build
      |
      v
5a. vNext bounded UID canonicalization
      |
      v
6. SearchDocument extraction + MiniSearch serialization
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
- discovery/search profile
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

searchable page templateはmain searchable regionとmachine metadataを明示する。

## Stage 5a — vNext bounded artifact canonicalization

ADR-0032は2026-09-24にAccepted。Astro 7.2.7 / @astrojs/react 6.0.4 / React 19.2.8のexact profileで、tools/prime-factorizer/index.htmlの唯一のReact islandをregistry、route、DOM位置、属性、SSR children、component/renderer asset bytes、dependency version、UID以外のpage bytesでpositive proofする。unknown差分はbuildをFAILさせる。元bufferのUID値byte rangeのみをstable semantic digestに置換し、他byteが変化しないことを証明する。legacy reproduction outputは対象外。

このstageはroot npm run buildに必須で、search extractionより先、最終static validationより前に実行する。raw Astro tree SHAとcanonicalization後/search前tree SHAは区別してlogへ記録する。raw treeはdeploy identityではない。
## Stage 6 — SearchDocument extraction + MiniSearch serialization

Astro build成功後、same output treeからsearchable regionだけを抽出する。

flow:

```text
built HTML
 -> SearchDocument[]
 -> xpotato-ja-tech-bigram-v1 tokenizer
 -> MiniSearch 7.2.0 index
 -> serialized search index
```

requirements:

- build/browserで同じtokenizer sourceを使う
- draft/noindex/search-ineligible contentを除外
- global nav/footer/common chromeを除外
- private provenance/source ledgerを除外
- serialized indexを`dist`内のdeploy artifactとして生成
- generated indexをGitへcommitしない

search enabled profileでindex generation failureならbuild failure。検索なしsiteとしてsilent deployしない。

exact semanticsは`operations/static-search-profile.md`。

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
- MiniSearch Japanese/mixed regression queries
- tokenizer parity
- no unintended client JS
- baseline responsive media markup / fallback

を検査する。

R2 object実在確認やCloudflare rule stateはexternal integration gate。

Final deploy treeへ入るapplication-local text control artifactもbyte identityの一部である。特に`apps/site/public/_headers`はGit checkout時からLF固定とし、`.gitattributes`で`eol=lf`を要求する。Security/static validationはsourceとbuilt `_headers`のCR byteを拒否し、semanticな改行正規化だけでproduction artifact gateを通さない。Windows/Linuxで同じfinal bytesを要求するADR-0032の実装条件である。

## Stage 8 — Deterministic deploy package manifest

final static validation後のapps/site/distを全件read-backしてmanifestを生成する。file pathはdist-relative、/ separator、NFC、空segment・.・..なし。symlinkやunsupported entryを拒否する。UTF-8 bytewise Buffer.compareでpathを明示sortし、filesystem enumeration orderおよびlocaleCompareへ依存しない。

Deterministic sidecar manifest fields:

    schemaVersion: 1
    algorithm: xpotato-site-deploy-tree-v1
    fileCount
    outputTreeSha256
    files: sorted [relativePath, byteSize, sha256]

outputTreeSha256のinputはASCII domain xpotato-site-deploy-tree-v1とNUL、4-byte BE file count、各entryの4-byte BE UTF-8 path byte length + path bytes + 8-byte BE byte size + 32 raw SHA256 bytes。長さ付きframingで曖昧さを排除する。JSON sidecarは固定key順、2-space、LF。generatedAtなど観測時刻はidentityへ入れず、operation recordに分離する。sidecarはdist外へ置き、Wrangler assets.directoryが読むfinal dist全ファイルだけをtree SHAの対象とする。

manifest CLIはfinal canonicalized UIDを再検証し、raw Astro UIDのままならFAILする。production deploy authorizationは同じfinal distの32ファイルのsize/SHA256とoutputTreeSha256を比較する。単なるsemantic equivalence、UID差の無視、raw Astro tree hashへの置換は不可。
## Deploy artifact

Cloudflare Worker deployへ渡すのは最終site output tree + build manifest。

含む:

- prerendered HTML
- CSS/JS hashed assets
- small deterministic bundled site assets
- MiniSearch serialized index + search-route runtime
- sitemap/RSS/robots/redirect/header control files

含まない:

- source MDX
- Article Job private artifacts
- AI responses/evidence ledgers
- HEIC/raw photo
- private canonical raster master
- R2 delivery master/variant bytes
- example verifier logs
- Node/npm/node_modules

## CI/CD ownership

production site CI/CD SoT:

```text
.github/workflows/ci.yml
.github/workflows/deploy-site.yml
```

Cloudflare Workers Builds / Pages dashboard build settingをproduction deploy authorityにしない。

通常production pathのtargetでは`deploy-site.yml`がexact reviewed revisionからこのbuild artifactを再生成/取得し、approved credentialでWrangler deployする。現行workflowは`if: ${{ false }}`でBLOCKED。Decision Bの一時workstation JIT例外も同じartifact identity / validation gateを満たす必要があり、workstation上の任意working treeをdeploy authorityにしない。正式GitHub Actions pathが別review/安全な有効化/実運用acceptanceを通過した後、workstation例外を別reviewed changeで廃止する。

DNS / Worker custom-domain / R2 config / Cloudflare Rulesはこのworkflowから変更しない。

## Atomic revision rule

Astro outputとsearch indexを別々にproductionへ更新しない。

1 build manifest = 1 deploy artifact revision。

site HTMLが新しいのにsearch indexが旧い状態をnormal deploy pathで作らない。

## Preview artifact

PR/site previewもsame build pathを使う。

Article Job pre-approval previewはprivate candidate master/variant adapterを利用するためrepository PR previewとは別workflow。

### Repository PR preview

Git treeにexport済みMedia Registryがpublic R2 object identitiesを指す。buildはbytesを取得しない。

### Article candidate preview

private candidate tree + local master/variant adapterを使い、public R2 upload前にapproval対象をrenderする。

## Build cache

CI cacheはperformance optimizationでありcorrectness SoTではない。

cache missでもsame logical outputを生成できること。

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

- same exact approved inputs -> byte-identical finalized deploy tree -> deterministic sidecar manifest / outputTreeSha256
- search index generation occurs after Astro build
- build/query tokenizer same source
- no live provider dependency during normal build
- no R2 media download
- no Cloudflare Images dependency
- deploy tree has no private/source artifacts
- operation record binds exact revision/config/lockfile to the deterministic final manifest and search index version
- deploy workflow definition is Git-controlled
- Cloudflare Dashboard build settings are not required
