---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - vNext documentation source of truth map
---

# xpotato-site vNext Documentation

`docs/` is the vNext design/specification root。Existing root README/detail under old `doc/` and old implementation are migration evidence, not vNext current/target authority。

## Read order

1. `architecture/design-status.md`
2. `product/product-context.md`
3. AI article task -> `product/ai-authoring-context.md`
4. relevant architecture/contracts/operations/content docs
5. material decision -> `design/adr/`
6. provider/Cloudflare -> `architecture/infrastructure-handoff.md`
7. audit -> `governance/audit.md` + `governance/severity.md`
8. migration -> `migration/`
9. legacy evidence only when required

`status: proposed` means review target, not adopted production architecture。Lifecycle authority=`architecture/design-status.md`。

## Source of Truth Map

| Topic | Proposed canonical document |
|---|---|
| design lifecycle / freeze / implementation gate | `architecture/design-status.md` |
| product purpose | `product/product-context.md` |
| AI authoring purpose | `product/ai-authoring-context.md` |
| documentation governance | `architecture/documentation-sot-policy.md` |
| clean-room audit | `governance/audit.md` |
| severity | `governance/severity.md` |
| exact infrastructure counterpart | `architecture/infrastructure-handoff.md` |
| system architecture | `architecture/system-architecture.md` |
| repository layout | `architecture/repository-layout-vnext.md` |
| frontend | `architecture/frontend-policy.md` |
| browser compatibility | `architecture/browser-compatibility-policy.md` |
| design system | `architecture/design-system-policy.md` |
| performance / accessibility | `architecture/performance-accessibility-policy.md` |
| content delivery | `architecture/content-delivery-policy.md` |
| content discovery / search / RSS / related | `architecture/content-discovery-architecture.md` |
| static search profile | `operations/static-search-profile.md` |
| media pipeline / placement | `architecture/media-pipeline.md` |
| media rendering | `architecture/media-delivery-rendering.md` |
| media processing profiles | `operations/media-processing-profiles.md` |
| synthetic media | `architecture/synthetic-media-policy.md` |
| SEO / discovery | `architecture/seo-discovery-policy.md` |
| security / privacy | `architecture/security-privacy-policy.md` |
| content architecture / portable authoring model | `architecture/content-architecture.md` |
| dependency / toolchain | `architecture/dependency-policy.md` |
| Article Job pipeline | `architecture/article-pipeline.md` |
| Article artifact model | `architecture/article-artifact-model.md` |
| Article state machine | `architecture/article-state-machine.md` |
| AI operating model | `architecture/ai-content-operating-model.md` |
| stable ContentId | `contracts/content-identity-contract.md` |
| Article Job input / permission upper bounds | `contracts/article-job-contract.md` |
| Article update | `contracts/article-update-contract.md` |
| external AI disclosure admission | `contracts/external-ai-disclosure-contract.md` |
| source / evidence / claim | `contracts/source-evidence-claim-contract.md` |
| citation export | `contracts/citation-export-contract.md` |
| technical example semantics | `contracts/technical-example-verification-contract.md` |
| technical example runtime/sandbox | `operations/technical-example-profiles.md` |
| Blog frontmatter | `contracts/blog-frontmatter-contract.md` |
| other collection frontmatter | `contracts/collection-frontmatter-contracts.md` |
| taxonomy | `contracts/taxonomy-registry-contract.md` |
| discovery profile | `contracts/content-discovery-contract.md` |
| media registry | `contracts/media-asset-registry-contract.md` |
| media rights | `contracts/media-publication-rights-contract.md` |
| media ingest/canonical master | `contracts/media-ingest-contract.md` |
| private canonical media persistence | `contracts/private-canonical-media-storage-contract.md` |
| responsive variants | `contracts/media-variant-generation-contract.md` |
| public media publication | `contracts/public-media-publication-contract.md` |
| publication-time media protection | `contracts/published-media-protection-contract.md` |
| published media recovery | `contracts/media-recovery-contract.md` |
| visual artifacts | `contracts/visual-artifact-contract.md` |
| interactive modules | `contracts/interactive-module-registry-contract.md` |
| MDX semantic modules | `contracts/content-module-contract.md` |
| AI exchange/execution | `contracts/ai-exchange-execution-contract.md` |
| initial AI provider/model/budget profile | `operations/ai-execution-profiles.md` |
| candidate / approval | `contracts/candidate-approval-contract.md` |
| cleanup-safe publication provenance | `contracts/publication-provenance-contract.md` |
| Article Job private retention/cleanup | `operations/article-job-retention-policy.md` |
| migration inventory schema | `contracts/migration-inventory-contract.md` |
| editorial | `content/editorial-policy.md` |
| development | `operations/development-workflow.md` |
| validation | `operations/validation.md` |
| Article AI operations | `operations/article-ai-exchange.md` |
| build/deploy artifact | `operations/build-artifact-pipeline.md` |
| deployment boundary | `operations/deployment-boundary.md` |
| Cloudflare control plane / Dashboard boundary | `operations/cloudflare-control-plane-policy.md` |
| agent / Skill governance | `operations/agent-skill-governance.md` |
| rebuild/archive | `migration/greenfield-rebuild-plan.md` |
| current-site design inventory | `migration/current-site-inventory-2026-08-26.md` |
| open decisions | `design/open-decisions.md` |
| ADR index | `design/adr/README.md` |
| historical audits | `audits/` |
| legacy | `legacy/README.md` |

