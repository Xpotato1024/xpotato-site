---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0013: npm workspacesでpublic siteとauthoring/execution toolchainを分離する

## Context

vNext includes:

- Astro public site
- shared content/contracts
- AI Article Job/provider adapters
- HEIC/media processing
- technical-example isolated verification
- schema/registry/site validators

Putting all of these into one Astro package `src/ + tools/` would make production/runtime, AI/provider, native media, and code-execution boundaries depend on convention only。

Moving them to completely separate repositories would make shared contract/migration versioning unnecessarily difficult。

## Decision

Use one repository + npm workspaces with explicit dependency boundaries。

Initial workspaces:

- `apps/site`: public static site build/render only
- `packages/content-contracts`: provider/framework-neutral shared schema/contracts
- `packages/article-pipeline`: AI-first Article Job orchestration/provider adapters
- `packages/media-ingest`: private canonical media normalization + deterministic delivery variants
- `packages/example-verifier`: isolated technical example extraction/validation/execution boundary
- `packages/site-validators`: deterministic repository/candidate/build validation

Dependency/security direction:

- `apps/site` must not depend on article-pipeline/example-verifier/provider SDK
- `content-contracts` must not depend on Astro/provider SDK/sandbox runtime
- `article-pipeline` may invoke media/verifier through typed boundaries
- `example-verifier` owns bounded execution and must not gain production/provider credentials
- `media-ingest` owns native media toolchain and does not depend on Astro runtime
- only `apps/site` becomes public deploy application artifact

## Alternatives

### Single package `src/ + tools/`

Simpler at first but weak import/dependency/capability separation, especially once AI provider/native decoder/example execution are present。

### Separate repositories

Strong runtime separation, but coordinated ContentId/media/provenance/schema/migration contract changes become operationally heavier than needed at current scale。

### Put example execution inside Article pipeline process

Rejected。AI-authored command execution is a security boundary, not an ordinary helper。It requires separate sandbox/runtime profiles and dependency direction。

## Consequences

Positive:

- production site dependency graph remains small
- AI/native media/example execution cannot leak into site by directory convention alone
- shared Zod/contracts stay coordinated in one repository
- execution boundary can have separate sandbox/container lifecycle
- Cloudflare deploy target is only site workspace

Costs:

- deeper directory/workspace scripts/tsconfig configuration
- architecture/import tests required
- cross-workspace version changes must remain coordinated

## Related

- `architecture/repository-layout-vnext.md`
- ADR-0017
- `operations/technical-example-profiles.md`
