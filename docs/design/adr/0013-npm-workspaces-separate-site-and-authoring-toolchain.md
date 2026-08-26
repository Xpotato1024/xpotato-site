---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0013: npm workspacesでsiteとauthoring toolchainを分離する

## Context

vNextはAstro siteに加え、Article Job、AI provider adapter、HEIC media ingest、schema generation、validatorを持つ。

これらを単一Astro packageの`src/` / `tools/`へ置くと、production siteとauthoring-only dependencyの境界が慣習に依存し、provider SDK / native media dependencyがsite側へ侵入しやすい。

一方、完全に別repositoryへ分割するとcontent schema / taxonomy / candidate contractのversion同期が複雑になる。

## Decision

1 repository + npm workspacesとする。

- `apps/site`: public static site
- `packages/content-contracts`: shared schema / registry contract
- `packages/article-pipeline`: AI Article Job
- `packages/media-ingest`: local media normalization
- `packages/site-validators`: deterministic validation

siteはarticle-pipelineへ依存しない。

## Alternatives

### Single package `src/ + tools/`

初期は簡単だが、Article pipelineが成長するとdependency / import boundaryが弱い。

### Separate repositories

runtime隔離は強いが、content contract versioning / coordinated migrationの運用負荷が高い。

## Consequences

- directoryは深くなる
- workspace scripts / tsconfig boundaryが必要
- shared contractを明示package化できる
- Cloudflare build targetをsite workspaceへ限定できる
- AI / media dependencyをproduction siteから隔離しやすい
