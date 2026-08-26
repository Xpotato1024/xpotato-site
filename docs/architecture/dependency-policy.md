---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - dependency policy
  - Node build toolchain policy
---

# Dependency and Toolchain Policy

## Node.js

Node.jsはAstro/Vite/npmとvNext authoring toolsを実行するbuild/authoring toolchainであり、production server runtime requirementではない。

vNext baselineはNode 24 LTS。exact patch versionはmachine-readable toolchain/build imageをSoTとする。

## npm workspaces

initial:

- `apps/site`
- `packages/content-contracts`
- `packages/article-pipeline`
- `packages/media-ingest`
- `packages/example-verifier`
- `packages/site-validators`

package数を増やすこと自体を目的にしない。

## Package manager

npm継続。root `package-lock.json`が唯一のlockfile、CIは`npm ci`。

## Production site dependencies

`apps/site`にはpublic build/renderに必要なdependencyだけを置く。

initial categories:

- Astro
- MDX
- React integration for interactive islands
- Tailwind 4 Vite integration
- sitemap/feed utilities
- build-time remark/HTML extraction utilities where required
- MiniSearch 7.2.0 for route-local static search
- shared `content-contracts`

禁止方向:

- AI/image provider SDK
- HEIC native toolchain
- sandbox execution runtime
- Article Job orchestrator/storage

## Framework/search policy

- Astro: supported current major
- React: interactive island only
- Tailwind: v4 Vite plugin
- Zod: shared contract SoT
- MiniSearch: exact 7.2.0 initial pin, `/search/` only runtime
- search tokenizer: repository-owned `xpotato-ja-tech-bigram-v1`, not third-party locale dictionary
- UI framework / CSS-in-JS runtime defaultなし

Pagefind ADR-0016はJapanese index/query tokenization mismatchを理由にADR-0021でsuperseded。

## MiniSearch boundary

MiniSearchはbuild-time serialized index generator + `/search/` route runtime。

- generated indexをGitへcommitしない
- normal article routeへMiniSearch/search moduleをimportしない
- exact versionをlockfileへpin
- build/browserでsame repository tokenizer sourceを共有
- index generation failureをsilent ignoreしない
- search engine変更でcontent/frontmatter schemaを書き換えない

## Provider SDK boundary

text/image AI provider SDKは`packages/article-pipeline` provider adapterへ閉じ込める。

`content-contracts`/`apps/site`へprovider-specific typeを漏らさない。

standard HTTPだけで十分ならSDK追加を必須にしない。

## Example verifier boundary

technical execution dependencyは`packages/example-verifier`だけ。

initial profileは`operations/technical-example-profiles.md`。

- execution runtimes/container imagesをversioned
- site runtimeへPython/PowerShell/SQLite等を依存させない
- semantic AIからsandbox runnerを直接importしない

## Native media boundary

HEIC decode / lossless canonical raster / AVIF/WebP/JPEG generation dependencyは`packages/media-ingest` specialized toolchain/containerへ閉じ込める。

site buildがnative media libraryを要求しない。

## Dependency admission

new dependencyは:

- workspace responsibilityに閉じる
- browser/platform standardより価値が明確
- client payloadを不要に増やさない
- maintenance/license/security surfaceが許容
- replacement/removal pathが理解できる

ことを確認する。

## Version pinning

- npm resolved versions: root lockfile
- native/tool/container: versioned toolchain/profile
- AI model: execution profile
- browser search tokenizer: source hash + tokenizer ID

## Upgrade validation

major/material update:

- upstream migration/release note確認
- affected workspace tests
- generated schema consistency
- Astro build
- MiniSearch Japanese/technical regression fixture
- media profile/toolchain fixture where affected
- representative integration smoke

を通す。

## Build container

local standardとしてrepository-defined Node build/dev containerを提供できる。

media-ingest / example-verifier specialized containerは通常Node dev containerと分離する。

## Production

production artifactにNode process、npm、node_modules、AI authoring/native media/example verifier toolchainを配置しない。

production = static site deploy artifact + public R2 delivery media。
