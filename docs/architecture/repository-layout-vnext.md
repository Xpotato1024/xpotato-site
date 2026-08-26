---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - vNext repository layout
  - source ownership boundaries
---

# vNext Repository Layout

## Goal

旧実装のdirectory structureを継承条件にせず、product / content / pipeline / website runtimeの責務からactive treeを組み直す。

## Target layout

```text
.
├─ AGENTS.md
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
├─ src/
│  ├─ assets/
│  │  └─ content/
│  ├─ components/
│  │  ├─ layout/
│  │  ├─ content/
│  │  ├─ modules/
│  │  ├─ interactive/
│  │  └─ seo/
│  ├─ content/
│  │  ├─ blog/
│  │  ├─ notes/
│  │  ├─ projects/
│  │  ├─ tools/
│  │  └─ pages/
│  ├─ content-registry/
│  │  ├─ categories.ts
│  │  ├─ tags.ts
│  │  ├─ series.ts
│  │  └─ modules.ts
│  ├─ layouts/
│  ├─ lib/
│  │  ├─ content/
│  │  ├─ media/
│  │  ├─ seo/
│  │  └─ routing/
│  ├─ pages/
│  └─ styles/
├─ tools/
│  ├─ article-pipeline/
│  ├─ media-ingest/
│  └─ validators/
├─ schemas/
│  └─ generated/
├─ tests/
│  ├─ content/
│  ├─ contracts/
│  ├─ pipeline/
│  ├─ rendering/
│  └─ fixtures/
├─ public/
│  ├─ favicon...
│  ├─ robots.txt or generated control assets
│  └─ passthrough-only assets
└─ .local/                 # gitignored Article Job workspace
```

## `src/components/`

### layout

site shell、header、footer、navigation、container。

### content

article list、metadata、archive UI等。

### modules

stable MDX module API。content sourceから直接importされるpublic authoring surface。

### interactive

React island等のbrowser stateful UI。

### seo

head metadata / structured data / social metadata generation。

## `src/lib/`

componentではないpure / framework-adjacent logic。

巨大な`utils.ts`へ集約しない。

## `tools/`

site runtimeから独立したauthoring / validation tool。

Article pipelineはAstro route runtimeからimportしない。

## `schemas/generated/`

Zod等machine-readable modelから生成するprovider exchange JSON Schema。

hand-edit禁止。

## `public/`

passthrough専用。

通常記事画像の置き場にしない。

## No legacy source subtree in active main

旧`src/`を`archive/src-old/`へ丸ごと移して残さない。

active tree内に旧framework dependency / path / configが存在するとagent・IDE・grep・dependency update・build inspectionで混乱を生むためである。

旧source全体はGit tag / legacy branchで保存する。
