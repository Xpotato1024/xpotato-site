---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# Contracts

`contracts/`はimplementationへ落とすstable interface / field semanticsを保持する。

implementation後のmachine-readable shape/valueは`packages/content-contracts`等のTypeScript/Zod/configを正とする。

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

- `media-ingest-contract.md` — raw/source -> privacy-normalized canonical master
- `private-canonical-media-storage-contract.md` — approved canonical master -> private reprocessing source plane
- `media-variant-generation-contract.md` — canonical master -> public delivery derivatives
- `media-publication-rights-contract.md`
- `media-asset-registry-contract.md`
- `visual-artifact-contract.md`
- `public-media-publication-contract.md` — delivery master/variants -> public plane
- `published-media-protection-contract.md` — exact public bytes -> private protected recovery plane
- `media-recovery-contract.md`

flow:

```text
raw/job input
 -> privacy-normalized canonical master
 -> visual audit
 -> deterministic delivery variants
 -> private candidate
 -> human approval
 -> private canonical source storage
 -> public delivery publication
 -> protected exact-byte copy
 -> Git Media Registry/provenance export
```

raw camera originalはprivate canonical source storageへそのまま保存しない。

`private-canonical-media-storage`はfuture re-encoding source、`published-media-protection`はcurrent exact public-byte recovery。役割を混同しない。

## Migration

- `migration-inventory-contract.md`

## Rule

contract変更でexisting content/artifact/registryが壊れる場合はmaterial changeとしmigration/versioningを同時設計する。

同一field/schemaを複数contractへcopyしてsecond SoT化しない。
