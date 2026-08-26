---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - vNext documentation source of truth map
---

# xpotato-site vNext Documentation

この`docs/`は`xpotato-site`の次期構成を設計するための新しいdocumentation rootである。

この設計段階では既存`README.md`、`doc/`、現在の実装をcurrent SoTとみなさない。これらはmigration source / implementation evidenceとして参照できるが、vNext specificationを決める正本にはしない。

## Read order

1. `product/product-context.md`
2. AI article authoringなら`product/ai-authoring-context.md`
3. taskに関係するarchitecture / contract / content / operations SoT
4. material decision provenanceが必要なら`design/adr/`
5. migrationなら`migration/`
6. legacy evidenceが必要な場合だけ`legacy/`

## Source of Truth Map

| Topic | Proposed canonical document | Role |
|---|---|---|
| product purpose | `product/product-context.md` | authoring / publishing / quality goal |
| AI authoring purpose | `product/ai-authoring-context.md` | AI-first workflow / human role |
| documentation governance | `architecture/documentation-sot-policy.md` | current / target / historical separation |
| system architecture | `architecture/system-architecture.md` | build / runtime / Cloudflare / infra boundary |
| repository layout | `architecture/repository-layout-vnext.md` | npm workspaces / source ownership |
| frontend | `architecture/frontend-policy.md` | Astro / React / hydration / CSS |
| browser compatibility | `architecture/browser-compatibility-policy.md` | Baseline / progressive enhancement |
| design system | `architecture/design-system-policy.md` | token / component / responsive / motion |
| performance / accessibility | `architecture/performance-accessibility-policy.md` | Core Web Vitals / WCAG / budget |
| content delivery | `architecture/content-delivery-policy.md` | cache / compression / artifact classes |
| media pipeline | `architecture/media-pipeline.md` | private raw → R2 master → variants |
| media rendering | `architecture/media-delivery-rendering.md` | logical media ref → responsive HTML |
| synthetic media | `architecture/synthetic-media-policy.md` | generated hero / provenance / non-evidence |
| SEO / discovery | `architecture/seo-discovery-policy.md` | canonical / structured data / archive |
| security / privacy | `architecture/security-privacy-policy.md` | CSP / third-party / privacy |
| content architecture | `architecture/content-architecture.md` | MDX / taxonomy / URL / legacy |
| dependency / toolchain | `architecture/dependency-policy.md` | Node / npm workspaces / dependency policy |
| Article Job pipeline | `architecture/article-pipeline.md` | source → evidence → audit → approval → media → export |
| Article artifact model | `architecture/article-artifact-model.md` | immutable artifact / lineage |
| Article state machine | `architecture/article-state-machine.md` | states / gates / staleness |
| AI operating model | `architecture/ai-content-operating-model.md` | deterministic executor / semantic roles |
| Article Job input | `contracts/article-job-contract.md` | job input / permission / fingerprint |
| source / evidence / claim | `contracts/source-evidence-claim-contract.md` | evidence binding |
| Blog frontmatter | `contracts/blog-frontmatter-contract.md` | minimal Blog metadata |
| other collection frontmatter | `contracts/collection-frontmatter-contracts.md` | Notes / Projects / Tools / Pages |
| taxonomy | `contracts/taxonomy-registry-contract.md` | category / subject / tool category / tags |
| media asset registry | `contracts/media-asset-registry-contract.md` | semantic asset → immutable R2 object |
| media ingest | `contracts/media-ingest-contract.md` | HEIC etc → private normalized master |
| public media publication | `contracts/public-media-publication-contract.md` | approval-gated immutable R2 upload |
| visual artifacts | `contracts/visual-artifact-contract.md` | plan / generation / visual audit |
| interactive modules | `contracts/interactive-module-registry-contract.md` | content ↔ React module / hydration binding |
| MDX modules | `contracts/content-module-contract.md` | approved authoring API / logical media refs |
| AI exchange / execution | `contracts/ai-exchange-execution-contract.md` | provider-neutral request / response |
| candidate / approval | `contracts/candidate-approval-contract.md` | exact candidate / human approval |
| migration inventory | `contracts/migration-inventory-contract.md` | legacy content / route / media parity schema |
| editorial | `content/editorial-policy.md` | Japanese technical article policy |
| development | `operations/development-workflow.md` | branch / PR / change class |
| validation | `operations/validation.md` | deterministic quality gates |
| Article AI exchange | `operations/article-ai-exchange.md` | prepare / run / import |
| deployment boundary | `operations/deployment-boundary.md` | site repo vs Xpotato-Server |
| agent / Skill governance | `operations/agent-skill-governance.md` | stage Skills / executor boundary |
| rebuild / archive | `migration/greenfield-rebuild-plan.md` | legacy freeze / vNext rebuild |
| open decisions | `design/open-decisions.md` | evidence待ち decision tracking |
| ADR | `design/adr/README.md` | decision history; current SoTではない |
| legacy | `legacy/README.md` | non-authoritative old material |

## Document classes

- `product/`: 上位purpose / priority
- `architecture/`: target architecture / boundary
- `contracts/`: implementationへ落とすstable semantics
- `content/`: editorial policy
- `operations/`: repeated workflow / validation / deploy contract
- `migration/`: legacy -> target移行
- `design/adr/`: decision provenance
- `design/open-decisions.md`: evidence待ち未決項目
- `references/`: external provenance
- `legacy/`: non-authoritative legacy inventory

## vNext principles

1. product / authoring goalをframework preferenceより上位に置く。
2. static HTML first。dynamic runtimeを局所化する。
3. Node.jsはbuild / authoring toolchainでありproduction server runtimeではない。
4. public siteとAI/media authoring toolchainをnpm workspaceで分離する。
5. Astroをstatic UI標準、Reactをstateful interactive islandに限定する。
6. MDX authoring、taxonomy、SEO、archive、media、deliveryを可能な限り自動化する。
7. **content mediaはR2-first。通常写真 / screenshot / AI hero binaryをGitへ保存しない。**
8. iPhone HEIC等はprivate ingestで吸収し、raw sourceをpublic contractにしない。
9. MDXはR2 URLではなくsemantic `media:` referenceを使う。
10. AI content / visualはartifact lineage + independent auditを持つ。
11. human approval前にcanonical site content / public R2をmutateしない。
12. published Blog hero / social cardはMedia Registryからroleで解決する。
13. Tool MDXはReact source path / hydration directiveを所有しない。
14. semantic AIをstage-specific Skillへ分離し、deterministic executorがstate / writeを所有する。
15. content / route / media / infra ownerを分離しsecond SoTを作らない。
16. performance / accessibility / security / privacy / SEOをarchitecture constraintとする。
17. browser featureはBaseline Widely Availableをdefaultとする。
18. old implementationはGit tagで保存し、active vNext treeへfull archive copyを置かない。
19. machine-enforceable invariantはCI / validatorへ置く。

## Adoption gate

review対象:

- product / AI authoring goal
- Article Job / evidence / audit / approval model
- approval後R2 media publication
- R2 content-addressed object + semantic media registry
- collection frontmatter / taxonomy
- MDX module / interactive module API
- migration inventory / parity gate
- Astro static-first / React island
- npm workspace separation
- Tailwind 4 / design token
- HEIC ingest / responsive delivery
- generated hero non-evidence boundary
- Cloudflare Workers Static Assets / R2 ownership
- Xpotato-Server infra boundary
- greenfield rebuild / legacy tag
- performance / accessibility / SEO / security / privacy
- open decision resolution plan

採用後、ADRを`accepted`、canonical docsを`canonical`へ更新してからimplementation migrationを開始する。
