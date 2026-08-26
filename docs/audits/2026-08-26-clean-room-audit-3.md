---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# Clean-room Phase-gate Audit #3 — 2026-08-26

## Audit identity

- audited site revision: `7e0e6d605c36a544bb4001191c5bdb1cae5001e4`
- audited infra counterpart: `Xpotato1024/Xpotato-Server@6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d`
- audit mode: read-only until findings/verdict frozen
- verdict: **FAIL — P0=0 / P1=3 / P2=1**

This report is written after the read-only pass ended. The commit containing this report is not the audited site revision。

## Evidence boundary

Followed the audited revision’s `governance/audit.md`:

- exact site revision only
- exact SHA-pinned infra counterpart only
- no past chat/model memory/uncommitted intent/legacy target inference
- audit reports treated as historical/non-authoritative

A pre-existing historical Audit #2 report was discovered during this pass. Its findings were not adopted as current findings unless independently reproduced from this exact audited revision。

## Positive observations

The exact audited revision cleanly reconstructs:

- Design=`PRE_FREEZE_REVIEW`; implementation/migration/provider mutation blocked
- local severity/clean-room governance
- exact infra SHA/status handoff
- infra ADR-0024 Proposed + website provider mutation blocked + no proposed website exact values in active desired inventory
- stable UUIDv4 ContentId
- object-storage-first media with raw/canonical/public/protected semantic separation
- visual audit before delivery variants
- human approval before persistent media operations
- cleanup-safe material claim -> evidence/source lineage
- cleanup-safe protected media recovery binding
- MiniSearch proposal / Pagefind rejected history
- isolated example-verifier workspace and explicit Article Job persistent-operation permissions
- manual publishing Skill aligned with current vNext boundaries

## Findings

### C1 — P1 — Public media publication contract has stale state/permission semantics

**Evidence**

State machine and ADR-0015 define:

```text
HUMAN_APPROVED
 -> MEDIA_SOURCE_STORED
 -> MEDIA_PUBLISHED
```

and public publication failure remains at `MEDIA_SOURCE_STORED`。

`contracts/public-media-publication-contract.md` still:

- omits mandatory canonical-source storage from publication timing
- permits its request immediately after human approval wording
- says partial publication failure leaves state at `HUMAN_APPROVED`
- does not explicitly require ArticleJobSpec `publicMediaUpload=true` when public media exists

**Failure mode**

An implementation can bypass source persistence or build incorrect retry transitions despite following an authoritative public-media contract。

**Done condition**

Make the public-media contract legal for Article Job only from `MEDIA_SOURCE_STORED`, require `publicMediaUpload=true` for required public media, preserve validated empty media semantics, keep failure at `MEDIA_SOURCE_STORED`, and bind source-storage/candidate/approval identity into publication request/manifest validation as applicable。

---

### C2 — P1 — External-AI input disclosure/admission is not machine-representable

**Evidence**

- Product/authoring/security documents require a private/public boundary and deterministic secret/private scope validation.
- `ArticleJobSpec.permissions` has broad `externalTextAI` / `externalImageAI` booleans.
- `SourceRecord.publicSafe`/citation eligibility govern publication, not provider disclosure.
- `SemanticRequestEnvelope.inputArtifacts` has no per-input disclosure/admission manifest.

**Failure mode**

A clean-room implementation can interpret `externalTextAI=true` as either “all fixed sources may be sent externally” or “private sources are always excluded”, yielding either privacy leakage or inability to use explicitly authorized private data. Search queries, image inputs, and derived prompts can also disclose private data without a canonical admission rule。

**Done condition**

Add a canonical external-AI disclosure contract and material ADR. At minimum:

- classification independent from publication/citation safety
- deny-by-default for non-public/unknown disclosure
- explicit per-input/representation admission (`deny` / metadata-only / redacted-derived / full as appropriate)
- credential/secret hard-deny
- allowed stage/use binding
- deterministic external-request disclosure manifest covering every user/source-derived byte sent to provider/search/image/vision
- request importer/runner validation against that manifest
- safe compact disclosure-policy lineage without private bodies
- local/BLOCKED fallback when required input is not externally admissible

---

### C3 — P1 — Durable portable content-authoring architecture lacks a material ADR

**Evidence**

Current content architecture/contracts choose:

- portable Markdown/MDX first
- stable version-controlled taxonomy registry IDs rather than free-form route-generating terms
- unknown taxonomy no silent create/fallback
- approved semantic content modules rather than arbitrary article runtime imports/layout code
- Interactive Module Registry instead of embedding React source/hydration paths in MDX
- system-derived presentation/discovery/provider metadata instead of implementation paths in article source

These choices materially affect legacy migration and future content rewrite cost, but ADR index has no decision record owning the rationale/alternatives。

**Failure mode**

A future design change can replace the portable/controlled content model with free-form taxonomy/arbitrary MDX imports/runtime-coupled metadata without a historical accepted rationale or migration/revisit boundary, despite requiring broad content migration。

**Done condition**

Add a material ADR covering portable MDX-first content, controlled taxonomy registries, approved semantic modules, Interactive Module Registry, system-derived implementation metadata, alternatives, consequences, and revisit triggers. Exact seed values/individual module props remain contract/profile details。

---

### C4 — P2 — Dependency policy uses wrong Pagefind lifecycle term

ADR-0016 is `Rejected`; ADR-0021 is the current Proposed MiniSearch replacement. `architecture/dependency-policy.md` still says ADR-0016 was “superseded” by ADR-0021。

**Done condition**

Change wording to Rejected + current Proposed replacement。

## Open decisions

Performance budgets, visual style, Comparison child API, legacy tag exact string, provider exact versions/permissions/cutover, future GC, and interactive bundle thresholds remain measurement/provider-detail items. None were used to excuse the P1 findings。

## Not Run

No vNext implementation/build/test/provider mutation/migration/legacy deletion/adoption was performed。

## Verdict

**FAIL — P0=0 / P1=3 / P2=1**

Design remains `PRE_FREEZE_REVIEW`. Separate remediation and a fresh clean-room Audit #4 are required before Design Freeze can pass。
