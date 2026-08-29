---
status: canonical
owner: architecture
last_verified: 2026-08-29
canonical_for:
  - ADR lifecycle index
  - frozen ADR adoption state
---

# Architecture Decision Records

ADRはdecision rationale/historyを保存し、current specificationは`docs/README.md`のSoT Mapからcanonical documentを読む。

## Status semantics

- `proposed`: review中・未採用
- `accepted`: 明示採用済み
- `superseded`: accepted decisionが後続accepted decisionへ置換された履歴
- `rejected`: 検討したが採用しなかったproposal

Accepted decisionの本文をcurrent implementationへ合わせて後書き変更しない。Material decision changeはnew ADR + explicit supersede relationship。

## Frozen baseline adoption

Operator Design Freeze decision: **2026-08-26**。

Adoption authority:

- `../freeze-manifest-2026-08-26.md`
- audited baseline: `f42e490c49bab795e6c15682611564ff0edd841c`
- Clean-room Audit #5: **PASS — P0=0 / P1=0 / P2=0**

The audited ADR files retain their pre-Freeze `status: proposed` bytes to preserve exact audit identity. For ADRs included in the frozen baseline, the Freeze Manifest is the current adoption-status authority。

New post-Freeze ADRs are **not** accepted by this manifest and must follow their own lifecycle。

## Records

### Accepted by 2026-08-26 Design Freeze

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

### Accepted after 2026-08-26 Design Freeze

Acceptance authority:

- ADR-0028/0029: `../amendment-acceptance-2026-08-29.md`
- ADR-0030: `../amendment-acceptance-adr-0030-2026-08-29.md`

The exact clean-room audited proposal bytes are retained; the acceptance records + `../../architecture/design-status.md` define their accepted lifecycle state。

- `0028-legacy-build-reproduction-equivalence.md` — **Accepted 2026-08-29**。
- `0029-legacy-unresolved-migration-evidence.md` — **Accepted 2026-08-29**。
- `0030-astro-react-island-uid-equivalence.md` — **Accepted 2026-08-29** after fresh design audit `PASS — P0=0 / P1=0 / P2=1`; the P2 was unrelated lifecycle wording drift and does not expand the accepted variance boundary。

### Rejected

- `0016-pagefind-extended-for-static-search.md` — **Rejected**; replaced by accepted ADR-0021 at Freeze。

## Post-Freeze changes

A material change to an accepted ADR decision requires a new ADR or explicit superseding ADR, affected SoT updates, clean-room review, and operator acceptance according to `../../architecture/design-status.md`。
