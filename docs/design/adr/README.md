---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# Architecture Decision Records

ADRは「なぜその設計を選んだか」を保存するdecision recordであり、current architectureのSoTではない。

現在仕様は`docs/README.md`のSource of Truth Mapからcanonical documentを読む。

## Status

- `proposed`: review中
- `accepted`: 採用済み
- `superseded`: 後続ADRに置換
- `rejected`: 不採用

accepted ADRをcurrent implementationに合わせて書き換えない。設計変更は新ADRを作り、旧ADRをsupersedeする。

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
- `0013-npm-workspaces-separate-site-and-authoring-toolchain.md`
- `0014-r2-first-content-media.md`
- `0015-publish-content-media-only-after-human-approval.md`
- `0016-pagefind-extended-for-static-search.md`
- `0017-isolate-technical-example-execution.md`
- `0018-protect-r2-media-before-repository-export.md`
- `0019-git-driven-cloudflare-control-plane.md`
