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

vNext uses npm workspaces to separate public site, AI authoring, media processing, and technical-example execution。

Photographic/raster media is object-storage first。Git remains source/text/contracts/registries/small deterministic assets centered。

Production CI/CD is GitHub Actions; Cloudflare Dashboard build configuration is not a second SoT。

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
│  │  └─ external-ai-disclosure-profile.md
│  ├─ governance/
│  ├─ design/adr/
│  ├─ audits/
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
│  │  └─ src/profiles/
│  │     └─ external-ai-disclosure-v1.ts
│  ├─ article-pipeline/
│  │  └─ src/
│  │     ├─ disclosure/
│  │     ├─ semantic/
│  │     ├─ state/
│  │     └─ persistence/
│  ├─ media-ingest/
│  ├─ example-verifier/
│  └─ site-validators/
├─ schemas/generated/
├─ tests/fixtures/
└─ .local/
   ├─ article-jobs/
   │  └─ <job-id>/
   │     └─ disclosure/
   │        ├─ records/
   │        ├─ derived/
   │        └─ manifests/
   ├─ media-ingest/
   ├─ example-verifier/
   └─ migration/
```

Subdirectory names inside implementation workspaces are candidate organization and may be refined without changing the ownership boundary。The material boundary is the workspace/capability direction, not a particular internal file name except where a profile/contract explicitly declares machine SoT target。

## Documentation/governance boundary

- `architecture/design-status.md`: lifecycle authority
- `architecture/infrastructure-handoff.md`: exact cross-repo provider revision binding
- `governance/audit.md`: clean-room procedure
- `governance/severity.md`: P0/P1/P2
- `audits/`: historical reports only

Agent/code must not infer lifecycle from branch/file existence。

## GitHub Actions ownership

### `ci.yml`

- npm ci
- schema/profile freshness
- contract/unit tests
- ContentId/taxonomy/media/provenance validation
- external-AI disclosure default-deny/hard-deny/exact-set fixtures
- Astro check/build
- MiniSearch serialized index + Japanese/technical regression tests
- no Cloudflare credential

### `deploy-site.yml`

Only after lifecycle/implementation gate opens:

- exact reviewed revision
- deterministic validation/build
- scoped Worker deploy credential
- Wrangler deploy
- production smoke

No Cloudflare Workers Builds second authority。

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
- content-contracts -> provider SDK/Astro/sandbox runtime prohibited
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

Normal build does not download source/public/protected media bytes or private Article Job/disclosure artifacts。

### Wrangler boundary

Owns Worker/static-assets application config only。

DNS, production hostname, R2 resources/custom domain/provider rules are infra-owned and status is read through `architecture/infrastructure-handoff.md`。

## `packages/content-contracts`

Implementation-stage Zod/config machine SoT for:

- ContentId/frontmatter/taxonomy
- portable content/module/interactive contracts
- source/evidence/claim
- ExternalAiDisclosureRecord / ExternalAiDisclosureManifest
- initial disclosure profile machine representation
- media source/registry/rights/variants/publication/protection/recovery
- durable Publication Provenance
- technical examples / Article Job schemas

No provider SDK/Astro implementation。

## `packages/article-pipeline`

Owns deterministic authoring control plane:

- ArticleJobSpec/fingerprint/state/artifact lineage
- source discovery handoff + deterministic pinning
- disclosure policy application / explicit authorization normalization
- local derived-only artifact production orchestration
- exact request disclosure-manifest compilation and final outbound-set validation
- semantic provider request/import adapters
- evidence/author/audit/visual stages
- verifier/media invocation
- human approval plumbing
- source/public/protected persistence handoffs
- durable compact claim/disclosure/recovery provenance export
- explicit cleanup eligibility

It does **not** let a semantic Skill/provider self-authorize input disclosure or append hidden external context after manifest compilation。

It does not execute arbitrary technical commands in its own process。

## `packages/media-ingest`

- HEIC/etc -> privacy-normalized canonical master
- canonical -> deterministic delivery variants
- local redaction/metadata-safe image derivative capability may be reused by an external-disclosure derived-only workflow through a typed boundary
- no direct Git/R2 publication in processing stage

## `packages/example-verifier`

Only bounded profiles from `operations/technical-example-profiles.md`。

Must not mount production credentials, mutate canonical site, deploy externally, or execute arbitrary host commands。Network default deny。

## `packages/site-validators`

Validates:

- content/routes/taxonomy/modules/media/provenance/SEO/discovery/search
- Article Job exported state and cleanup-safe lineage
- disclosure profile/schema freshness
- disclosure default-deny/hard-deny/manifest exact-set fixtures

Provider/R2 availability/drift is a separate external entrypoint。

## `apps/site/public`

Passthrough/control assets only。No article/project/screenshot/photographic site hero storage。

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

## Private generated/job artifact guard

Do not commit:

- MiniSearch serialized index
- delivery variants/canonical media bytes
- Astro dist
- private Article Job source/evidence/disclosure/request/response artifacts
- verifier logs

Publication Provenance contains only safe compact lineage, not the private job workspace copy。

## External media planes

Target semantics expect:

1. private canonical source-media
2. public delivery media
3. private exact-byte protected recovery

Actual provider resources are not site SoT and remain Proposed/blocked until exact infra handoff is accepted。

## Legacy

Old full source is preserved by Git tag/optional legacy branch, not active `archive/old-src`。
