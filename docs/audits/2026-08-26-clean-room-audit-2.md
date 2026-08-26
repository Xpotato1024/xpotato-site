---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# Clean-room Phase-gate Audit #2 — 2026-08-26

## Audit identity

- audit kind: Design Freeze phase-gate / clean-room
- audited site revision: `300cb8624a52f5e4911380105ec10f1428188faf`
- audited infrastructure counterpart: `Xpotato1024/Xpotato-Server@6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d`
- infrastructure ADR: `docs/decisions/ADR-0024-website-cloudflare-control-plane-and-media-protection.md`
- audit mode: read-only until findings/verdict fixed
- verdict: **FAIL — P0=0 / P1=2 / P2=1**

This report was written only after the read-only pass ended. The commit containing this report is **not** the audited site revision.

## Evidence boundary

Used as design authority:

1. audited revision `AGENTS.md`;
2. `docs/README.md` SoT map and reachable proposed/canonical target docs;
3. ADRs/status at the audited revision;
4. repository contracts/config/evidence needed for the scope;
5. exact SHA-pinned infrastructure counterpart from `architecture/infrastructure-handoff.md`;
6. authoritative upstream docs only for current provider facts that required verification, not to fill missing repository intent.

Not used to fill design gaps:

- prior chat/model memory;
- uncommitted intent;
- legacy `doc/`/old README detail as target authority;
- mutable branch head as cross-repo authority;
- Issue/PR discussion as specification substitute.

## Positive observations

The remediation after Audit #1 successfully made the following clean-room recoverable:

- site lifecycle=`PRE_FREEZE_REVIEW`, implementation/provider mutation blocked;
- clean-room severity/independence procedure is repository-local;
- infra counterpart is exact-SHA pinned;
- infra ADR-0024 remains Proposed and new website vNext resource values are absent from active `inventory/desired/cloudflare.yaml`;
- Node build/authoring/public-runtime ADR is aligned;
- media architecture is R2/object-storage first with prebuilt variants baseline;
- Article Job state uses canonical `MEDIA_READY` and current persistence sequence;
- job cleanup preserves durable material-claim support and compact media recovery bindings;
- ContentId has a dedicated material ADR;
- Pagefind ADR-0016 itself is correctly `Rejected`; MiniSearch ADR-0021 remains Proposed;
- current OpenAI execution profile model IDs checked against authoritative current API docs were valid at audit time.

## Findings

### B1 — P1 — External-AI input disclosure admission is not machine-representable

**Evidence**

- `product/ai-authoring-context.md` says the human supplies a private/public boundary and permissions for notes/repos/logs/media.
- `contracts/article-job-contract.md` provides broad booleans such as `externalTextAI` and `externalImageAI`, but no per-input/source disclosure authorization.
- `contracts/source-evidence-claim-contract.md` has `publicSafe`/citation eligibility, which govern publication/citation, not whether private bytes may be disclosed to an external AI provider.
- `contracts/ai-exchange-execution-contract.md` sends `inputArtifacts: ArtifactRef[]` but has no disclosure manifest/classification or proof that every external input is admitted.
- `architecture/ai-content-operating-model.md` requires deterministic public/private scope validation, but no canonical contract defines that scope.

**Failure mode**

A clean-room implementation can plausibly choose conflicting behaviors:

1. `externalTextAI=true` means all fixed sources may be sent externally, risking private log/repository/file disclosure; or
2. all non-public sources are excluded, making an Article Job unable to use explicitly authorized private inputs without an undocumented bypass.

The same ambiguity applies to vision/image stages when prompts or image inputs derive from private artifacts.

This is a security/privacy permission-boundary ambiguity, therefore P1.

**Done condition**

Define one canonical external-AI disclosure/admission contract that at minimum:

- classifies each source/input artifact independently from publication/citation safety;
- defaults unknown/private disclosure to deny;
- supports explicit user/repository/system authorization and, if needed, redacted/derived-only disclosure;
- makes secret/credential material non-disclosable even if a broader AI permission is true;
- binds a deterministic disclosure/admission manifest into each external semantic/image/vision request;
- validates every external request input against that manifest before provider call;
- blocks or requires a local/non-external path when a required source is not externally admissible;
- records safe disclosure-policy lineage without storing private source bodies.

A material ADR should record this trust-boundary decision.

---

### B2 — P1 — Core portable content-authoring architecture lacks a material ADR

**Evidence**

`architecture/content-architecture.md`, `contracts/taxonomy-registry-contract.md`, and `contracts/content-module-contract.md` make migration-heavy decisions:

- taxonomy is stable version-controlled registry IDs rather than free-form frontmatter text;
- unknown taxonomy cannot silently create/fallback;
- portable Markdown/MDX is primary;
- article authors cannot use arbitrary JSX/React imports/layout utilities as the normal API;
- special presentation uses an approved semantic module set;
- Tool/Demo runtime is bound through an Interactive Module Registry;
- presentation/runtime/storage/provider fields are kept out of content source;
- archives/discovery derive from controlled registries/content.

`design/adr/README.md` contains no ADR whose decision rationale owns this content-authoring architecture.

**Failure mode**

Changing these choices after freeze would require broad content/frontmatter/taxonomy/module/route migration, yet the repository would have no accepted decision record explaining why the controlled portable model was chosen over free-form taxonomy, arbitrary MDX component imports, or runtime-coupled content. This violates the clean-room governance requirement that material migration-affecting decisions have ADR rationale/history.

**Done condition**

Add a material ADR that defines the durable content-authoring model and alternatives. It should cover at least:

- portable Markdown/MDX first;
- controlled stable taxonomy registries rather than free-form route-generating terms;
- approved semantic content modules rather than arbitrary article imports/layout code;
- Interactive Module Registry for runtime implementations;
- system-derived presentation/discovery/provider metadata rather than embedding implementation paths in article source;
- expected migration/consequence/revisit triggers.

Exact taxonomy seed values and individual module props may remain contract/profile concerns rather than ADR facts.

---

### B3 — P2 — Dependency policy uses the wrong Pagefind ADR lifecycle term

**Evidence**

- `design/adr/0016-pagefind-extended-for-static-search.md` is `Rejected`.
- `design/adr/README.md` correctly says Rejected with ADR-0021 as replacement proposal.
- `architecture/dependency-policy.md` still states that Pagefind ADR-0016 was “superseded” by ADR-0021.

**Impact**

Current behavior is still unambiguous (MiniSearch target, Pagefind not current), so this does not affect runtime/design correctness. It does create minor ADR-history drift and should be corrected.

**Done condition**

Change dependency-policy wording to: ADR-0016 was Rejected; ADR-0021 is the current Proposed replacement until explicit Design Freeze acceptance.

## Open decisions reviewed

`design/open-decisions.md` contains implementation-measurement/provider details whose absence does not itself block current design review, including performance byte budgets, visual style, Comparison child API, exact legacy tag string, provider version/permission pins, future GC, and interactive bundle thresholds.

No open item was used to excuse B1 or B2; both are current security/governance architecture gaps and therefore blocking.

## Not Run / out of scope

- no implementation/build/tests exist for vNext yet;
- no production Cloudflare/R2/DNS/Worker mutation;
- no provider resource read-back/cutover test;
- no migration execution;
- no legacy code deletion;
- no design adoption/status promotion.

## Verdict

**FAIL — P0=0 / P1=2 / P2=1**

Design remains `PRE_FREEZE_REVIEW`. Implementation/migration/provider activation remain blocked. Remediation must occur in a separate pass and a new exact revision must receive a fresh clean-room audit before Design Freeze can pass.
