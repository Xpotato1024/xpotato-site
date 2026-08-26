---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - vNext documentation source of truth map
---

# xpotato-site vNext Documentation

この `docs/` は、`xpotato-site` の次期構成を設計するための新しい documentation root である。

この設計段階では、既存の `README.md`、`doc/`、現在の実装を自動的に current SoT とみなさない。これらは移行元の実装・運用 evidence として参照できるが、vNext の仕様を決める根拠にはしない。

`docs/` の内容がレビューされて採用された後、ここを current architecture / governance の正本とし、実装をこの仕様へ段階的に収束させる。設計文書が存在することは、実装が既に適合していることを意味しない。

## Read order

1. `product/product-context.md` — 何のためのサイトか、何を最適化するか
2. AI article authoringを扱う場合は `product/ai-authoring-context.md`
3. task に関係する architecture / contract / content / operations SoT
4. material decision の provenance が必要なら `design/adr/`
5. migrationを扱う場合は `migration/`
6. legacy evidenceを参照する場合だけ `legacy/`

## Source of Truth Map

| Topic | Proposed canonical document | Role |
|---|---|---|
| product purpose | `product/product-context.md` | authoring / publishing / quality goal |
| AI authoring purpose | `product/ai-authoring-context.md` | AI-first article workflow / human role |
| 文書 governance | `architecture/documentation-sot-policy.md` | current / target / historical の分離 |
| システム構成 | `architecture/system-architecture.md` | build、runtime、Cloudflare、R2、infra boundary |
| vNext repository layout | `architecture/repository-layout-vnext.md` | npm workspaces / active code / tool boundaries |
| frontend | `architecture/frontend-policy.md` | Astro、React、hydration、CSS、browser JS |
| browser compatibility | `architecture/browser-compatibility-policy.md` | web platform feature / progressive enhancement policy |
| design system | `architecture/design-system-policy.md` | token、component、responsive、motion の責務 |
| performance / accessibility | `architecture/performance-accessibility-policy.md` | Core Web Vitals、budget、WCAG、media |
| content delivery | `architecture/content-delivery-policy.md` | cache、compression、hashed asset、resource hint |
| media pipeline | `architecture/media-pipeline.md` | iPhone / HEIC ingest、responsive images、R2 media |
| synthetic media | `architecture/synthetic-media-policy.md` | generated hero、visual provenance、non-evidence boundary |
| SEO / discovery | `architecture/seo-discovery-policy.md` | canonical、metadata、taxonomy archive、crawl / index |
| security / privacy | `architecture/security-privacy-policy.md` | CSP、security headers、third-party code、tracking |
| content model | `architecture/content-architecture.md` | MDX、taxonomy、content module、URL、legacy |
| dependency / toolchain | `architecture/dependency-policy.md` | Node、npm workspaces、package、upgrade policy |
| Article Job pipeline | `architecture/article-pipeline.md` | source → evidence → author → audit → visual → approval → export |
| Article artifact model | `architecture/article-artifact-model.md` | immutable article artifact / lineage classes |
| Article state machine | `architecture/article-state-machine.md` | Article Job states / gates |
| AI operating model | `architecture/ai-content-operating-model.md` | deterministic executor / author / auditor / visual roles |
| Article Job contract | `contracts/article-job-contract.md` | job input / permission / fingerprint semantics |
| source / evidence / claim | `contracts/source-evidence-claim-contract.md` | evidence binding semantics |
| Blog frontmatter | `contracts/blog-frontmatter-contract.md` | minimum author metadata / derived SEO |
| taxonomy registry | `contracts/taxonomy-registry-contract.md` | category / tag / archive contract |
| visual artifacts | `contracts/visual-artifact-contract.md` | visual plan / generation / audit / hero identity |
| media ingest | `contracts/media-ingest-contract.md` | HEIC / JPEG / PNG normalize request / result |
| AI exchange / execution | `contracts/ai-exchange-execution-contract.md` | request / response / provider profile boundary |
| MDX modules | `contracts/content-module-contract.md` | approved content module API |
| candidate / approval | `contracts/candidate-approval-contract.md` | exact candidate / human approval binding |
| editorial | `content/editorial-policy.md` | 日本語記事、根拠、記事構造 |
| development workflow | `operations/development-workflow.md` | branch、PR、変更単位 |
| validation | `operations/validation.md` | check、build、content / route / asset validation |
| Article AI exchange | `operations/article-ai-exchange.md` | prepare / run / import semantic exchange |
| deployment boundary | `operations/deployment-boundary.md` | site repo と Xpotato-Server の責務分離 |
| agent / Skill governance | `operations/agent-skill-governance.md` | AGENTS.md、Skills、scripts、CI の知識配置 |
| vNext rebuild / archive | `migration/greenfield-rebuild-plan.md` | old implementation freeze / active tree rebuild |
| ADR | `design/adr/README.md` | 設計判断の履歴。current SoT ではない |
| legacy | `legacy/README.md` | 旧文書・旧実装の扱い |

