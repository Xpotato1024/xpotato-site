---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - vNext documentation source of truth map
---

# xpotato-site vNext Documentation

`docs/`はxpotato-site vNextのdesign/specification root。Existing root `README.md`、`doc/`、old implementationはmigration evidenceでありvNext SoTではない。

## Read order

1. `architecture/design-status.md`
2. `product/product-context.md`
3. AI article taskなら`product/ai-authoring-context.md`
4. relevant architecture / contract / content / operations SoT
5. material decisionなら`design/adr/`
6. cross-repo provider scopeなら`architecture/infrastructure-handoff.md`
7. clean-room audit taskなら`governance/audit.md` + `governance/severity.md`
8. migration taskなら`migration/`
9. legacy evidenceが必要な場合だけ`legacy/`

`status: proposed`はreview targetでありcurrent production adoptionを意味しない。Lifecycle authorityは`architecture/design-status.md`。

## Source of Truth Map

| Topic | Proposed canonical document |
|---|---|
| design lifecycle / freeze / implementation gate | `architecture/design-status.md` |
| product purpose | `product/product-context.md` |
| AI authoring purpose | `product/ai-authoring-context.md` |
| documentation governance | `architecture/documentation-sot-policy.md` |
| clean-room audit procedure | `governance/audit.md` |
| finding severity | `governance/severity.md` |
| cross-repository infrastructure binding | `architecture/infrastructure-handoff.md` |
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
| technical example semantics | `contracts/technical-example-verification-contract.md` |
| technical example runtime/sandbox profile | `operations/technical-example-profiles.md` |
| Blog frontmatter | `contracts/blog-frontmatter-contract.md` |
| other collection frontmatter | `contracts/collection-frontmatter-contracts.md` |
| taxonomy | `contracts/taxonomy-registry-contract.md` |
| discovery profile | `contracts/content-discovery-contract.md` |
| media asset registry | `contracts/media-asset-registry-contract.md` |
| media rights | `contracts/media-publication-rights-contract.md` |
| media ingest/canonical master | `contracts/media-ingest-contract.md` |
| private canonical media persistence | `contracts/private-canonical-media-storage-contract.md` |
| responsive variant generation | `contracts/media-variant-generation-contract.md` |
| public media publication | `contracts/public-media-publication-contract.md` |
| publication-time media protection | `contracts/published-media-protection-contract.md` |
| published media recovery | `contracts/media-recovery-contract.md` |
| visual artifacts | `contracts/visual-artifact-contract.md` |
| interactive modules | `contracts/interactive-module-registry-contract.md` |
| MDX modules | `contracts/content-module-contract.md` |
| AI exchange/execution contract | `contracts/ai-exchange-execution-contract.md` |
| initial AI provider/model/budget profile | `operations/ai-execution-profiles.md` |
| candidate / approval | `contracts/candidate-approval-contract.md` |
| publication provenance / durable claim+recovery lineage | `contracts/publication-provenance-contract.md` |
| Article Job private workspace retention/cleanup | `operations/article-job-retention-policy.md` |
| migration inventory schema | `contracts/migration-inventory-contract.md` |
| editorial | `content/editorial-policy.md` |
| development | `operations/development-workflow.md` |
| validation | `operations/validation.md` |
| Article AI operations | `operations/article-ai-exchange.md` |
| build/deploy artifact | `operations/build-artifact-pipeline.md` |
| deployment boundary | `operations/deployment-boundary.md` |
| Cloudflare control plane / Dashboard boundary | `operations/cloudflare-control-plane-policy.md` |
| agent / Skill governance | `operations/agent-skill-governance.md` |
| rebuild / archive | `migration/greenfield-rebuild-plan.md` |
| current-site design inventory evidence | `migration/current-site-inventory-2026-08-26.md` |
| open decisions | `design/open-decisions.md` |
| ADR index | `design/adr/README.md` |
| historical audit reports | `audits/` |
| legacy | `legacy/README.md` |

## Document classes

- `product/`: purpose / quality priority
- `architecture/`: target semantics, ownership, lifecycle/boundary
- `contracts/`: implementation-ready stable semantics
- `content/`: editorial rules
- `operations/`: repeatable workflow / profile / validation / deployment
- `governance/`: audit/severity process
- `migration/`: legacy -> vNext evidence/plan
- `design/adr/`: decision rationale/lifecycle history
- `design/open-decisions.md`: non-authoritative remaining parameter/evidence gaps
- `audits/`: historical observed audit reports; never architecture SoT
- `references/`: external provenance
- `legacy/`: non-authoritative migration source material

## Current design evidence