## Document classes

- `product/`: purpose/quality priorities
- `architecture/`: target semantics/ownership/lifecycle/boundaries
- `contracts/`: stable implementation interfaces/constraints
- `operations/`: repeatable workflow/profiles/validation/deployment
- `governance/`: audit/severity process
- `content/`: editorial policy
- `design/adr/`: decision rationale/history
- `design/open-decisions.md`: non-authoritative measurement/provider details
- `migration/`: legacy migration plan/evidence
- `audits/`: exact-revision historical observation only
- `references/`: external provenance
- `legacy/`: non-authoritative migration evidence

## Current design evidence

Design-time legacy inventory source=`927d105713561309fc5e2374396f86646b5aeb2a`:

- Blog44 / Projects6 / Notes1 / Tools1 / Pages1
- initial Blog category seed software31 / infrastructure12 / robotics1
- PrimeFactorizer=interactive fixture
- known Git raster/photo ≈4.54MB

Cutover regenerates exact inventory from frozen legacy tag; this snapshot is not future current state。

## Cross-repository provider status

Only `architecture/infrastructure-handoff.md` defines the provider counterpart。Do not infer from mutable branch names。

Current pinned infra ADR-0024 remains Proposed and website provider mutation is BLOCKED。No proposed website R2/domain/rule value is current production desired state yet。

## vNext principles

1. Product/authoring goals outrank framework convenience。
2. Static HTML first; runtime interactivity is localized。
3. Node is build/authoring tooling, not public server runtime。
4. Site/AI/media/example execution are workspace-separated。
5. Durable content source is portable Markdown/MDX with controlled taxonomy/semantic modules/Interactive Registry (ADR-0027), not arbitrary runtime/provider paths。
6. Stable UUIDv4 ContentId is separate from mutable route/slug。
7. External provider-use permission and exact input disclosure are separate; private/unknown defaults deny, actual secrets hard-deny, every external request uses an exact disclosure manifest (ADR-0026)。
8. Material AI claims remain traceable after job cleanup through durable claim→evidence→source bindings。
9. Raster/photo media is object-storage first, not Git archive content。
10. Raw camera originals are not site long-term SoT; privacy-normalized lossless canonical sources enable future re-encode。
11. Visual audit precedes deterministic responsive variants。
12. Cloudflare Images is optional; prebuilt variants are baseline。
13. Persistent media mutation starts only after exact human approval。
14. Canonical source storage -> public immutable delivery -> protected exact copy -> cleanup-safe recovery binding -> Git export。
15. MDX uses semantic `media:` refs, not provider object URLs/keys。
16. AI citations use fixed Source IDs and deterministic export; no invented URL authority。
17. AI-generated code is never direct host execution; only bounded verifier profiles may execute allowlisted classes。
18. Full Article Job workspace is ephemeral; compact durable provenance/media planes preserve required long-term traceability/recovery。
19. Static search=MiniSearch + repository-owned deterministic Japanese/technical tokenizer, route-local runtime only。
20. Production target CI/CD=GitHub Actions + Wrangler; no Workers Builds dashboard second authority。
21. Provider desired state is Git-driven, but R2 configuration admin remains operator-ephemeral/off persistent CP/site CI trust。
22. Cloudflare Dashboard is bootstrap/billing/recovery/break-glass/true API-gap only。
23. Old implementation is preserved by Git tag, not copied into active vNext source tree。
24. Machine-enforceable invariants belong in schemas/validators/CI。

## Clean-room phase gate

Required sequence:

```text
exact revisions
 -> read-only clean-room audit
 -> findings/verdict freeze
 -> separate remediation
 -> new exact revisions
 -> fresh audit
 -> explicit operator freeze decision
```

P0/P1 block; P2 may remain。Audit PASS does not auto-promote docs/ADRs or open implementation/provider gates。

## Adoption gate

Before Design Freeze review at least:

- lifecycle/audit/severity + exact infra handoff
- portable controlled content model + ContentId/routes/taxonomy/modules
- external AI disclosure classification/admission/request manifests
- source/evidence/citations/durable material-claim lineage
- technical verifier and AI execution profiles
- Article Job state/audit/approval/cleanup
- synthetic visual truth boundary
- canonical source/public/protected media/recovery chain
- MiniSearch tokenizer/discovery
- Astro/React/Tailwind/workspace boundaries
- GitHub Actions/Wrangler/provider control plane
- security/privacy/accessibility/SEO/performance
- greenfield legacy migration/rollback
- remaining measurement/provider-specific open decisions

Only fresh clean-room P0=0/P1=0 **plus explicit operator acceptance** may promote selected ADRs to `accepted`, target docs to `canonical`, record the freeze revision, and open implementation。
