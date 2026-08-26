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

vNextはnpm workspacesを使用し、公開site runtime、authoring toolchain、media ingestを分離する。

**article media binaryはrepository treeの通常contentとして保持しない。**

## Target layout

```text
.
├─ AGENTS.md
├─ package.json
├─ package-lock.json
├─ docs/
├─ .agents/
├─ apps/
│  └─ site/
│     ├─ astro.config.mjs
│     ├─ package.json
│     ├─ public/                # favicon / control files等のsmall passthrough only
│     └─ src/
│        ├─ assets/             # small site-owned design assets only
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
│        │  └─ media-assets/    # text records; binaryなし
│        ├─ layouts/
│        ├─ lib/
│        ├─ pages/
│        └─ styles/
├─ packages/
│  ├─ content-contracts/
│  ├─ article-pipeline/
│  ├─ media-ingest/
│  └─ site-validators/
├─ schemas/
│  └─ generated/
├─ tests/
│  └─ fixtures/                 # deliberately small synthetic fixtures only
└─ .local/                      # gitignored Article Job / raw media workspace
```

## External media plane

```text
private raw archive
  - original HEIC/JPEG/generated raw
  - not Git
  - not public asset domain

R2 public media
  - normalized immutable web masters
  - optional pregenerated variants

Git
  - MDX
  - Media Asset Registry
  - provenance refs / hashes / dimensions
  - small design assets / SVG / fixtures
```

## Workspace dependency rules

- `apps/site` must not depend on `article-pipeline`.
- `apps/site` must not depend on AI provider SDKs.
- `article-pipeline` may depend on `content-contracts`.
- `media-ingest` must not import Astro runtime.
- `site-validators` is not runtime dependency.

## `apps/site`

Cloudflareへdeployされる唯一のapplication workspace。

記事mediaをbundleする役割ではなく、registryからremote delivery URLを生成する。

## `packages/content-contracts`

content / taxonomy / Article Job / visual / media registry schemaのmachine-readable SoT。

## `packages/article-pipeline`

AI-first Article Job orchestrator。

## `packages/media-ingest`

HEIC等をdecode / normalizeし、R2 masterをpublishしてregistry proposalを生成するdeterministic toolchain。

R2 mutationはexplicit permission boundaryとする。

## `packages/site-validators`

content、route、taxonomy、media registry、remote object、SEO等を検証する。

## What may remain in Git as image-like files

allowed examples:

- favicon
- logo
- small UI icon
- small source-controlled SVG
- tiny deterministic test fixture

not standard:

- article photos
- screenshots
- AI-generated hero
- galleries
- generated responsive variants

size / path guardをCIで持つ。

## `apps/site/public`

passthrough専用。通常記事画像の置き場にしない。

## No Git LFS baseline

Git LFSを標準media planeにしない。

LFSはbinaryをGit workflowと一緒にversioningする要件が生じた場合だけ別途評価する。

## No legacy source subtree

旧sourceを`archive/src-old/`へ丸ごと残さず、Git tag / historyへ保存する。
