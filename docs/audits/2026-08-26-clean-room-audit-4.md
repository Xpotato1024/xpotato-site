---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# Clean-room Phase-gate Audit #4 — 2026-08-26

## Audit identity

- audit kind: Design Freeze phase-gate / clean-room
- audited site revision: `1cf7664d3d4b54f8cd5032c179d9240fa8c2e721`
- audited infrastructure counterpart: `Xpotato1024/Xpotato-Server@6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d`
- infrastructure ADR: `docs/decisions/ADR-0024-website-cloudflare-control-plane-and-media-protection.md`
- audit mode: read-only until findings/verdict fixed
- verdict: **PASS — P0=0 / P1=0 / P2=3**

This report was created only after the read-only audit ended. The commit containing this report is not the audited site revision。

## Evidence boundary

Used as design authority:

1. audited revision `AGENTS.md`;
2. `docs/README.md` and reachable proposed/canonical SoT;
3. ADRs/status at audited revision;
4. exact repository contracts/operations/migration/Skills needed for scope;
5. exact SHA-pinned infrastructure counterpart from `architecture/infrastructure-handoff.md`;
6. authoritative current upstream docs only for time-sensitive provider/model facts, not to fill missing repository intent。

Not used to fill design gaps:

- prior chat/model memory;
- uncommitted intent;
- legacy `doc/`/old README as target authority;
- mutable branch head as counterpart authority;
- Issue/PR discussion as specification substitute。

## Blocking-remediation verification

### Audit #3 public media state mismatch — CLOSED

Current Article Job state/operations/publication contract agree:

