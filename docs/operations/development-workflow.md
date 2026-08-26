---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - development workflow
---

# Development Workflow

## Branching

`main`へ直接commit/pushしない。feature branch + PR + CIを通す。

## Change classes

- `content-only`: MDX/editorial/taxonomy refs only, no new media bytes
- `media`: canonical source/variant/profile/registry/publication flow
- `frontend`: component/style/interaction
- `search-discovery`: tokenizer/index/UI/archive/RSS/related
- `architecture`: framework/routing/runtime/schema/dependency
- `operations`: CI/build/deployment/Cloudflare control-plane contract
- `article-pipeline`: AI/evidence/audit/example/media orchestration
- `legacy-migration`: old content/media/redirect disposition

material architecture changeはcanonical doc + ADRを同期する。

## Design before migration

1. design review/acceptance
2. baseline inventory/measurement
3. legacy tag freeze
4. workspace + GitHub Actions skeleton
5. site/content/search foundation
6. content/taxonomy migration
7. source/public/protected media migration
8. route/SEO/search parity
9. Cloudflare desired-state cutover preparation
10. old implementation removal
11. Article Job/example/media tooling implementation
12. visual redesign

旧stack上で全面redesignしてから同componentを再migrationする順序を避ける。

## Workspace ownership

- `apps/site`: static site + MiniSearch build/client adapter
- `packages/content-contracts`: shared schema
- `packages/article-pipeline`: Article Job
- `packages/media-ingest`: canonical media + variants
- `packages/example-verifier`: bounded code/config verification
- `packages/site-validators`: deterministic gates

## PR scope

workspace skeleton、site foundation、content migration、media migration、old removal、Article Job、redesignを可能な限り分離する。

Cloudflare resource implementation/applyをsite frontend PRへ混ぜない。

## Article Job generated changes

Article Job export=feature branch working tree/patchまで。

PRへ追跡可能にする:

- candidate hash
- human approval
- content/visual audit result
- source/evidence summary location
- canonical source/public/protection receipt hashes where media exists
- validation result

private source/prompt/full job workspaceをPR本文へ貼らない。

## Media changes

new raster mediaはGitへ追加しない。

Article/media PRでは:

- semantic asset ID
- canonical source hash/profile
- delivery profile/variant manifest
- rights/provenance
- source-storage/publication/protection receipt chain

をreview対象にする。

raw camera/AI provider originalをPR artifactへ添付することをdefaultにしない。

## Search changes

MiniSearch/tokenizer/profile変更時:

- Japanese/mixed regression fixture
- serialized index bytes
- `/search/` JS bytes
- representative result quality

をreviewする。

content migrationとtokenizer tuningを無関係に混ぜない。

## Cloudflare changes

normal site deployはGitHub Actions + Wrangler。

DNS/R2/Rules/resource changeは`Xpotato-Server`側change。

R2 config adminをsite PR/CIへ追加しない。

Dashboard manual settingをPR completion conditionにしない。

## Review evidence

change classに応じて:

- affected routes/collections
- validation result
- representative viewport
- JS/search-index/media transfer impact
- accessibility manual smoke
- architecture/ADR impact
- migration inventory impact
- external storage/provider receipt/drift evidence

を提示する。

## Generated files

hand-editしない:

- generated JSON Schema
- search index
- responsive media variants
- social card derivative
- generated redirects/build inventories

source/profile/generatorを修正する。

## Legacy access

legacy sourceはfrozen tagを明示refとして読む。

active implementation探索へlegacy refを混ぜない。
