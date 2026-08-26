---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# Contracts

`contracts/`はimplementationへ落とすstable interface / field semanticsを保持する。

implementation後のmachine-readable shape/valueは`packages/content-contracts`等のTypeScript/Zod/configを正とし、このdirectoryは意味・constraint・ownershipを定義する。

## Content identity / routes / metadata

- `content-identity-contract.md`
- `route-slug-redirect-contract.md`
- `blog-frontmatter-contract.md`
- `collection-frontmatter-contracts.md`
- `site-configuration-contract.md`
- `taxonomy-registry-contract.md`

## Content modules / discovery / runtime

- `content-module-contract.md`
- `interactive-module-registry-contract.md`
- `content-discovery-contract.md`

## Article Job / evidence / verification

- `article-job-contract.md`
- `article-update-contract.md`
- `source-evidence-claim-contract.md`
- `citation-export-contract.md`
- `technical-example-verification-contract.md`
- `ai-exchange-execution-contract.md`
- `candidate-approval-contract.md`
- `publication-provenance-contract.md`

## Media

- `media-ingest-contract.md`
- `media-variant-generation-contract.md`
- `media-publication-rights-contract.md`
- `media-asset-registry-contract.md`
- `visual-artifact-contract.md`
- `public-media-publication-contract.md`
- `published-media-protection-contract.md`
- `media-recovery-contract.md`

Responsibility split:

```text
source/raw
 -> media ingest / normalized master
 -> deterministic responsive variants
 -> rights/provenance
 -> private candidate
 -> human approval
 -> public R2 master/variant publication
 -> protected recovery receipt
 -> Git Media Registry/provenance export
```

`published-media-protection`はpublication-time hard gate、`media-recovery`は欠損後のrestore semantics。receipt schemaを二重定義しない。

## Migration

- `migration-inventory-contract.md`

## Rule

contract変更で既存content / Article Job artifact / Media Registryが壊れる場合はmaterial changeとし、migration / versioningを同時に設計する。

同一field/schemaを複数contractへcopyしてsecond SoT化しない。cross-contract referenceを使う。
