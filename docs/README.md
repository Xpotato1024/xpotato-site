---
status: canonical
owner: architecture
last_verified: 2026-08-29
canonical_for:
  - vNext documentation source of truth map
---

# xpotato-site vNext Documentation

`docs/` is the vNext design/specification root。Existing root README/detail under old `doc/` and old implementation are migration evidence, not vNext current/target authority。

## Read order

1. `architecture/design-status.md`
2. `design/freeze-manifest-2026-08-26.md`
3. `product/product-context.md`
4. AI article task -> `product/ai-authoring-context.md`
5. relevant architecture/contracts/operations/content docs
6. material decision -> `design/adr/`
7. provider/Cloudflare -> `architecture/infrastructure-handoff.md`
8. audit -> `governance/audit.md` + `governance/severity.md`
9. migration -> `migration/`
10. legacy evidence only when required

Lifecycle/adoption authority=`architecture/design-status.md` + the exact acceptance manifests referenced there。The original frozen design content was adopted from exact audited revision `f42e490c49bab795e6c15682611564ff0edd841c`。

Many files in exact audited proposal baselines retain `status: proposed` frontmatter so the audited bytes remain unchanged。For explicitly adopted baseline/amendment files, the applicable acceptance manifest + `architecture/design-status.md` are lifecycle authority。New post-Freeze proposals are not adopted by implication。

## Source of Truth Map

| Topic | Canonical / frozen target document |
|---|---|
| design lifecycle / freeze / implementation gate | `architecture/design-status.md` |
| frozen baseline adoption scope | `design/freeze-manifest-2026-08-26.md` |
| accepted post-Freeze migration amendments | `design/amendment-acceptance-2026-08-29.md` + `design/amendment-acceptance-adr-0030-2026-08-29.md` |
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
| external AI disclosure admission semantics | `contracts/external-ai-disclosure-contract.md` |
| initial external AI disclosure policy profile | `operations/external-ai-disclosure-profile.md` |
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
| migration inventory schema | `contracts/migration-inventory-contract.md` (ADR-0029 amendment accepted 2026-08-29) |
| legacy build reproduction equivalence | `contracts/legacy-build-reproduction-contract.md` (ADR-0028 accepted 2026-08-29) |
| frozen Astro/React island uid equivalence | `contracts/legacy-build-astro-island-uid-amendment.md` (ADR-0030 accepted 2026-08-29) |
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
| open implementation/measurement decisions | `design/open-decisions.md` |
| ADR lifecycle index | `design/adr/README.md` |
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
- `design/freeze-manifest-2026-08-26.md`: audited baseline adoption authority
- `design/amendment-acceptance-2026-08-29.md`: accepted ADR-0028/0029 migration amendment authority
- `design/amendment-acceptance-adr-0030-2026-08-29.md`: accepted bounded Astro/React island uid amendment authority
- `design/open-decisions.md`: non-authoritative measurement/provider details
- `migration/`: legacy migration plan/evidence
- `audits/`: exact-revision historical observation only
- `references/`: external provenance
- `legacy/`: non-authoritative migration evidence

## Frozen design evidence

Design-time legacy inventory source=`927d105713561309fc5e2374396f86646b5aeb2a`:

- Blog44 / Projects6 / Notes1 / Tools1 / Pages1
- initial Blog category seed software31 / infrastructure12 / robotics1
- PrimeFactorizer=interactive fixture
- known Git raster/photo ≈4.54MB

Cutover regenerates exact inventory from the immutable legacy tag; this snapshot is not future current state。

## Cross-repository provider status

Only `architecture/infrastructure-handoff.md` defines the provider counterpart。Do not infer from mutable branch names。

Current pinned infra ADR-0024 remains **Proposed** and website provider mutation is **BLOCKED**。The site Design Freeze does not promote proposed website R2/domain/rule values to current infrastructure desired state。

## vNext principles

1. Product/authoring goals outrank framework convenience。
2. Static HTML first; runtime interactivity is localized。
3. Node is build/authoring tooling, not public server runtime。
4. Site/AI/media/example execution are workspace-separated and are not required to execute on the user's local workstation。
5. Durable content source is portable Markdown/MDX with controlled taxonomy/semantic modules/Interactive Registry (ADR-0027), not arbitrary runtime/provider paths。
6. Stable UUIDv4 ContentId is separate from mutable route/slug。
7. External provider-use permission and exact input disclosure are separate; private/unknown defaults deny, actual secrets hard-deny, every external request uses an exact disclosure manifest (ADR-0026)。
8. Initial external disclosure defaults are fixed by `article-external-ai-disclosure-v1`; changing provider/model does not silently widen them。
9. Material AI claims remain traceable after job cleanup through durable claim→evidence→source bindings。
10. Raster/photo media is object-storage first, not Git archive content。
11. Raw camera originals are not site long-term SoT; privacy-normalized lossless canonical sources enable future re-encode。
12. Visual audit precedes deterministic responsive variants。
13. Cloudflare Images is optional; prebuilt variants are baseline。
14. Persistent media mutation starts only after exact human approval。
15. Canonical source storage -> public immutable delivery -> protected exact copy -> cleanup-safe recovery binding -> Git export。
16. MDX uses semantic `media:` refs, not provider object URLs/keys。
17. AI citations use fixed Source IDs and deterministic export; no invented URL authority。
18. AI-generated code is never direct host execution; only bounded verifier profiles may execute allowlisted classes。
19. Full Article Job workspace is ephemeral; compact durable provenance/media planes preserve required long-term traceability/recovery。
20. Static search=MiniSearch + repository-owned deterministic Japanese/technical tokenizer, route-local runtime only。
21. Production target CI/CD=GitHub Actions + Wrangler; no Workers Builds dashboard second authority。
22. Provider desired state is Git-driven, but R2 configuration admin remains operator-ephemeral/off persistent CP/site CI trust。
23. Cloudflare Dashboard is bootstrap/billing/recovery/break-glass/true API-gap only。
24. Old implementation is preserved by Git tag, not copied into active vNext source tree。
25. Machine-enforceable invariants belong in schemas/validators/CI。

## Freeze record

Clean-room Audit #5 audited:

```text
site: f42e490c49bab795e6c15682611564ff0edd841c
infra: 6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d
verdict: PASS — P0=0 / P1=0 / P2=0
```

The operator accepted Design Freeze on 2026-08-26。Adoption scope and ADR state are recorded in `design/freeze-manifest-2026-08-26.md` and `design/adr/README.md`。

## Implementation state

Greenfield implementation is **IN PROGRESS**。The workspace/CI, contract, provider-neutral pipeline, validator, and representative static-site foundation passed a separate fresh read-only implementation audit and were merged through PR #41 at main `4a478c7fa3a02825930dbc9249557b850f14d2c5`。Migration preparation is underway under explicit tasks。

ADR-0028/0029 were accepted on 2026-08-29 after fresh clean-room audit of exact revision `fddcfe936b8bd0bcfa68a074ea808ca6f84ecc9e`。ADR-0030 was separately accepted on 2026-08-29 after fresh design audit of exact revision `36aecac4f3342e8ee41b4332c0d0c6df6d37b0fe`。Their machine remediation and Phase 1A evidence update are implemented on the migration-preparation feature branch; Phase 1A acceptance still requires a fresh read-only implementation re-audit of the final exact SHA。

Migration preparation is not migration/cutover authorization。Legacy cutover, old active implementation deletion, provider mutation, deployment, and production external-AI activation remain separately gated。See `architecture/design-status.md` and `architecture/infrastructure-handoff.md` before any destructive/external action。