Design-time inventory:

- `migration/current-site-inventory-2026-08-26.md`
- source legacy main: `927d105713561309fc5e2374396f86646b5aeb2a`
- Blog 44 / Projects 6 / Notes 1 / Tools 1 / Pages 1
- initial Blog category seed: `software 31 / infrastructure 12 / robotics 1`
- PrimeFactorizer = initial interactive Tool fixture
- known Git photographic/raster media ≈4.54 MB

Implementation cutover must regenerate inventory from exact frozen legacy tag; this design-time snapshot is not future current truth。

## Cross-repository infrastructure status

Do not infer provider design from a mutable branch。

Exact current proposal counterpart is defined only by:

- `architecture/infrastructure-handoff.md`

The pinned `Xpotato-Server` ADR-0024 is still **Proposed** and provider mutation is **BLOCKED**. No proposed website vNext resource value is current production desired state until explicit acceptance/promotion on both sides。

## vNext principles

1. Product/authoring goals outrank framework convenience。
2. Static HTML first; dynamic runtime localized。
3. Node is build/authoring toolchain, not public server runtime。
4. Public site / AI authoring / media processing / example execution are workspace-separated。
5. Astro is normal UI; React only stateful interactive islands。
6. MDX/taxonomy/SEO/archive/RSS/related/search/media automation is system-derived where practical。
7. Stable UUIDv4 ContentId is separate from mutable route/slug。
8. Material AI claims remain traceable after job cleanup through durable compact evidence/source bindings。
9. Photographic/raster media is R2/object-storage first, not Git archive material。
10. Raw camera originals are not site long-term SoT; privacy-normalized lossless canonical source is retained for future re-encode。
11. Visual audit precedes deterministic responsive variant generation。
12. Baseline image delivery uses prebuilt variants; Cloudflare Images is optional。
13. Persistent media mutation starts only after exact human approval。
14. Approved canonical source -> private source storage -> public immutable delivery -> exact protected recovery -> Git export。
15. Public delivery bytes have cleanup-safe durable protected recovery bindings in Git provenance。
16. MDX uses semantic `media:` refs, not provider URLs/object keys。
17. AI citation uses fixed Source IDs and deterministic export; no invented URL authority。
18. AI-generated code is not directly executed on host; only bounded isolated verifier profiles may execute allowlisted classes。
19. Author/auditor and visual planner/auditor contexts are separated。
20. Full Article Job workspace is ephemeral; durable compact lineage/media planes carry required long-term state。
21. Static search = MiniSearch + repository-owned deterministic Japanese/technical tokenizer, route-local runtime only。
22. Production CI/CD = GitHub Actions + Wrangler; no Cloudflare Workers Builds dashboard SoT。
23. Provider desired state is Git-driven, but R2 configuration admin remains operator-ephemeral/off persistent CP/site CI trust。
24. Cloudflare Dashboard is bootstrap/billing/recovery/break-glass, not normal configuration authority。
25. Old implementation is preserved by Git tag, not copied into active vNext `archive/old-src`。
26. Machine-enforceable invariant belongs in schema/validator/CI。

## Clean-room phase gate

See `architecture/design-status.md` + `governance/audit.md` + `governance/severity.md`。

Required sequence:

```text
exact revisions fixed
 -> read-only clean-room audit
 -> findings/verdict frozen
 -> separate remediation
 -> new exact revisions
 -> fresh clean-room re-audit
 -> operator freeze decision
```

P0/P1 block phase advance. P2 may remain. Audit PASS alone does not promote any ADR/doc to accepted/canonical。

## Adoption gate

Before Design Freeze, review at least:

- product/AI authoring goals
- lifecycle/audit/severity governance
- exact infra handoff
- current inventory/migration fixtures
- ContentId/routes/taxonomy
- source/evidence/citation/durable material-claim lineage
- technical-example verifier
- AI execution profiles/budgets
- Article Job state/audit/approval/cleanup
- generated hero non-evidence boundary
- canonical source/media processing/public/protection/recovery chain
- cleanup-safe media recovery binding
- MiniSearch tokenizer/search profile
- content/MDX/interactive module APIs
- archives/RSS/related
- Astro/React/Tailwind/workspace boundaries
- GitHub Actions/Wrangler/provider control plane
- security/privacy/accessibility/SEO/performance
- greenfield rebuild/legacy archive
- remaining measured/provider-specific open decisions

Only after a fresh clean-room P0=0/P1=0 **and explicit operator acceptance** should adopted ADRs become `accepted`, target docs become `canonical`, exact freeze revision be recorded, and implementation gate be opened。