```text
HUMAN_APPROVED
 -> MEDIA_SOURCE_STORED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

Public media publication is legal only from `MEDIA_SOURCE_STORED` when public media is required。Failure remains `MEDIA_SOURCE_STORED`; success advances to `MEDIA_PUBLISHED`。Protection failure remains `MEDIA_PUBLISHED`。

Migration uses a typed operator authorization rather than fabricating Article Job human approval, while preserving source -> public -> protection ordering。

### Audit #3 external-AI input admission — CLOSED

ADR-0026 and the external-AI disclosure contract now define a material trust boundary separate from provider-use permission。

Confirmed design:

- `externalTextAI=true` / `externalImageAI=true` are provider-use upper bounds only;
- each exact source/artifact representation has an independent disclosure record;
- private/unknown disclosure defaults deny;
- actual secret-bearing bytes are hard-deny;
- `publicSafe`, citation eligibility, trust class, public URL availability are not disclosure authority;
- `allow_derived_only` permits only a local admitted derivative, not raw source;
- every external semantic/vision/image request binds an exact `ExternalAiDisclosureManifest`;
- manifest entry set must equal actual outbound provider input artifact set;
- provider adapter cannot append hidden context after manifest compilation;
- denied required evidence cannot be silently omitted and still be presented as complete;
- request/run lineage records the disclosure manifest hash;
- full private disclosure inventory may be cleaned later while safe policy/manifest/run hashes remain durable。

This boundary is wired through Product AI authoring context, ArticleJobSpec, SourceRecord, AI exchange, state machine, security policy, validation, operations, artifact model, provenance, and retention policy。

### Audit #3 missing durable content-model ADR — CLOSED

ADR-0027 now owns the material durable authoring decision:

- portable Markdown/MDX first;
- stable managed taxonomy registry IDs rather than free-form route-generating terms;
- approved semantic content modules rather than arbitrary article runtime imports/layout code;
- Interactive Module Registry for Tool/Demo runtime binding;
- provider/storage/runtime/search/SEO implementation fields are derived/registry-owned rather than durable article source;
- legacy implementation-coupled fields require deliberate migration rather than becoming a second authoring API。

Exact taxonomy seeds/module props remain contract/profile concerns, not ADR facts。

### Audit #3 Pagefind lifecycle drift — CLOSED

ADR-0016 is `Rejected` and explicitly states it was never accepted。ADR-0021 is the Proposed MiniSearch replacement。Dependency policy and validation use the same lifecycle language。

## Other material checks

### Lifecycle / clean-room governance

- Design=`PRE_FREEZE_REVIEW`;
- implementation/migration/provider activation BLOCKED;
- exact audit/remediation separation is repository-local;
- P0/P1 blocking, P2 deferrable;
- PASS does not auto-promote docs/ADRs or open implementation。

### Infrastructure counterpart

Exact counterpart `6d0a4e0...` states:

- infra global Architecture v3 remains FROZEN;
- website vNext is a Proposed post-Freeze sub-gate;
- provider mutation is BLOCKED;
- infra ADR-0024 is Proposed;
- new website vNext provider exact values are not present in active `inventory/desired/cloudflare.yaml`。

Site handoff matches these facts and uses exact SHA rather than mutable branch authority。

### Media / recovery / cleanup

- raw camera/provider original is not site long-term SoT;
- privacy-normalized canonical source is future re-encode authority;
- deterministic prebuilt delivery variants are baseline;
- persistent media mutation begins after exact human approval;
- public delivery is not the only recovery copy;
- protected exact bytes have a compact secret-free recovery binding in Git before cleanup;
- receipt hash alone is not cleanup-safe recovery state;
- cleanup cannot delete full receipt/evidence/private job artifacts until durable claim/recovery/run lineage and exact durable Git ref validate。

### Content claims / citations / examples

- material claim support remains cleanup-safe through `CompactMaterialClaimBinding` + `CompactSourceRef`;
- citation representation and evidence support remain separate;
- private source can be evidence while non-citable;
- external-AI disclosure is a third independent dimension;
- technical examples have explicit verification classes and isolated execution boundary。

### Search

- MiniSearch 7.2.0 + repository-owned deterministic tokenizer remains target;
- same tokenizer source for build/query;
- search runtime localized to `/search/`;
- Pagefind-class Japanese mismatch retained as regression fixture rather than current implementation dependency。

### Current AI execution profile

Current official OpenAI API documentation was checked during this audit for time-sensitive model identity only。The configured IDs `gpt-5.6-sol`, `gpt-5.6-terra`, and GPT-Image-2 snapshot `gpt-image-2-2026-04-21` were valid at audit time。This does not make provider facts permanent architecture semantics; implementation/update still revalidates current provider state。

## P2 findings

### D1 — P2 — Design-status audit review history is stale

**Evidence**

`architecture/design-status.md` Current review basis records only Clean-room Audit #1 even though historical Audit #2/#3 reports exist and Audit #4 has now completed。

**Impact**

Current lifecycle remains unambiguous (`PRE_FREEZE_REVIEW`, all implementation/provider gates blocked), so this does not change behavior or phase correctness。It reduces human/auditor visibility into the latest review chain。

**Done condition**

Update design-status with a concise chronological audit history/current latest phase-gate result using exact audited revisions。Do not infer Design Freeze from PASS。

---

### D2 — P2 — Initial external-AI disclosure policy profile is not yet pinned

**Evidence**

The disclosure contract and ArticleJobSpec require `policyId` + `policySha256` and exact request admission, while the exact initial repository/system policy instance/file is not yet named as a concrete profile SoT。

**Why not P1**

The architecture is fail-closed:

- private/unknown disclosure defaults deny;
- hard-secret bytes are denied;
- no external request can proceed without a valid policy/record/manifest;
- missing policy therefore blocks execution instead of allowing unsafe disclosure。

Thus current security/correctness is deterministic even without a launch convenience/default policy instance。

**Done condition**

Create/version an initial disclosure policy profile before external Article Job provider activation, defining at least:

- exact system/repository admission for ordinary public source/job-context classes;
- user/private default deny;
- hard-deny secret classes;
- derived-only rules;
- policy ID/hash and machine SoT location;
- validation fixtures。

---

### D3 — P2 — Secondary pipeline/migration/layout summaries lag ADR-0026

**Evidence**

Core authorities are consistent, but some secondary summaries still omit explicit disclosure-admission steps/ownership:

- `architecture/article-pipeline.md` top-level pipeline does not explicitly show external request admission or durable disclosure run lineage;
- `architecture/repository-layout-vnext.md` workspace ownership lists do not call out disclosure policy/records/manifests;
- `migration/greenfield-rebuild-plan.md` Article Job implementation order does not explicitly list external disclosure policy/admission before external semantic providers。

**Impact**

No functional bypass exists because AGENTS, ArticleJobSpec, state machine, AI operating model, AI exchange contract, validation, security policy, operations, and retention require disclosure admission。This is documentation completeness/readability drift, not a security ambiguity。

**Done condition**

Synchronize these summary documents to ADR-0026 without creating a second disclosure SoT。

## Open decisions reviewed

The remaining performance budgets, visual style, Comparison child API, exact legacy tag string, provider version/permission pins, future GC, and interactive bundle thresholds remain measurement/provider-stage parameters rather than Design Freeze blockers。

## Not Run / out of scope

- no vNext implementation/build/test suite yet;
- no production provider mutation;
- no R2/DNS/Worker creation/read-back;
- no migration execution;
- no legacy deletion;
- no Design Freeze/adoption promotion。

## Verdict

**PASS — P0=0 / P1=0 / P2=3**

Design may proceed to explicit operator Design Freeze **only after the operator chooses to accept the design**。This audit itself does not change `PRE_FREEZE_REVIEW`, promote ADRs/docs, or open implementation/provider gates。
