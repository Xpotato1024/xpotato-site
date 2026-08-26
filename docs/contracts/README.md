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

## Content modules / discovery

- `content-module-contract.md`
- `interactive-module-registry-contract.md`
- `content-discovery-contract.md`

## Article Job / evidence / approval / provenance

- `article-job-contract.md`
- `article-update-contract.md`
- `source-evidence-claim-contract.md`
- `citation-export-contract.md`
- `technical-example-verification-contract.md`
- `ai-exchange-execution-contract.md`
- `candidate-approval-contract.md`
- `publication-provenance-contract.md`

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
- canonical media source identity/profile
- publication/protection hashes
- compact protected-object recovery references when media exists

Bundle/receipt **hash alone** is insufficient when the underlying job artifact holding required semantic/recovery data will be removed。

## Migration

- `migration-inventory-contract.md`

## Rule

A contract change that breaks existing content/artifact/registry semantics is a material design change and requires versioning/migration/ADR as applicable。

Do not duplicate the same field/schema into multiple documents as separate authorities; cross-reference one owner。
