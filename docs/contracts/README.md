---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# Contracts

`contracts/` holds implementation-ready stable interface/field semantics。After implementation, exact machine shape/value is owned by the TypeScript/Zod/config location named by each design contract。

## Content / identity / routes

- `content-identity-contract.md`
- `route-slug-redirect-contract.md`
- `blog-frontmatter-contract.md`
- `collection-frontmatter-contracts.md`
- `site-configuration-contract.md`
- `taxonomy-registry-contract.md`

The durable content-authoring decision is ADR-0027: portable Markdown/MDX + managed taxonomy/semantic/interactive registries, not arbitrary runtime/provider paths embedded in content。

## Content modules / discovery

- `content-module-contract.md`
- `interactive-module-registry-contract.md`
- `content-discovery-contract.md`

## Article Job / evidence / approval / provenance

- `article-job-contract.md`
- `article-update-contract.md`
- `external-ai-disclosure-contract.md`
- `source-evidence-claim-contract.md`
- `citation-export-contract.md`
- `technical-example-verification-contract.md`
- `ai-exchange-execution-contract.md`
- `candidate-approval-contract.md`
- `publication-provenance-contract.md`

### External AI disclosure

ADR-0026 / `external-ai-disclosure-contract.md` separates:

- permission to use an external AI provider;
- permission to disclose each exact source/artifact representation to that provider。

Unknown/private disclosure defaults deny。Actual secret-bearing material is hard-deny。Every external text/vision/image request must bind an exact disclosure manifest whose artifact set equals the actual outbound provider input set。

`publicSafe`, citation eligibility, source trust class, or `externalTextAI=true` are not disclosure authority。

Detailed disclosure records/manifests may remain private job artifacts; long-term Git provenance keeps only safe policy/manifest/run hashes as needed, not private source bodies or secret-bearing authorization details。

### Durable evidence lineage

Detailed claim/evidence/source artifacts may be job-private, but published material claims must be transformed to cleanup-safe durable compact bindings before export/cleanup。

## Media

- `media-ingest-contract.md` — raw input -> privacy-normalized canonical master
- `private-canonical-media-storage-contract.md` — approved canonical master -> private future-reprocessing source plane
- `media-variant-generation-contract.md` — audited canonical master -> deterministic delivery artifacts
- `media-publication-rights-contract.md`
- `media-asset-registry-contract.md`
- `visual-artifact-contract.md`
- `public-media-publication-contract.md` — approved delivery objects -> public plane
- `published-media-protection-contract.md` — exact public bytes -> protected recovery plane/full receipt
- `media-recovery-contract.md` — restore using durable compact recovery binding

Normal media flow:

```text
raw/job input
 -> canonical master
 -> visual audit
 -> delivery variants
 -> private candidate
 -> human approval
 -> canonical source storage
 -> public delivery publication
 -> protected exact-byte copy/full receipt
 -> compact mediaRecovery binding
 -> Git Media Registry/Publication Provenance export
```

Raw camera original is not copied unchanged into canonical source storage。

Private canonical source = future re-encoding authority。
Protected delivery copy = exact published-byte recovery authority。

## Cleanup-safe export

Before full Article Job workspace can be deleted, Git durable state must include at least:

- exact approved content identity/hashes
- compact SourceRefs
- compact material-claim evidence/source bindings
- safe external-AI disclosure policy/manifest/run hash lineage where external providers were used
- canonical media source identity/profile
- publication/protection hashes
- compact protected-object recovery references when media exists

Bundle/receipt/manifest **hash alone** is insufficient when the underlying job artifact holds required semantic/recovery data that would otherwise disappear。Conversely, private source/disclosure bodies are not retained when only safe lineage hashes are required。

## Migration

- `migration-inventory-contract.md`

## Rule

A contract change that breaks existing content/artifact/registry semantics is a material design change and requires versioning/migration/ADR as applicable。

Do not duplicate the same field/schema into multiple documents as separate authorities; cross-reference one owner。
