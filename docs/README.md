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
| media pipeline / placement | `architecture/media-pipeline.md` |
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
| media rights / republication | `contracts/media-publication-rights-contract.md` |
| media ingest / normalized master | `contracts/media-ingest-contract.md` |
| responsive media variant generation | `contracts/media-variant-generation-contract.md` |
| public media publication | `contracts/public-media-publication-contract.md` |
| publication-time media protection | `contracts/published-media-protection-contract.md` |
| published media recovery / restore | `contracts/media-recovery-contract.md` |
| visual artifacts | `contracts/visual-artifact-contract.md` |
| interactive modules | `contracts/interactive-module-registry-contract.md` |
| MDX modules | `contracts/content-module-contract.md` |
| AI exchange / execution | `contracts/ai-exchange-execution-contract.md` |
| candidate / approval | `contracts/candidate-approval-contract.md` |
| publication provenance | `contracts/publication-provenance-contract.md` |
| migration inventory schema | `contracts/migration-inventory-contract.md` |
| editorial | `content/editorial-policy.md` |
| development | `operations/development-workflow.md` |
| validation | `operations/validation.md` |
| Article AI exchange | `operations/article-ai-exchange.md` |
| build/deploy artifact | `operations/build-artifact-pipeline.md` |
| deployment boundary | `operations/deployment-boundary.md` |
| Cloudflare control plane / Dashboard boundary | `operations/cloudflare-control-plane-policy.md` |
| agent / Skill governance | `operations/agent-skill-governance.md` |
| rebuild / archive | `migration/greenfield-rebuild-plan.md` |
| current-site design inventory evidence | `migration/current-site-inventory-2026-08-26.md` |
| open decisions | `design/open-decisions.md` |
| ADR index | `design/adr/README.md` |
| legacy | `legacy/README.md` |

## Supporting inventory status

`migration/current-site-inventory-2026-08-26.md`はmain `927d105713561309fc5e2374396f86646b5aeb2a`を調査したdesign-time evidence。

確認済みbaseline:

- Blog 44 / Projects 6 / Notes 1 / Tools 1 / Pages 1
- raw `category=devlog` 31件とcurrent renderer fallbackのsemantic drift
- initial Blog category seed `software 31 / infrastructure 12 / robotics 1`
- PrimeFactorizerがinitial user-facing React Tool migration fixture
- known Git photographic/raster media約4.54 MB
- current Workers Static Assets-compatible config + existing website asset R2 resource

Cloudflare/provider design counterpartは`Xpotato-Server` proposal branch `codex/site-vnext-cloudflare-control-plane` のADR-0024 + desired Cloudflare inventory。current production SoTとして扱うのはaccepted/merged後だけ。

implementation cutoverではdesign-time snapshotをcurrent truthとして流用せず、frozen legacy tagからmachine inventoryを再生成して差分をreviewする。

## Document classes

- `product/`: purpose / priority
- `architecture/`: target structure / boundary
- `contracts/`: implementation-ready stable semantics
- `content/`: editorial policy
- `operations/`: repeatable workflow / validation / deployment / provider control plane
- `migration/`: legacy -> vNext / inventory evidence
- `design/adr/`: decision history
- `design/open-decisions.md`: evidence待ちの未決事項
- `references/`: external provenance
- `legacy/`: non-authoritative legacy material

## vNext principles

