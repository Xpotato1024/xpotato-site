---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# Contracts

`contracts/` は implementationへ落とすstable interface / field semanticsを保持する。

current machine-readable valueは実装時のTypeScript / Zod registry / schemaを正とし、このdirectoryは意味・constraint・ownershipを定義する。

## Contracts

- `article-job-contract.md`
- `source-evidence-claim-contract.md`
- `blog-frontmatter-contract.md`
- `taxonomy-registry-contract.md`
- `media-asset-registry-contract.md`
- `visual-artifact-contract.md`
- `media-ingest-contract.md`
- `ai-exchange-execution-contract.md`
- `content-module-contract.md`
- `candidate-approval-contract.md`

## Rule

contract変更で既存content / Article Job artifactが壊れる場合はmaterial changeとし、migration / versioningを同時に設計する。
