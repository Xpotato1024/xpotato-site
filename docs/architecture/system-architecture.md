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

public request pathは静的配信に保ち、AI authoring / media processing / technical example verificationをauthoring planeへ分離する。

```text
                 AUTHORING / BUILD PLANE

 sources / notes / raw local media
             |
             v
      Article Job pipeline
      ├─ source/evidence/AI
      ├─ example verifier
      ├─ privacy-normalized canonical media
      ├─ visual audit
      ├─ deterministic delivery variants
      └─ human approval
             |
             +-> private canonical source-media R2
             |
             +-> public delivery R2 master+variants
             |      |
             |      +-> private protected exact-byte copy
             |
       registry/provenance
             v
        Git vNext content
             |
             v
       Node 24 toolchain
      Astro -> MiniSearch serialized index
             |
             v
       static deploy artifact
             |
      GitHub Actions + Wrangler

                 PUBLIC REQUEST PLANE

browser -> Cloudflare Workers Static Assets
             |
             +-> HTML/CSS/route-local JS
             |
             +-> /search/ MiniSearch runtime + static index
             |
             +-> R2 prebuilt responsive media via custom domain/CDN

Cloudflare account/zone/domain/R2 resources/rules -> Xpotato-Server
```

## Public runtime

production standard:

- Cloudflare Workers Static Assets
- Cloudflare edge/cache
- R2 public immutable delivery media
- browser

含めない:

- Node server
- Astro SSR adapter
- application database
- CMS backend
- AI model runtime
- Article Job executor
- HEIC decoder/media encoder
- example sandbox
- search server/database

## Authoring/build plane

workspaces:

- `apps/site`: Astro + static search build/render
- `packages/content-contracts`: shared contracts
- `packages/article-pipeline`: AI-first authoring workflow
- `packages/media-ingest`: raw normalization + deterministic variants
- `packages/example-verifier`: isolated technical validation
- `packages/site-validators`: deterministic validation

specialized dependencyをpublic request pathへ漏らさない。

## Architecture decisions

- SSG/prerender default
- request-time SSRなし
- database/session/server personalization baselineなし
- production target = Workers Static Assets
- production CI/CD = GitHub Actions
- deploy = Wrangler
- Workers Builds/Pages dashboard configをproduction SoTにしない
- Node = build/authoring only
- photographic/raster media = R2-first
- raw camera original = site long-term storage非対象
- privacy-normalized lossless canonical source = private source-media plane
- public delivery = deterministic prebuilt master + AVIF/WebP/fallback variants
- exact public bytes = separate protected recovery plane
- Cloudflare Images = optional only
- normal site buildはR2 media bytesをdownloadしない
- static search = MiniSearch + same deterministic Japanese/technical tokenizer
- AI pipeline = public serving path外

## Dynamic feature gate

request-time Worker/SSRを追加するのはstatic architectureで満たせない具体requirementが発生した場合のみ。

検索、hero生成、media変換、RSS、related contentだけを理由にdynamic runtimeを追加しない。

## Browser boundary

JavaScript opt-in。

normal content routeのnavigation/article/SEO/archive/relatedはclient runtime不要。

client runtime:

- Tool React island: route-local
- Demo: module-local
- `/search/`: MiniSearch + vanilla TS route-local runtime

site-wide SPAにしない。

## Storage / asset boundary

### Git

owns:

- MDX/frontmatter
- taxonomy/media/interactive/provenance registry
- canonical source hash/profile metadata but not source bytes
- code/config/docs/Skills/contracts
- small deterministic SVG/logo/favicon/icon/texture
- synthetic fixtures

### Private canonical source-media R2

owns approved privacy-normalized re-encoding source:

- lossless WebP canonical raster
- sanitized SVG canonical source

no public domain。raw HEIC/JPEG/PNG originalをそのまま保存しない。

### Public R2

owns approved immutable delivery bytes:

- public delivery master
- responsive AVIF/WebP/fallback variants
- screenshot/project visual
- hero/social card/download

physical identityはcontent-addressed key。

### Protected-media R2

owns exact public delivery object setのrecovery copy。

initially private + indefinite Bucket Lock + no automatic expiration。

### Raw/job-local storage

owns:

- input HEIC/original photo
- source snapshots
- Article Job artifacts
- AI raw output
- verification logs

human-approved canonical source storage/publication/protection完了後はjob retention policyに従ってcleanup可能。

## Build boundary

normal production build input = Git revision + pinned toolchain/config。

buildで要求しない:

- AI provider
- any R2 media download
- Cloudflare API
- external web retrieval
- private Article Job workspace

Astro output + MiniSearch serialized indexをsingle atomic deploy artifactへまとめる。

## Deployment / Cloudflare control plane

### Site application plane

```text
GitHub Actions
 -> validate/build
 -> wrangler deploy
 -> Worker service
```

### Infrastructure plane

`Xpotato-Server` owns:

- DNS / Worker custom-domain
- provider Rules
- private source/public/protected R2 resources
- media credential boundaries
- protected-media lock/recovery

OpenTofu first where compatible。provider gapはofficial API adapter。

R2 configuration admin credentialはCP/site CIへ常設せずoperator-authorized ephemeral mutationを使う。

Cloudflare Dashboardはbootstrap/billing/recovery/break-glassへ限定する。

## Provider portability

Cloudflare-specific:

- Workers deploy
- DNS/domain/rules
- R2 resource/object adapter

provider-neutral:

- content/MDX
- ContentId/routes
- canonical source/delivery variant hashes
- media publication/storage/protection receipt semantics
- static search tokenizer/index source semantics
- static site artifact semantics

## Non-goals

- framework showcase/full SPA/runtime Node server
- headless CMS導入自体の目的化
- media Git archive
- raw personal photo archive
- search server/database
- authoring AI in public request path
- Cloudflare Dashboard as configuration SoT

## Sources

external provenanceは`../references/external-sources.md`。