1. product / authoring goalをframework preferenceより上位に置く。
2. static HTML first。dynamic runtimeを局所化する。
3. Node.jsはbuild / authoring toolchainでありproduction server runtimeではない。
4. public site、AI authoring、media processing、technical example executionをworkspace boundaryで分離する。
5. Astroをstatic UI標準、Reactをstateful interactive islandに限定する。
6. MDX authoring、taxonomy、SEO、archive、RSS、related、search、media deliveryを可能な限り自動化する。
7. photographic/raster mediaはR2-first。content/project/site heroをGit binaryとして蓄積しない。
8. semantic visual audit後にresponsive mediaをdeterministic prebuildし、Cloudflare Imagesを必須にしない。
9. public media objectはcontent-addressed key + immutable Cache-Control metadataを持つ。
10. public delivery R2をpublished mediaの唯一のrecovery copyにしない。
11. initial recovery planeはseparate private protected-media R2 bucket + indefinite Bucket Lock + no automatic expiration。
12. public mediaはhuman approval/migration authorization後にpublishし、protected recovery receipt後にGit exportする。
13. iPhone HEIC等はprivate ingestで吸収し、raw sourceをpublic contractにしない。
14. MDXはR2 URLではなくsemantic `media:` referenceを使う。
15. stable UUIDv4 ContentIdとmutable route/slugを分離する。
16. citationはvalidated SourceRefからdeterministicにcompileする。
17. AI-generated code / commandをhostで直接自動実行しない。
18. AI content / visualはartifact lineage + independent auditを持つ。
19. human approval前にcanonical site content / public R2をmutateしない。
20. published Blog hero / social cardはMedia Registryからroleで解決する。
21. collection visual requirementをBlog hero前提へ統一しない。
22. Tool MDXはReact source path / hydration directiveを所有しない。
23. semantic AIをstage-specific Skillへ分離し、deterministic executorがstate / writeを所有する。
24. full Article Jobはprivate、Gitにはcompact publication provenanceだけを残す。
25. archives/RSS/relatedはcontent SoTからbuild-time生成し、Pagefindはrebuildable search artifactとする。
26. content / route / media / infra ownerを分離しsecond SoTを作らない。
27. production CI/CDはGitHub Actionsを正本とし、Cloudflare Workers Builds dashboard設定へ依存しない。
28. Cloudflare-specific initial configをWorker domain、R2 public/protected resources、legacy provider redirectsへ絞り、Cache/Compression/CORS/Imagesを無理由に増やさない。
29. Cloudflare Dashboardはbootstrap / billing / recovery / break-glassへ限定し、normal desired stateをGit + OpenTofu/API/CLIで管理する。
30. security-sensitive R2 config desired valuesはGit管理するがadmin credentialをCP/site CIへ常設しない。
31. performance / accessibility / security / privacy / SEOをarchitecture constraintとする。
32. browser featureはBaseline Widely Availableをdefaultとする。
33. old implementationはGit tagで保存しactive vNext treeへfull archive copyを置かない。
34. machine-enforceable invariantはCI / validatorへ置く。

## Adoption gate

review対象:

- product / AI authoring goal
- current-site inventory conclusions / migration fixture selection
- stable ContentId / create-update semantics
- evidence / citation / technical example verification
- Article Job / audit / human approval
- visual audit -> media variants ordering
- approval後R2 master/variant publication
- publication後separate private protected bucket hard gate
- R2 content-addressed object + semantic media registry
- prebuilt responsive media baseline / optional Cloudflare Images adapter
- initial immutable object cache metadata / no unnecessary Cache Rule
- collection frontmatter / initial taxonomy seed / visual policy
- MDX module / interactive module API
- archives / RSS / related / Pagefind static search
- migration inventory / parity gate
- Astro static-first / React island
- npm workspace separation + example verifier sandbox boundary
- Tailwind 4 / design token
- HEIC ingest / responsive delivery
- generated hero non-evidence boundary
- GitHub Actions + Wrangler site deploy
- OpenTofu/API-managed Cloudflare control plane
- R2 config ephemeral admin boundary compatible with server ADR-0020
- Dashboard bootstrap/break-glass boundary
- infrastructure ownership / media protection handoff
- greenfield rebuild / legacy tag
- performance / accessibility / SEO / security / privacy
- remaining parameter-only open decisions

採用後、ADRを`accepted`、canonical docsを`canonical`へ更新してからimplementation migrationを開始する。
