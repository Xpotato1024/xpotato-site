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

public request pathは静的配信に保ち、AI authoring / media ingest / technical example verificationをauthoring planeへ分離する。

```text
                 AUTHORING / BUILD PLANE

 sources / notes / local media
             |
             v
      Article Job pipeline
      ├─ source/evidence/AI
      ├─ example verifier
      ├─ visual/master processing
      ├─ deterministic media variants
      └─ human approval
             |
      approved master+variants
             v
      public R2 publication
             |
      protected recovery copy
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
             |
      GitHub Actions + Wrangler

                 PUBLIC REQUEST PLANE

browser -> Cloudflare Workers Static Assets
             |
             +-> HTML/CSS/route-local JS/Pagefind chunks
             |
             +-> R2 prebuilt responsive media via custom domain/CDN

Cloudflare account/zone/domain/R2 config/rules/recovery policy -> Xpotato-Server
```

## Public runtime

通常ページはbuild時prerender。

production standard:

- Cloudflare Workers Static Assets
- Cloudflare edge/cache
- R2 public immutable media objects
- browser

含めない:

- Node server
- Astro SSR adapter
- application database
- CMS backend
- AI model runtime
- Article Job executor
- HEIC decoder
- media encoder
- example sandbox

## Authoring/build plane

Node.jsはbuild + authoring toolchain。

workspaces:

- `apps/site`: public site build/render
- `packages/content-contracts`: shared contracts
- `packages/article-pipeline`: AI-first authoring workflow
- `packages/media-ingest`: raw normalization + deterministic responsive variants
- `packages/example-verifier`: isolated technical example validation
- `packages/site-validators`: deterministic validation

specialized native/container dependencyをpublic site runtimeへ漏らさない。

## Architecture decisions

- SSG/prerender default
- request-time SSRなし
- database/session/server personalizationをbaselineにしない
- production targetはWorkers Static Assets
- production CI/CD authorityはGitHub Actions
- site deployはWrangler
- Cloudflare Workers Builds/Pages dashboard build configをproduction SoTにしない
- Nodeはbuild/authoring only
- photographic/raster mediaはR2-first
- responsive delivery baselineはprebuilt AVIF/WebP/fallback variants
- Cloudflare Imagesはoptional adapterのみ
- normal site buildはR2 media bytesをdownloadしない
- searchはPagefind post-build static artifact
- AI pipelineはpublic serving pathから分離

## Dynamic feature gate

request-time Worker/SSRを追加するのはstatic architectureで満たせない具体requirementが発生した場合のみ。

例:

- secretを必要とするrequest-time API
- authenticated server-side personalization
- request-time mutation/data accessがcorrectness上不可欠

material ADRでroute/runtime/security/cache/failure/costを明示する。

検索、hero生成、media変換、RSS、related contentだけを理由にdynamic runtimeを追加しない。

## Browser boundary

JavaScript opt-in。

normal content routeのnavigation/article/SEO/archive/relatedはclient runtime不要。

client runtime:

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
- small deterministic SVG/logo/favicon/icon/texture
- synthetic test fixtures

photo/screenshot/raster project visual/photographic site hero/AI raster/gallery/variantsを保存しない。

### R2 public media

owns approved immutable delivery bytes:

- normalized master
- AVIF/WebP/fallback responsive variants
- screenshot/project visual
- AI/deterministic hero
- social card
- downloadable media

physical identityはcontent-addressed key。

### Protected media copy

public delivery R2を唯一のrecovery copyにしない。

Git export前にpublished object setへdestruction-resistant protection receiptを要求する。

exact bucket/prefix/lock credential implementationは`Xpotato-Server` owner。

### Private authoring storage

owns:

- raw HEIC/original photo
- source snapshot
- Article Job artifacts
- AI raw generated image
- normalized candidate master/variants before publication
- verification logs

public R2とraw/private archiveを同一trust boundaryにしない。

## Build boundary

normal production build inputはGit revision + pinned dependency/toolchain/config。

buildで要求しない:

- AI provider availability
- R2 media download
- Cloudflare API
- web source retrieval
- private Article Job workspace

Astro output + Pagefind outputをsingle deploy artifactへまとめる。

## Deployment / Cloudflare control plane

### Site application plane

`xpotato-site`:

```text
GitHub Actions
 -> validate/build
 -> wrangler deploy
 -> Worker service
```

### Infrastructure plane

`Xpotato-Server`:

- DNS / Worker custom-domain desired state
- Cloudflare Rules desired state
- R2 resource/config desired values
- media protection policy
- provider credentials/trust boundary

OpenTofuをprovider-supported resourceの第一選択とし、provider gapはofficial API adapterで補う。

ADR-0020由来のR2 bucket configuration security boundaryに従い、高権限R2 admin credentialをCP/site CIへ常設しない。Git desired state + operator-authorized ephemeral CLI/API reconcileを許す。

Cloudflare Dashboardはbootstrap/billing/account recovery/break-glassへ限定する。

## Provider portability

Cloudflare-specific:

- Workers deploy adapter
- DNS/domain/rules resource adapter
- R2 resource/object adapter

provider-neutral:

- content/MDX
- ContentId/routes
- media master/variant hashes/manifests
- publication/protection receipts
- static site artifact semantics

Cloudflare Imagesなしでもnormal site behaviorを維持する。

## Non-goals

- framework showcase
- full SPA
- runtime Node server
- headless CMS導入自体の目的化
- media Git archive
- search server/database
- authoring AI in public request path
- Cloudflare Dashboard as configuration SoT

## Sources

external provenanceは`../references/external-sources.md`。
