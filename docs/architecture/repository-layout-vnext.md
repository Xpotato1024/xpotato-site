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

vNextはnpm workspacesを使用し、**公開site runtimeとauthoring toolchainを別workspaceへ分離**する。

Article JobがVEP型のdomain / schema / provider / storageを持つため、単一Astro packageの`tools/`へ巨大化させない。

## Target layout

```text
.
├─ AGENTS.md
├─ package.json                 # workspace root / orchestration only
├─ package-lock.json
├─ docs/
│  ├─ product/
│  ├─ architecture/
│  ├─ contracts/
│  ├─ content/
│  ├─ operations/
│  ├─ design/adr/
│  ├─ migration/
│  ├─ references/
│  └─ legacy/
├─ .agents/
│  └─ skills/
├─ apps/
│  └─ site/
│     ├─ astro.config.mjs
│     ├─ package.json
│     ├─ public/
│     └─ src/
│        ├─ assets/content/
│        ├─ components/
│        │  ├─ layout/
│        │  ├─ content/
│        │  ├─ modules/
│        │  ├─ interactive/
│        │  └─ seo/
│        ├─ content/
│        │  ├─ blog/
│        │  ├─ notes/
│        │  ├─ projects/
│        │  ├─ tools/
│        │  └─ pages/
│        ├─ content-registry/
│        ├─ layouts/
│        ├─ lib/
│        ├─ pages/
│        └─ styles/
├─ packages/
│  ├─ content-contracts/
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ content/
│  │     ├─ taxonomy/
│  │     ├─ article-job/
│  │     ├─ visual/
│  │     └─ generated-schema/
│  ├─ article-pipeline/
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ domain/
│  │     ├─ stages/
│  │     ├─ providers/
│  │     ├─ storage/
│  │     └─ cli/
│  ├─ media-ingest/
│  │  ├─ package.json
│  │  ├─ src/
│  │  └─ toolchain/
│  └─ site-validators/
│     ├─ package.json
│     └─ src/
├─ schemas/
│  └─ generated/                # AI exchange/exported JSON Schema; hand-edit禁止
├─ tests/
│  └─ fixtures/                 # cross-workspace fixtures only
└─ .local/                      # gitignored Article Job workspace
```

## Workspace dependency direction

```text
content-contracts
      ↑        ↑
      |        |
    site   article-pipeline
      ↑        ↑
      |        |
site-validators media-ingest?   # only where semantic contracts needed
```

Required rules:

- `apps/site` must not depend on `article-pipeline`.
- `apps/site` must not depend on provider SDKs used only for AI generation.
- `article-pipeline` may depend on `content-contracts`.
- `media-ingest` may share artifact types but must not import Astro runtime.
- `site-validators` may read generated site/content artifacts but must not become runtime dependency.

architecture tests / package boundary checksでこれを検証する。

## Root package

root `package.json` はworkspace orchestrationだけを所有する。

例:

- `check`
- `test`
- `build:site`
- `validate`
- `article`
- `media`

individual implementation commandはworkspace package側をSoTとする。

## `apps/site`

Cloudflareへdeployされる唯一のapplication workspace。

Cloudflare buildは原則このworkspaceだけをproduction artifact generation対象とする。

## `packages/content-contracts`

siteとArticle Jobが共有する唯一のcontent / taxonomy / job / visual schema package。

Zod modelをmachine-readable SoTとし、AI exchange用JSON Schemaを生成する。

provider SDKやAstro component implementationをここへ入れない。

## `packages/article-pipeline`

AI-first Article Jobのorchestrator。

Astro page runtimeからimportしない。

## `packages/media-ingest`

HEIC等を含むlocal author mediaのdeterministic normalization。

native dependency / container / toolchain pinをこのboundaryへ閉じ込める。

## `packages/site-validators`

content、route、taxonomy、asset、SEO、Article candidate export等のdeterministic validator。

## `schemas/generated`

`content-contracts`等から生成したJSON Schemaのexport surface。

hand-edit禁止。generation diffをCIで検査する。

## `apps/site/public`

passthrough専用。

通常記事画像の置き場にしない。

## No legacy source subtree in active main

旧sourceを`archive/src-old/`へ丸ごと移して残さない。

active tree内に旧framework dependency / path / configが存在するとagent・IDE・grep・dependency update・build inspectionで混乱を生むためである。

旧source全体はGit tag / optional legacy branchで保存する。
