---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# Architecture Decision Records

ADRはdecision rationale/historyを保存し、current specificationは`docs/README.md`のSoT Mapからcanonical documentを読む。

## Status

- `proposed`: review中・未採用
- `accepted`: 明示採用済み
- `superseded`: accepted decisionが後続accepted decisionへ置換された履歴
- `rejected`: 検討したが採用しなかったproposal

Accepted ADRをcurrent implementationに合わせて後書き修正しない。Material decision changeはnew ADR + explicit supersede relationship。

Current vNext Design=`PRE_FREEZE_REVIEW`なので、以下の大半はまだProposed。存在するだけで採用済みとは扱わない。

## Records

- `0001-static-first-astro-and-cloudflare-static-assets.md`
- `0002-react-only-for-interactive-islands.md`
- `0003-tailwind4-and-css-design-tokens.md`
- `0004-documentation-sot-and-legacy-separation.md`
- `0005-node-build-authoring-not-production-runtime.md`
- `0006-no-client-router-by-default.md`
- `0007-csp-compatible-static-client-code.md`
- `0008-normalize-source-media-and-optimize-delivery.md`
- `0009-cache-by-artifact-identity.md`
- `0010-ai-first-article-job.md`
- `0011-generated-hero-is-non-evidence.md`
- `0012-greenfield-vnext-and-git-legacy-archive.md`
- `0013-npm-workspaces-separate-site-and-authoring-toolchain.md`
- `0014-r2-first-content-media.md`
- `0015-publish-content-media-only-after-human-approval.md`
- `0016-pagefind-extended-for-static-search.md` — **Rejected**; replacement proposal ADR-0021
- `0017-isolate-technical-example-execution.md`
- `0018-protect-r2-media-before-repository-export.md`
- `0019-git-driven-cloudflare-control-plane.md`
- `0020-separate-indefinitely-locked-protected-media-bucket.md`
- `0021-minisearch-with-deterministic-japanese-tokenizer.md`
- `0022-store-private-canonical-media-not-raw-originals.md`
- `0023-stable-content-id-separate-from-route.md`
- `0024-ephemeral-article-job-with-durable-compact-lineage.md`
- `0025-clean-room-phase-gate-and-design-lifecycle.md`
- `0026-explicit-external-ai-input-admission.md`
- `0027-portable-mdx-and-managed-content-registries.md`

## Adoption

Design Freeze acceptance時だけ、採用するproposalを`accepted`へ明示promoteする。Rejected proposalをaccepted historyに書き換えない。
