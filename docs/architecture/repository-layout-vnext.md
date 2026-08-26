---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - vNext repository layout
  - source ownership boundaries
---

# vNext Repository Layout

## Decision

vNextはnpm workspacesを使用し、公開site runtime、AI authoring、media processing、technical example executionを物理的に分離する。

photographic/raster mediaはR2-first、Git treeはsource/text/small deterministic asset中心。

production CI/CDはGitHub Actionsを正本としCloudflare Dashboard build設定をrepository外SoTにしない。

## Target layout

```text
.
├─ AGENTS.md
├─ package.json
├─ package-lock.json
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     └─ deploy-site.yml
├─ docs/
├─ .agents/skills/
├─ apps/
│  └─ site/
│     ├─ astro.config.mjs
│     ├─ wrangler.jsonc
│     ├─ package.json
│     ├─ public/                 # control files / small passthrough only
│     └─ src/
│        ├─ assets/site/         # small deterministic SVG/logo/icon/favicon/texture only
│        ├─ components/
│        ├─ content/
│        │  ├─ blog/
│        │  ├─ notes/
│        │  ├─ projects/
│        │  ├─ tools/
│        │  └─ pages/
│        ├─ content-registry/
│        │  ├─ taxonomy/
│        │  ├─ media/
│        │  ├─ interactive/
│        │  ├─ provenance/
│        │  └─ discovery.ts
│        ├─ search/
│        │  ├─ tokenizer.ts
│        │  ├─ build-index.ts
│        │  └─ client.ts
│        ├─ layouts/
│        ├─ lib/
│        ├─ pages/
│        └─ styles/
├─ packages/
│  ├─ content-contracts/
│  ├─ article-pipeline/
│  ├─ media-ingest/
│  │  ├─ src/ingest/
│  │  ├─ src/variants/
│  │  ├─ src/profiles/
│  │  └─ toolchain/
│  ├─ example-verifier/
│  │  ├─ src/extract/
│  │  ├─ src/profiles/
│  │  ├─ src/runners/
│  │  └─ sandbox/
│  └─ site-validators/
├─ schemas/generated/
├─ tests/fixtures/
└─ .local/
   ├─ article-jobs/
   ├─ media-ingest/
   ├─ example-verifier/
   └─ migration/
```

## GitHub Actions ownership

### `ci.yml`

- npm ci
- schema freshness
- contract/unit tests
- content/taxonomy/media validation
- Astro check/build
- MiniSearch serialized index build + Japanese regression tests
- no Cloudflare credential required

### `deploy-site.yml`

- exact reviewed revision
- deterministic validation/build
- scoped Worker deploy credential
- `wrangler deploy`
- production smoke

Cloudflare Workers Buildsを第二deploy pathとして有効化しない。

## Dependency direction

```text
                     content-contracts
             ┌────────────┼──────────────┐
             │            │              │
             v            v              v
           site     article-pipeline  example-verifier
             ^            │
             │            └────> media-ingest
             │
      site-validators
```

rules:

- `apps/site` -> `article-pipeline`禁止
- `apps/site` -> `example-verifier`禁止
- `apps/site` -> AI provider SDK禁止
- `example-verifier` -> Astro runtime禁止
- `media-ingest` -> Astro runtime禁止
- validatorsはbuild/dev-only

## `apps/site`

Cloudflareへdeployされる唯一のapplication workspace。

owns:

- Astro content/pages/layouts/components
- taxonomy/media/interactive/provenance registries
- discovery config
- `xpotato-ja-tech-bigram-v1` shared search tokenizer + MiniSearch build/client adapter
- media rendering adapter
- application-local Wrangler static-assets config

normal buildはR2 source/public/protected bytesをdownloadしない。

### Wrangler boundary

`wrangler.jsonc` owns application/static-assets config only。

DNS、production hostname binding、R2 bucket/custom-domain、provider rulesは`Xpotato-Server` owner。

## `packages/content-contracts`

Zod modelをmachine-readable SoTとする。

shared:

- ContentId/frontmatter/taxonomy
- media source/registry/rights/variants/publication/protection
- interactive/discovery/provenance/examples/Article Job

provider SDK / Astro implementationを入れない。

## `packages/article-pipeline`

owns:

- semantic request/import/state/artifact lineage
- source/evidence/author/audit/visual stages
- example verifier/media processing invocation
- human approval lane
- private canonical source storage receipt integration
- public media publication
- protected media handoff/receipt
- deterministic repository export

arbitrary example codeを自processで実行しない。

## `packages/media-ingest`

### ingest

HEIC等をprivacy-normalized lossless canonical masterへ変換。

### variants

canonical masterからprovider-independent AVIF/WebP/fallback variantsを生成。

local processing stage自体はGit/R2へpublishしない。

## `packages/example-verifier`

`operations/technical-example-profiles.md`のsmall isolated profilesだけを実装する。

must not:

- mount production credentials
- write canonical site content
- deploy/publish externally
- execute arbitrary command on host

network default deny。

## `packages/site-validators`

content/route/taxonomy/media/provenance/SEO/discovery/search/candidate exportを検査。

remote R2/Cloudflare checkはseparate entrypoint。

## `apps/site/public`

passthrough専用。記事写真、Project screenshot、photographic site heroを置かない。

## Git media admission

allowed candidate:

- small deterministic SVG
- logo/favicon/icon
- tiny design-system texture
- synthetic fixture

R2-first:

- photo
- screenshot
- raster project/content visual
- photographic/raster site hero/background
- AI-generated raster
- gallery media

## Generated artifact guard

Gitへcommitしない:

- MiniSearch serialized index
- responsive media variants
- private canonical masters
- Astro `dist/`
- Article Job private artifacts
- example verifier logs

## External media planes

Git does not store provider IDs, but architecture expects:

1. private canonical source-media object storage
2. public delivery media object storage
3. private protected exact-byte recovery storage

provider resource names/config are `Xpotato-Server` SoT。

## Cloudflare dashboard boundary

`../operations/cloudflare-control-plane-policy.md`に従いnormal deploy/configurationでDashboard操作を要求しない。

## No legacy source subtree

旧source全体はGit tag / optional legacy branchで保存し、active mainへ`archive/old-src`を置かない。