## Document classes

- `product/`: 「何を作るか」「何を優先するか」という上位 context。
- `architecture/`: target architecture と boundary。
- `contracts/`: implementationへ落とすstable field / interface semantics。
- `content/`: 公開コンテンツの editorial / source policy。
- `operations/`: 反復利用する開発・validation・deployment contract。
- `migration/`: legacyからtargetへ移す手順とcutover gate。
- `design/adr/`: なぜその設計を選んだかを残す decision record。現在仕様は canonical docs を読む。
- `references/`: 外部仕様・研究・一次資料への provenance。
- `legacy/`: 旧構成の inventory と移行上の注意。current design の根拠にしない。

## vNext の基本原則

1. product / authoring goal を framework preference より上位に置く。
2. static HTML first。動的機能を必要な局所へ閉じ込める。
3. Node.js は build / authoring toolchain に限定し、本番 server runtime の前提にしない。
4. public siteとAI/media authoring toolchainをnpm workspaceで分離する。
5. Astro component を通常 UI の標準とし、React は stateful な interactive island に限定する。
6. JavaScript、third-party code、web font、request-time runtime は必要性を示してから追加する。
7. MDX authoring、taxonomy、SEO、media conversion、archive、delivery optimization を可能な限り自動化する。
8. iPhone / HEIC 等の author source format は ingest pipeline で吸収し、raw source を public contract にしない。
9. AI-generated content / visual はartifact lineageとindependent auditを持ち、人間承認前にcanonical contentへ書かない。
10. content、route、asset、infra の owner を分離し、同じ値や意味を複数 repo / document に複製しない。
11. performance、accessibility、security、privacy、SEO はデザイン後の調整項目ではなく architecture constraint とする。
12. browser feature は Baseline Widely Available を default とし、新しい機能は progressive enhancement / fallback を設計する。
13. vNext実装は旧directory layoutに拘束されず、旧sourceはGit tagで保存してactive treeを再構築する。
14. 設計判断は ADR、現在仕様は canonical docs、機械的に検査できる条件は CI / validator へ置く。

## Adoption gate

この proposed design を採用する前に、少なくとも次をレビューする。

- product / authoring goal
- AI-first Article Job / human approval model
- Article Job / evidence / frontmatter / taxonomy / visual / media / candidate contracts
- AI exchange / provider neutrality / resource budget
- Astro static-first を維持すること
- npm workspacesでsite / authoring toolchainを分離すること
- React island の境界
- Tailwind 4 と design token の責務
- MDX content module API
- iPhone / HEIC media ingest と image delivery
- AI hero generation / non-evidence boundary
- cache / compression / fingerprinted asset policy
- browser compatibility / progressive enhancement policy
- Cloudflare Workers Static Assets を公開面とすること
- Xpotato-Server との infra ownership
- greenfield vNext rebuild と legacy tag archive
- performance / accessibility target
- SEO / security / privacy の baseline
- Agent Skills の責務分離

採用後は ADR の `status` を `accepted`、canonical docs の `status` を `canonical` へ更新してから実装 migration を開始する。
