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

photographic/raster mediaは用途やサイズにかかわらずR2-firstを標準とし、Git treeはsource/text/small deterministic asset中心に保つ。

2026-08-26 current inventoryでは、Project overview PNG、WordPress移行画像、site hero JPEG等のknown raster/photoだけで約4.54 MB存在する。vNextではこのgrowth patternを継承しない。

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
│        ├─ assets/site/         # small deterministic SVG/logo/icon/favicon/texture only
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

large photographic/raster visualを`assets/site`へ置かない。home/site hero photoもMedia Registryまたはsite-level media registryからR2 deliveryへ解決する。

## `packages/content-contracts`

Zod modelをmachine-readable SoTとする。

shared contracts:

- ContentId / frontmatter
- taxonomy
- media registry / rights / publication / protection
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
- infra-owned media protection operationとのtyped handoff/receipt verification
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

network-enabled R2 availability/protection checkはseparate entrypoint。

Pagefind Japanese query fixture validationもpost-build checkとして所有できる。

## `schemas/generated`

`content-contracts`から生成するAI exchange / tooling JSON Schema。

hand-edit禁止。generation diffをCIで検査する。

## `apps/site/public`

passthrough専用。

通常記事写真だけでなく、Project screenshot/overviewやphotographic site heroの置き場にも使用しない。

## Git media admission

Git binary/imageを完全禁止するのではなく、reviewabilityとgrowthで限定する。

allowed candidate:

- small deterministic SVG
- logo / favicon / icon
- tiny design-system texture
- synthetic test fixture

R2-first:

- photo
- screenshot
- raster project/content visual
- photographic/raster site hero/background
- AI-generated raster
- gallery media

exact binary-size guardはimplementation profileで持つが、threshold未満だからphotographic contentをGitへ入れてよい、というescape hatchにはしない。

## Git media guard

CI:

- camera / screenshot / photographic/raster content/site hero binary禁止
- oversized binary guard
- `.heic` / `.heif`禁止
- site-owned direct R2 URL / `r2:/` in MDX禁止
- Git-bundled raster exceptionはexplicit allowlist/fixture scopeだけ

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
