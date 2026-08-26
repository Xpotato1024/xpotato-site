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

vNextはnpm workspacesを使用し、public site、AI authoring、media processing、technical-example executionを物理分離する。

Photographic/raster mediaはobject-storage first。Gitはsource/text/registry/small deterministic assets中心。

Production CI/CDはGitHub Actionsを正本とし、Cloudflare Dashboard build configをrepository外SoTにしない。

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
│  ├─ README.md
│  ├─ product/
│  ├─ architecture/
│  ├─ contracts/
│  ├─ content/
│  ├─ operations/
│  ├─ governance/
│  │  ├─ audit.md
│  │  └─ severity.md
│  ├─ design/
│  │  ├─ adr/
│  │  └─ open-decisions.md
│  ├─ audits/                 # exact-revision historical reports, non-authoritative
│  ├─ migration/
│  ├─ references/
│  └─ legacy/
├─ .agents/skills/
├─ apps/
│  └─ site/
│     ├─ astro.config.mjs
│     ├─ wrangler.jsonc
│     ├─ package.json
│     ├─ public/              # control files / small passthrough only
│     └─ src/
│        ├─ assets/site/      # small deterministic SVG/logo/icon/favicon/texture only
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
│  ├─ example-verifier/
│  └─ site-validators/
├─ schemas/generated/
├─ tests/fixtures/
└─ .local/
   ├─ article-jobs/
   ├─ media-ingest/
   ├─ example-verifier/
   └─ migration/
```

## Documentation/governance boundary

- `architecture/design-status.md`: lifecycle authority
- `architecture/infrastructure-handoff.md`: exact cross-repo provider revision binding
- `governance/audit.md`: clean-room procedure
- `governance/severity.md`: P0/P1/P2
- `audits/`: historical audit reports only, not SoT

Agent/code must not infer lifecycle from branch/file existence。

## GitHub Actions ownership

### `ci.yml`

- npm ci
- schema freshness
- contract/unit tests
- content/taxonomy/media/provenance validation
- Astro check/build
- MiniSearch serialized index + Japanese/technical regression tests
- no Cloudflare credential

### `deploy-site.yml`

Only after lifecycle/implementation gate opens:

- exact reviewed revision
- deterministic validation/build
- scoped Worker deploy credential
- `wrangler deploy`
- smoke

No Cloudflare Workers Builds second path。

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

Rules:

- site -> article-pipeline/example-verifier/provider SDK prohibited
- example-verifier/media-ingest -> Astro runtime prohibited
- validators build/dev-only

## `apps/site`

Only deployed application workspace after implementation acceptance。

Owns:

- Astro content/pages/layout/components
- taxonomy/media/interactive/provenance registries
- discovery config
- shared MiniSearch tokenizer/build/client adapter
- media rendering adapter
- application-local Wrangler config

Normal build does not download source/public/protected media bytes。

### Wrangler boundary

Owns Worker/static-assets application config only。

DNS, production hostname, R2 actual resources/custom domain/provider rules are infra-owned and status is read through `architecture/infrastructure-handoff.md`。

## `packages/content-contracts`

Implementation-stage Zod machine SoT for:

- ContentId/frontmatter/taxonomy
- source/evidence/claim + durable compact provenance
- media source/registry/rights/variants/publication/protection/recovery
- interactive/discovery/examples/Article Job

No provider SDK/Astro implementation。

## `packages/article-pipeline`

Owns:

- semantic exchange/import/state/artifact lineage
- source/evidence/author/audit/visual stages
- verifier/media invocation
- human approval plumbing
- source/public/protected persistence handoffs
- durable compact claim/recovery provenance export
- explicit cleanup eligibility

Does not run arbitrary technical commands in own process。

## `packages/media-ingest`

- HEIC/etc -> privacy-normalized canonical master
- canonical -> deterministic delivery variants
- no direct Git/R2 publication in processing stage

## `packages/example-verifier`

Only bounded profiles from `operations/technical-example-profiles.md`。

Must not mount production credentials, mutate canonical site, deploy externally, or execute arbitrary host commands。Network default deny。

## `packages/site-validators`

Validates content/routes/taxonomy/media/provenance/SEO/discovery/search/export/cleanup-safe lineage。

Provider/R2 availability/drift is separate external entrypoint。

## `apps/site/public`

Passthrough only. No article/project/screenshot/photographic site hero storage。

## Git media admission

Allowed candidates:

- small deterministic SVG
- logo/favicon/icon
- tiny design texture
- synthetic fixture

Object-storage first:

- photo
- screenshot
- raster content/project visual
- photographic/raster site hero/background
- AI raster
- gallery media

## Generated artifact guard

Do not commit:

- MiniSearch serialized index
- delivery variants/canonical media bytes
- Astro dist
- private Article Job artifacts
- verifier logs

## External media planes

Target semantics expect:

1. private canonical source-media
2. public delivery media
3. private exact-byte protected recovery

Actual provider resources are not site SoT and remain Proposed/blocked until exact infra handoff is accepted。

## Legacy

Old full source is preserved by Git tag/optional legacy branch, not active `archive/old-src`。
