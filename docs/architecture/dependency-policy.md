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

Node.js は Astro / Vite / npm とvNext authoring toolsを実行する build / authoring toolchain であり、production server runtime requirement ではない。

vNext migration の baseline は Node 24 LTS とする。host OS への常設 Node installation を必須にせず、container と CI / Cloudflare build environment で再現できるようにする。

exact version は repository の machine-readable toolchain file と build image で pin し、この文書へ patch version を重複記載しない。

## npm workspaces

vNext repositoryはnpm workspacesを使用する。

目的はpackage数を増やすことではなく、production siteとAI/media authoring dependenciesのimport boundaryを物理化すること。

initial workspaces:

- `apps/site`
- `packages/content-contracts`
- `packages/article-pipeline`
- `packages/media-ingest`
- `packages/site-validators`

詳細は`repository-layout-vnext.md`。

## Package manager

npm を継続し、root `package-lock.json` を commit する。CI / reproducible build は `npm ci` を使用する。

`package.json` に `engines` と必要に応じて `packageManager` を持たせ、support range を機械可読にする。

Cloudflare production buildはsite workspaceだけをbuild targetとし、Article pipeline provider SDKをsite bundleへ含めない。

## Framework policy

- Astro: supported current major を追従する。major update を長期放置しない。
- React: interactive island のためだけに保持する。React が不要になった場合は integration ごと削除可能。
- Tailwind: v4 Vite plugin。deprecated Astro Tailwind integration は使用しない。
- Zod: shared content / pipeline contractのmachine-readable schema候補。
- UI component framework / CSS-in-JS runtime は default dependency にしない。

## Dependency admission

新規 dependency は次を満たす場合だけ追加する。

- platform / browser standard だけで解決するより明確に保守性が高い
- page-wide client payload を不必要に増やさない
- maintenance / release activity を確認できる
- license が repository / public site の利用と整合する
- security surface と transitive dependency の増加が目的に見合う
- workspace責務に閉じている

小さな utility のためだけに大型 package を追加しない。

## Provider SDK boundary

AI / image provider SDKは`article-pipeline` workspaceのprovider adapterへ閉じ込める。

`content-contracts`や`apps/site`へprovider-specific typeを漏らさない。

## Native media boundary

HEIC decode等のnative toolchainは`media-ingest` workspace / containerへ閉じ込める。

site buildがHEIC native dependencyを当然に要求する構造にしない。

## Upgrade cadence

Renovate / Dependabot 等の自動 PR 導入は別途選べるが、major update は release note と migration guide を読み、workspaceごとのcheck / build / smokeを通してから merge する。

framework major を pin したまま current docs と実装挙動が乖離する状態を避ける。

## Build container

local development は repository root を mount した build container を標準入口にできる。

README に特定 PC の absolute path を canonical command として固定しない。container definition / helper command を repository に置き、host path 非依存にする。

media-ingestのnative containerと通常Node development containerは責務が異なるため、必要なら分離する。

## Production

production に Node process、npm、node_modules を配置しない。production artifact は static site `dist/` と provider configuration のみを基本とする。
