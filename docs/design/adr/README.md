---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# Architecture Decision Records

ADR は「なぜその設計を選んだか」を保存する historical decision record であり、current architecture の SoT ではない。

現在仕様は `docs/README.md` の Source of Truth Map から canonical document を読む。

## Status

- `proposed`: review 中
- `accepted`: 採用済み
- `superseded`: 後続 ADR に置換
- `rejected`: 検討したが不採用

accepted ADR を current implementation に合わせて書き換えない。設計変更は新 ADR を作り、旧 ADR を superseded にする。

## Initial records

- `0001-static-first-astro-and-cloudflare-static-assets.md`
- `0002-react-only-for-interactive-islands.md`
- `0003-tailwind4-and-css-design-tokens.md`
- `0004-documentation-sot-and-legacy-separation.md`
- `0005-build-time-node-only.md`
- `0006-no-client-router-by-default.md`
- `0007-csp-compatible-static-client-code.md`
- `0008-normalize-source-media-and-optimize-delivery.md`
- `0009-cache-by-artifact-identity.md`
- `0010-ai-first-article-job.md`
- `0011-generated-hero-is-non-evidence.md`
- `0012-greenfield-vnext-and-git-legacy-archive.md`
