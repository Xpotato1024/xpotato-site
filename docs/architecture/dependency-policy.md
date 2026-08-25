---
status: proposed
owner: architecture
last_verified: 2026-08-25
canonical_for:
  - dependency policy
  - Node build toolchain policy
---

# Dependency and Toolchain Policy

## Node.js

Node.js は Astro / Vite / npm を実行する build-time toolchain であり、production runtime requirement ではない。

vNext migration の baseline は Node 24 LTS とする。host OS への常設 Node installation を必須にせず、container と CI / Cloudflare build environment で再現できるようにする。

exact version は repository の machine-readable toolchain file と build image で pin し、この文書へ patch version を重複記載しない。

## Package manager

npm を継続し、`package-lock.json` を commit する。CI / reproducible build は `npm ci` を使用する。

`package.json` に `engines` と必要に応じて `packageManager` を持たせ、support range を機械可読にする。

## Framework policy

- Astro: supported current major を追従する。major update を長期放置しない。
- React: interactive island のためだけに保持する。React が不要になった場合は integration ごと削除可能。
- Tailwind: v4 Vite plugin。deprecated Astro Tailwind integration は使用しない。
- UI component framework / CSS-in-JS runtime は default dependency にしない。

## Dependency admission

新規 dependency は次を満たす場合だけ追加する。

- platform / browser standard だけで解決するより明確に保守性が高い
- page-wide client payload を不必要に増やさない
- maintenance / release activity を確認できる
- license が repository / public site の利用と整合する
- security surface と transitive dependency の増加が目的に見合う

小さな utility のためだけに大型 package を追加しない。

## Upgrade cadence

Renovate / Dependabot 等の自動 PR 導入は別途選べるが、major update は release note と migration guide を読み、`check` / `build` / smoke を通してから merge する。

framework major を pin したまま current docs と実装挙動が乖離する状態を避ける。

## Build container

local development は repository root を mount した build container を標準入口にできる。

README に特定 PC の absolute path を canonical command として固定しない。container definition / helper command を repository に置き、host path 非依存にする。

## Production

production に Node process、npm、node_modules を配置しない。production artifact は static `dist/` と provider configuration のみを基本とする。
