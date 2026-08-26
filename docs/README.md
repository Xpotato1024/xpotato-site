---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - vNext documentation source of truth map
---

# xpotato-site vNext Documentation

この`docs/`は`xpotato-site`の次期構成を設計するためのdocumentation rootである。

既存`README.md`、`doc/`、old implementationはmigration source / evidenceであり、vNext specificationの正本ではない。

## Read order

1. `product/product-context.md`
2. AI article authoringなら`product/ai-authoring-context.md`
3. task関連architecture / contract / content / operations SoT
4. material decisionなら`design/adr/`
5. migrationなら`migration/`
6. legacy evidenceが必要な場合だけ`legacy/`

## Source of Truth Map

| Topic | Proposed canonical document |
|---|---|
| product purpose | `product/product-context.md` |
| AI authoring purpose | `product/ai-authoring-context.md` |
| documentation governance | `architecture/documentation-sot-policy.md` |
| system architecture | `architecture/system-architecture.md` |
| repository layout | `architecture/repository-layout-vnext.md` |
| frontend | `architecture/frontend-policy.md` |
| browser compatibility | `architecture/browser-compatibility-policy.md` |
| design system | `architecture/design-system-policy.md` |
| performance / accessibility | `architecture/performance-accessibility-policy.md` |
| content delivery | `architecture/content-delivery-policy.md` |
| content discovery / search / RSS / related | `architecture/content-discovery-architecture.md` |
| media pipeline | `architecture/media-pipeline.md` |
| media rendering | `architecture/media-delivery-rendering.md` |
| synthetic media | `architecture/synthetic-media-policy.md` |
| SEO / discovery policy | `architecture/seo-discovery-policy.md` |
| security / privacy | `architecture/security-privacy-policy.md` |
| content architecture | `architecture/content-architecture.md` |
| dependency / toolchain | `architecture/dependency-policy.md` |
| Article Job pipeline | `architecture/article-pipeline.md` |
| Article artifact model | `architecture/article-artifact-model.md` |
| Article state machine | `architecture/article-state-machine.md` |
| AI operating model | `architecture/ai-content-operating-model.md` |
| stable ContentId | `contracts/content-identity-contract.md` |
| Article Job input | `contracts/article-job-contract.md` |
| Article update | `contracts/article-update-contract.md` |
| source / evidence / claim | `contracts/source-evidence-claim-contract.md` |
| citation export | `contracts/citation-export-contract.md` |
| technical example verification | `contracts/technical-example-verification-contract.md` |
| Blog frontmatter | `contracts/blog-frontmatter-contract.md` |
| other collection frontmatter | `contracts/collection-frontmatter-contracts.md` |
| taxonomy | `contracts/taxonomy-registry-contract.md` |
| content discovery profiles | `contracts/content-discovery-contract.md` |
| media asset registry | `contracts/media-asset-registry-contract.md` |
| media ingest | `contracts/media-ingest-contract.md` |
| public media publication | `contracts/public-media-publication-contract.md` |
| published media recovery | `contracts/media-recovery-contract.md` |
| visual artifacts | `contracts/visual-artifact-contract.md` |
| interactive modules | `contracts/interactive-module-registry-contract.md` |
| MDX modules | `contracts/content-module-contract.md` |
| AI exchange / execution | `contracts/ai-exchange-execution-contract.md` |
| candidate / approval | `contracts/candidate-approval-contract.md` |
| publication provenance | `contracts/publication-provenance-contract.md` |
| migration inventory | `contracts/migration-inventory-contract.md` |
| editorial | `content/editorial-policy.md` |
| development | `operations/development-workflow.md` |
| validation | `operations/validation.md` |
| Article AI exchange | `operations/article-ai-exchange.md` |
| deployment boundary | `operations/deployment-boundary.md` |
| agent / Skill governance | `operations/agent-skill-governance.md` |
| rebuild / archive | `migration/greenfield-rebuild-plan.md` |
| open decisions | `design/open-decisions.md` |
| ADR index | `design/adr/README.md` |
| legacy | `legacy/README.md` |

## Document classes

- `product/`: purpose / priority
- `architecture/`: target structure / boundary
- `contracts/`: implementation-ready stable semantics
- `content/`: editorial policy
- `operations/`: repeatable workflow / validation / deployment
- `migration/`: legacy -> vNext
- `design/adr/`: decision history
- `design/open-decisions.md`: evidence待ちの未決事項
- `references/`: external provenance
- `legacy/`: non-authoritative legacy material

## vNext principles

1. product / authoring goalをframework preferenceより上位に置く。
2. static HTML first。dynamic runtimeを局所化する。
3. Node.jsはbuild / authoring toolchainでありproduction server runtimeではない。
4. public site、AI authoring、media ingest、technical example executionをworkspace boundaryで分離する。
5. Astroをstatic UI標準、Reactをstateful interactive islandに限定する。
6. MDX authoring、taxonomy、SEO、archive、RSS、related、search、media deliveryを可能な限り自動化する。
7. content mediaはR2-first。通常写真 / screenshot / AI hero binaryをGitへ保存しない。
8. public R2をpublished mediaの唯一のrecovery copyにしない。
9. iPhone HEIC等はprivate ingestで吸収し、raw sourceをpublic contractにしない。
10. MDXはR2 URLではなくsemantic `media:` referenceを使う。
11. stable UUIDv4 ContentIdとmutable route/slugを分離する。
12. citationはvalidated SourceRefからdeterministicにcompileする。
13. AI-generated code / commandをhostで直接自動実行しない。
14. AI content / visualはartifact lineage + independent auditを持つ。
15. human approval前にcanonical site content / public R2をmutateしない。
16. published Blog hero / social cardはMedia Registryからroleで解決する。
17. collection visual requirementをBlog hero前提へ統一しない。
18. Tool MDXはReact source path / hydration directiveを所有しない。
19. semantic AIをstage-specific Skillへ分離し、deterministic executorがstate / writeを所有する。
20. full Article Jobはprivate、Gitにはcompact publication provenanceだけを残す。
21. archives/RSS/relatedはcontent SoTからbuild-time生成し、Pagefindはrebuildable search artifactとする。
22. content / route / media / infra ownerを分離しsecond SoTを作らない。
23. performance / accessibility / security / privacy / SEOをarchitecture constraintとする。
24. browser featureはBaseline Widely Availableをdefaultとする。
25. old implementationはGit tagで保存しactive vNext treeへfull archive copyを置かない。
26. machine-enforceable invariantはCI / validatorへ置く。

## Adoption gate

review対象:

- product / AI authoring goal
- stable ContentId / create-update semantics
- evidence / citation / technical example verification
- Article Job / audit / human approval
- approval後R2 media publication
- R2 media recovery/protection boundary
- R2 content-addressed object + semantic media registry
- collection frontmatter / taxonomy / visual policy
- MDX module / interactive module API
- archives / RSS / related / Pagefind static search
- migration inventory / parity gate
- Astro static-first / React island
- npm workspace separation + example verifier sandbox boundary
- Tailwind 4 / design token
- HEIC ingest / responsive delivery
- generated hero non-evidence boundary
- Cloudflare Workers Static Assets / R2 ownership
- infrastructure ownership boundary
- greenfield rebuild / legacy tag
- performance / accessibility / SEO / security / privacy
- open decision resolution plan

採用後、ADRを`accepted`、canonical docsを`canonical`へ更新してからimplementation migrationを開始する。
