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

vNextはnpm workspacesを使用し、公開site runtime、AI authoring、media ingest、technical example executionを物理的に分離する。

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
│     ├─ public/                 # control files / small passthrough only
│     └─ src/
│        ├─ assets/site/         # logo/icon/small bundled asset only
│        ├─ components/
│        │  ├─ layout/
│        │  ├─ content/
│        │  ├─ modules/
│        │  ├─ interactive/
│        │  ├─ media/
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
│        │  ├─ interactive/
│        │  ├─ provenance/
│        │  └─ discovery.ts
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
│  │     ├─ discovery/
│  │     ├─ provenance/
│  │     ├─ examples/
│  │     ├─ article-job/
│  │     └─ generated-schema/
│  ├─ article-pipeline/
│  │  └─ src/
│  │     ├─ domain/
│  │     ├─ stages/
│  │     ├─ providers/
│  │     ├─ storage/
│  │     └─ cli/
│  ├─ media-ingest/
│  │  ├─ src/
│  │  └─ toolchain/
│  ├─ example-verifier/
│  │  ├─ src/
│  │  │  ├─ extract/
│  │  │  ├─ profiles/
│  │  │  ├─ runners/
│  │  │  └─ cli/
│  │  └─ sandbox/
│  └─ site-validators/
│     └─ src/
├─ schemas/generated/
├─ tests/
│  └─ fixtures/
└─ .local/
   ├─ article-jobs/
   ├─ media-ingest/
   ├─ example-verifier/
   └─ migration/
```

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

logical rule:

- `apps/site` must not depend on `article-pipeline`
- `apps/site` must not depend on `example-verifier`
- `apps/site` must not depend on AI provider SDK
- `article-pipeline` may depend on typed interfaces / verifier adapter
- `example-verifier` may depend on `content-contracts`, not Astro runtime
- `media-ingest` may depend on shared media types, not Astro runtime
- validators are build/dev-only

architecture testでworkspace dependency boundaryを検査する。

## `apps/site`

Cloudflareへdeployされる唯一のapplication workspace。

owns:

- Astro content/pages/layouts/components
- content / taxonomy / media / interactive / provenance registries
- discovery build configuration
- media rendering adapter
- Pagefind post-build integration configuration

normal buildはR2 master bytesをdownloadしない。

## `packages/content-contracts`

Zod modelをmachine-readable SoTとする。

shared contracts:

- ContentId / frontmatter
- taxonomy
- media registry / publication
- interactive modules
- discovery
- publication provenance
- technical example records/results
- Article Job requests/responses

provider SDK / Astro component implementationを入れない。

## `packages/article-pipeline`

AI-first Article Job orchestrator。

owns:

- fixed requests / response import
- state machine
- artifact lineage
- source/evidence/author/audit/visual stages
- example verifier invocation through typed contract
- human approval lane orchestration
- approved R2 media publication
- deterministic repository export

arbitrary technical example codeを自分のprocessで実行しない。

## `packages/media-ingest`

HEIC等のlocal sourceをprivate normalized masterへ変換する。

Git / R2へ直接publishしない。

## `packages/example-verifier`

AI-authored technical exampleのdeterministic extraction / isolated validation boundary。

owns:

- code / command extraction helpers
- versioned execution profiles
- sandbox launcher
- timeout / output / resource guards
- syntax/compiler/schema adapters
- verification result generation

must not:

- mount production credentials
- write canonical site content
- deploy / publish externally
- execute arbitrary command on host as normal path

network default deny。

## `packages/site-validators`

content、ContentId、route、taxonomy、media registry、provenance、SEO、discovery、candidate export等を検査する。

network-enabled R2 availability checkはseparate entrypoint。

Pagefind Japanese query fixture validationもpost-build checkとして所有できる。

## `schemas/generated`

`content-contracts`から生成するAI exchange / tooling JSON Schema。

hand-edit禁止。generation diffをCIで検査する。

## `apps/site/public`

passthrough専用。

通常記事写真を置かない。

## Git media guard

CI:

- camera / screenshot / AI hero binary禁止
- oversized binary guard
- `.heic` / `.heif`禁止
- site-owned direct R2 URL in MDX禁止

## Generated build artifact guard

Gitへcommitしない:

- Pagefind index
- responsive media variants
- Astro `dist/`
- Article Job private artifacts
- example verifier logs

## No legacy source subtree

旧sourceをactive mainの`archive/`へ丸ごと残さない。

旧source全体はGit tag / optional legacy branchで保存する。
