---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - system architecture
  - runtime boundary
---

# System Architecture

## Target

`xpotato-site`はAI-assisted technical publishing platform + static-first public site。

public request pathは静的配信に保ち、AI authoring / media ingest / technical example verificationをoffline/authoring planeへ分離する。

```text
                 AUTHORING / BUILD PLANE

  sources / notes / local media
             |
             v
      Article Job pipeline
      ├─ evidence / AI stages
      ├─ example verifier
      ├─ visual pipeline
      └─ human approval
             |
       approved media
             v
     Cloudflare R2 media
             |
       registry/provenance
             v
        Git vNext content
             |
             v
       Node 24 toolchain
      Astro -> Pagefind
             |
             v
       static deploy artifact

                 PUBLIC REQUEST PLANE

browser -> Cloudflare Workers Static Assets
             |
             +-> HTML/CSS/route-local JS/Pagefind chunks
             |
             +-> R2 media via custom domain / transforms

shared Cloudflare/DNS/backup state -> Xpotato-Server
```

## Public runtime

通常ページはbuild時prerender。

production public runtime standard:

- Cloudflare Workers Static Assets
- Cloudflare cache/edge
- R2 public media
- browser

含めない:

- Node server
- Astro SSR adapter
- application database
- CMS backend
- AI model runtime
- Article Job executor
- HEIC decoder
- example sandbox

## Authoring/build plane

Node.jsはproduction serverではないが、vNextではbuild + authoring toolchainとして使用する。

workspaces:

- `apps/site`: public site build/render
- `packages/content-contracts`: shared typed contracts
- `packages/article-pipeline`: AI-first authoring workflow
- `packages/media-ingest`: local/raw media normalization
- `packages/example-verifier`: isolated technical example validation
- `packages/site-validators`: deterministic validation

specialized native/container dependencyをpublic siteへ漏らさない。

## Architecture decisions

- SSG/prerender default
- request-time SSRなし
- database/session/server personalizationをbaselineにしない
- production targetはWorkers Static Assetsへ一本化
- Nodeはbuild/authoring only, public server runtimeではない
- content mediaはR2-first
- normal site buildはR2 master byteをdownloadしない
- searchはPagefind post-build static artifact
- AI pipelineはpublic serving pathから分離

## Dynamic feature gate

request-time Worker/SSRを追加するのは、static architectureで満たせない具体requirementが発生した場合のみ。

例:

- secretを必要とするrequest-time API
- authenticated server-side personalization
- request-time mutation/data accessがcorrectness上不可欠

material ADRでroute/runtime/security/cache/failure/costを明示する。

検索、hero生成、RSS、related contentだけを理由にdynamic runtimeを追加しない。

## Browser boundary

JavaScript opt-in。

normal content route:

- navigation
- article rendering
- SEO
- archive
- related content

はclient runtime不要。

client runtime examples:

- Tool React island: route-local
- Demo: module-local
- `/search/`: Pagefind runtime

site-wide SPAにしない。

## Storage / asset boundary

### Git

owns:

- MDX/frontmatter
- taxonomy/media/interactive/provenance registry
- code/config/docs/Skills/contracts
- favicon/logo/small UI icon/textual SVG
- small synthetic test fixtures

normal article photo/screenshot/AI hero/gallery binaryを保存しない。

### R2 public media

owns normalized published content media bytes:

- camera photo
- screenshot
- generated hero
- diagram raster/vector where treated as content media
- social card
- large/download media

objectはcontent-addressed immutable key。

### Private authoring storage

owns:

- raw HEIC/original photo
- private source snapshot
- Article Job artifacts
- AI raw generated image
- verification logs

public R2とraw/private archiveを同一trust boundaryにしない。

### Recovery

public R2は唯一のrecovery authorityではない。

published media exact-byte protection requirementはsite contract、backup implementationは`Xpotato-Server` owner。

## Build boundary

normal production build inputはGit revision + pinned dependency/toolchain/config。

buildで要求しない:

- AI provider availability
- R2 object download
- Cloudflare API
- web source retrieval
- private Article Job workspace

Astro output + Pagefind outputをsingle deploy artifactへまとめる。

## Infrastructure boundary

`xpotato-site` owns:

- application/content semantics
- ContentId/route
- logical media/object-key semantics
- build/deploy artifact requirements
- public media publication manifest
- recovery requirement

`Xpotato-Server` owns:

- Cloudflare account/zone/DNS
- R2 bucket/provider state
- custom domain/cache/compression
- infrastructure credentials
- protected backup/recovery implementation
- provider-level redirect

provider IDsをsite docsへsecond SoTとして固定しない。

## Non-goals

- framework showcase
- full SPA
- runtime Node server
- headless CMS導入自体の目的化
- content image Git archive
- searchのためのserver/database
- authoring AIをproduction request pathへ置く

## Sources

external provenanceは`../references/external-sources.md`。
