---
status: canonical
owner: architecture
last_verified: 2026-09-05
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
| accepted post-Freeze migration amendments | `design/amendment-acceptance-2026-08-29.md` + `design/amendment-acceptance-adr-0030-2026-08-29.md` + `design/amendment-acceptance-adr-0031-2026-09-04.md` |
| Phase 1 migration baseline acceptance | `migration/phase1-acceptance-2026-08-29.md` |
| Phase 4 content migration acceptance / Phase 5 handoff | `migration/phase4-acceptance-2026-08-30.md` |
| Phase 5 taxonomy migration acceptance / Phase 6 handoff | `migration/phase5-acceptance-2026-08-30.md` |
| Phase 5 exact taxonomy human-review acceptance | `migration/phase5-taxonomy-review-acceptance-2026-08-30.md` |
| Phase 6 repository-side media migration closure / Phase 7 handoff | `migration/phase6-acceptance-2026-09-05.md` |
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
| ranked finite-prefix boundary tie equivalence | `contracts/legacy-build-ranked-prefix-boundary-tie-amendment.md` (ADR-0031 accepted 2026-09-04) |
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
- `design/amendment-acceptance-adr-0031-2026-09-04.md`: accepted bounded ranked-prefix boundary tie amendment authority
- `design/open-decisions.md`: non-authoritative measurement/provider details
- `migration/`: legacy migration plan/evidence and accepted phase records
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

The legacy Cloudflare Workers Builds Git integration for `xpotato-site` was disconnected before the Phase 4 merge. Production deployment remains blocked; the target deployment authority remains GitHub Actions + Wrangler only after later lifecycle/provider gates explicitly open.

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

Greenfield implementation is **IN PROGRESS**。The workspace/CI, contract, provider-neutral pipeline, validator, and representative static-site foundation are accepted/merged through PR #41。Migration Phase 1 is accepted/merged through PRs #42–#44, with its acceptance record at `migration/phase1-acceptance-2026-08-29.md`。

Phase 4 content identity/content materialization is accepted/merged through PR #45. The final audited feature revision was `1b4bb92bd6e285a7ce1c72ef704b1467ed57a06b` with fresh re-audit **PASS — P0=0 / P1=0 / P2=1**; main merge commit is `a1275db87fe3d802373d3fcf9927153322485683`, and post-merge `vNext CI` + `Phase 4 content readiness` passed. Acceptance/handoff details are in `migration/phase4-acceptance-2026-08-30.md`。

Phase 5 taxonomy migration is accepted/merged through PR #47. The exact human-reviewed taxonomy payload is `eaaa43c0c45786f545333de0af4aba4c2b6887cbb3b38167488364c9e097e64a`; the final post-acceptance feature revision `0650300d249e1e0ede8a4ac41e56a12c63b62433` passed fresh re-audit **PASS — P0=0 / P1=0 / P2=0**; main merge commit is `395f096e509a006b007028862f69f629f20d7ae1`, and post-merge `vNext CI`, `Phase 5 taxonomy readiness`, and `Migration content readiness` passed with no Workers Builds check. Acceptance/handoff details are in `migration/phase5-acceptance-2026-08-30.md`。

Phase 6 repository-side media migrationはPR #49でmerged済みです。Operator-accepted review payload `49fe35022d3a573c2575b81add0195921673b17e8ba2da1c8f4707668b8ee3e8`に対して、feature revision `d949102c72ecaa234433706d229b46711c71f080`がfresh audit **PASS — P0=0 / P1=0 / P2=0**とrepository-side gatesを通過し、main merge commit `9ca616f41882b4b8ca7a5a803d5eb3f252506559`のpost-merge `vNext CI`、`Phase 6 media readiness`、`Phase 5 taxonomy readiness`、`Migration content readiness`も成功しました。これはlocal/CI candidate生成までのclosureであり、private canonical source/public delivery/protected copyのprovider persistence、read-back、restore、publication、deploy、cutoverを完了または認可しません。Closure/handoff detailsは`migration/phase6-acceptance-2026-09-05.md`です。

次のrepository migration gateは**Phase 7 — Interactive Tool parity/readiness/closure**です。既存のPrimeFactorizer foundationとInteractive Module Registry bindingを新設し直す段階ではなく、frozen legacyに対するinteractive parityとclosure evidenceを確定します。その後にPhase 8 route/SEO/discovery/search parityが続きます。Phase 9 provider control-plane acceptance、production deploy/cutover、rollback、legacy deletionは独立してBLOCKEDのままです。

Migration preparation is not migration/cutover authorization。Legacy cutover, old active implementation deletion, provider mutation, deployment, and production external-AI activation remain separately gated。See `architecture/design-status.md` and `architecture/infrastructure-handoff.md` before any destructive/external action。
