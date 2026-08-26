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

vNext baselineはNode 24 LTS。host OSへの常設Node installationを必須にせず、repository-defined container / CI / provider buildで再現可能にする。

exact patch versionはmachine-readable toolchain file / build imageをSoTとする。

## npm workspaces

vNextはnpm workspacesを使用し、runtime / authoring / execution dependency boundaryを物理化する。

initial workspaces:

- `apps/site`
- `packages/content-contracts`
- `packages/article-pipeline`
- `packages/media-ingest`
- `packages/example-verifier`
- `packages/site-validators`

package数を増やすこと自体を目的にしない。

## Package manager

npm継続。root `package-lock.json`を唯一のlockfileとする。

CI/reproducible buildは`npm ci`。

`package.json`に`engines` / `packageManager`等を必要に応じてmachine-readableに固定する。

workspace配下へ独立lockfileを作らない。

## Production site dependencies

`apps/site`に許容するのはpublic siteのbuild/renderに必要なdependencyだけ。

initial architecture categories:

- Astro
- MDX integration
- React integration for interactive islands
- Tailwind 4 Vite integration
- sitemap/feed support where adopted
- build-time Markdown/remark utilities where required
- Pagefind build/search integration
- shared `content-contracts`

禁止方向:

- AI provider SDK
- image generation SDK
- HEIC native toolchain
- sandbox execution runtime
- Article Job storage/orchestrator

## Framework policy

- Astro: supported current majorを追従。major updateを長期放置しない
- React: interactive islandのみ
- Tailwind: v4 Vite plugin。deprecated Astro Tailwind integration禁止
- Zod: shared machine-readable contract SoT
- Pagefind Extended: static search build artifact生成に利用。exact pinned versionはimplementation時SoT
- UI component framework / CSS-in-JS runtimeはdefault依存にしない

## Pagefind boundary

Pagefindはbuild-time/post-build search artifact tool + `/search/` client runtime。

- indexをGitへcommitしない
- normal article routeへPagefind runtimeをimportしない
- Pagefind package/binary versionをlockfileへpin
- Pagefind failureをsearch enabled production buildでsilent ignoreしない

search engine変更でcontent/frontmatter schemaを書き換えない。

## Provider SDK boundary

text/image AI provider SDKは`packages/article-pipeline`のprovider adapterへ閉じ込める。

`content-contracts`や`apps/site`へprovider-specific typeを漏らさない。

provider adapterがHTTP standardだけで十分な場合、SDK追加自体を必須にしない。

## Example verifier boundary

technical example executionのdependencyは`packages/example-verifier`へ閉じ込める。

language/runtime/compilerを大量にNode dependencyとして常設しない。

execution profileごとに:

- container image
- external pinned tool
- minimal workspace dependency

等へ分離できる。

`apps/site` / semantic Skillからsandbox runnerをimportしない。

## Native media boundary

HEIC decode等のnative dependencyは`packages/media-ingest` / dedicated containerへ閉じ込める。

site buildがHEIC native dependencyを要求しない。

## Content/tooling libraries

new dependencyは「authoring convenience」だけを理由にsite runtimeへ入れない。

例:

- citation parser/remark plugin -> build-only site dependency候補
- JSON Schema generation -> content-contracts dev dependency
- image EXIF tool -> media-ingest only
- GitHub/API clients -> article-pipeline only

## Dependency admission

新規dependencyは:

- browser/platform standardより保守性が明確に高い
- target workspace責務に閉じる
- client payloadを不必要に増やさない
- maintenance/release activityを確認
- license整合
- transitive dependency/security surfaceが価値に見合う
- replacement/removal pathが理解できる

ことを確認する。

小utilityのための大型packageを避ける。

## Version pinning

### Lockfile

exact resolved package versionは`package-lock.json`。

### Tool/container

Node外toolはversioned toolchain/profileでidentityを固定する。

例:

- HEIC decoder/container
- example verifier runtime image

### AI model

npm dependencyではない。provider execution profileでmodel/snapshotを固定する。

## Upgrade cadence

Dependabot/Renovate等は導入候補。

major update:

- upstream release/migration guide確認
- affected workspace tests
- generated schema consistency
- site build/Pagefind
- representative integration smoke

を通してからmerge。

framework majorをold pinのままcurrent docsと乖離させない。

## Build container

local developmentの標準入口としてrepository root mountのNode build/dev containerを提供できる。

READMEへ特定PC absolute pathをcanonical commandとして固定しない。

media-ingest / example-verifierのspecialized containerは通常Node dev containerと分離する。

## Production

production artifactにNode process、npm、node_modules、authoring toolchainを配置しない。

productionはstatic site deploy artifact + external R2 mediaだけを基本とする。
