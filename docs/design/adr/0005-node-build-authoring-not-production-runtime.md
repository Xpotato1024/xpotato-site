---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0005: Node.jsはbuild/authoring toolchainとしpublic server runtimeにしない

## Context

Astro/Vite/npmによるsite buildだけでなく、vNextはArticle Job、contract generation、search index build、validators等のauthoring/build toolsもNode.js上で実装する。

一方、public siteはstatic-firstであり、request-time Node serverを常設する必要はない。

旧proposalの「Node=build-time only」という表現ではauthoring planeを説明できない。

## Decision

- vNext baseline toolchainはNode 24 LTS。
- Nodeは**build + authoring toolchain**で使用する。
- `apps/site`のpublic production serving pathへNode process/npm/node_modulesを要求しない。
- exact Node patch/npm/tool imageはmachine-readable toolchain SoTへpinする。
- local hostへのpermanent Node installをrequirementにしない。container/CI等のrepository-defined environmentを利用できる。
- HEIC/native media処理やtechnical-example runtimeは必要に応じて専用container/toolchainへ分離し、Node public runtimeへ混ぜない。

## Allowed Node responsibilities

- Astro/Vite/Tailwind build
- MiniSearch static index generation
- content/schema/registry validation
- Article Job deterministic orchestrator / provider adapters
- contract/JSON Schema generation
- media/example tool orchestration through typed boundaries

## Not implied

このdecisionはrequest-time Node API、Astro SSR、long-running Node daemon、database-backed CMSを採用する意味ではない。

Dynamic server requirementが生じた場合は別material ADRを要求する。

## Alternatives

### Nodeをsite buildだけに限定しauthoring toolsを別languageへ分離

可能だが、現時点ではTypeScript/Zod contractをsiteとArticle Jobで共有する利点が大きく、別runtime導入の価値がない。

### Production Node serverを標準化

static servingで満たせる現在要件に対してattack/operation surfaceが増えるため不採用。

## Consequences

- Node security/update responsibilityはCI/authoring environmentに存在する。
- public server OS上でNode daemon patch lifecycleを持たない。
- workspace dependency boundaryでsite rendererとauthoring/provider/runtime dependenciesを分離する。

## Evidence

Current Node/Astro support factsは`docs/references/external-sources.md`で追跡し、exact provider/tool versionsはimplementation時にmachine SoTへpinする。
