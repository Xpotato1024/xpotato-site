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

vNextはnpm workspacesを使用し、公開site runtimeとauthoring toolchainを別workspaceへ分離する。

content media binaryはR2-firstで、通常写真 / screenshot / AI heroをGit treeへ持たない。

## Target layout

```text
.
├─ AGENTS.md
├─ package.json
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
├─ .agents/skills/
├─ apps/
│  └─ site/
│     ├─ astro.config.mjs
│     ├─ package.json
│     ├─ public/                 # passthrough control/small static only
│     └─ src/
│        ├─ assets/site/         # logo/icon/small bundled asset only
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
│        │  ├─ taxonomy/
│        │  ├─ media/
│        │  └─ interactive/
│        ├─ layouts/
│        ├─ lib/
│        ├─ pages/
│        └─ styles/
├─ packages/
│  ├─ content-contracts/
│  │  └─ src/
│  │     ├─ content/
│  │     ├─ taxonomy/
│  │     ├─ media/
│  │     ├─ interactive/
│  │     ├─ article-job/
│  │     └─ generated-schema/
│  ├─ article-pipeline/
│  │  └─ src/{domain,stages,providers,storage,cli}/
│  ├─ media-ingest/
│  │  ├─ src/
│  │  └─ toolchain/
│  └─ site-validators/
│     └─ src/
├─ schemas/generated/
├─ tests/fixtures/
└─ .local/
   ├─ article-jobs/
   └─ media-ingest/
```

## Dependency direction

```text
content-contracts
      ↑        ↑
      |        |
    site   article-pipeline
      ↑        ↑
      |        |
site-validators  media-ingest (only shared media contract where needed)
```

Required:

- site must not depend on article-pipeline
- site must not depend on AI provider SDK
- article-pipeline may depend on content-contracts
- media-ingest must not depend on Astro runtime
- validators are build/dev-only

## `apps/site`

Cloudflareへdeployされる唯一のapplication workspace。

content media rendererはGit binaryではなくMedia Registry + delivery profileを使用する。

normal buildはR2 master downloadを要求しない。

## `packages/content-contracts`

Zod modelをmachine-readable SoTとし、content / taxonomy / media / interactive / Article Job schemaを共有する。

provider SDK / Astro component implementationを入れない。

## `packages/article-pipeline`

AI-first Article Job orchestrator。

human approval後のmedia publication stageとrepository export stageを所有するが、credential policyそのものをSoT化しない。

## `packages/media-ingest`

HEIC等のlocal sourceをprivate normalized masterへ変換する。

Git content tree / R2へ直接publishしない。

## `packages/site-validators`

content、route、taxonomy、media registry、SEO、candidate export等を検証する。

network-enabled media availability checkもここから別entrypointで実行できる。

## `apps/site/public`

passthrough専用。

通常記事写真の置き場にしない。

## Git media guard

CIで少なくとも:

- camera / screenshot / AI hero binary path禁止
- oversized binary guard
- `.heic` / `.heif`禁止
- content media direct R2 URL scan

を実行する。

## No legacy source subtree

旧sourceをactive mainの`archive/`へ丸ごと残さない。

旧source全体はGit tag / optional legacy branchで保存する。
