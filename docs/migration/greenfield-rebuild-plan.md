---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - vNext implementation migration plan
  - legacy implementation archive strategy
---

# Greenfield Rebuild and Legacy Archive Plan

## Decision summary

vNext実装開始時、旧directory structure上でincremental refactorを続けない。

**旧実装をGitでimmutableに保存した後、active implementation treeをvNext layoutへ再構築する。**

## Why not move everything under `archive/`

repo内に旧source copyを残すと:

- code searchに旧実装が混ざる
- AI agentがlegacy fileをcurrentと誤認する
- dependency scanner / IDEが旧packageやconfigを拾う
- duplicate route / asset / typeが発生し得る
- repository sizeが不必要に増える

ため、full code archiveはGit object/historyへ委ねる。

## Archive mechanism

implementation cutover直前のmain commitを固定する。

推奨:

```text
annotated tag: legacy-site-v1-final
optional branch: legacy/site-v1
```

exact namingは実装taskで最終決定する。

minimum requirement:

- commit SHAをmigration recordへ記録
- tagを作成
- tagがremoteに存在することを確認
- migration inventoryからlegacy fileへ参照可能

branchは継続hotfix等の実需がなければ必須ではない。immutable tagだけの方がcurrent branchを増やさず簡潔。

## What remains in vNext main

残すもの:

- public contentそのもの
- 必要なmedia
- stable URL / legacy URL identity
- migrationに必要なredirect data
- reusable factual documentation
- WordPress legacy HTMLから変換できない例外のinventory

残さないもの:

- deprecated setup script
- obsolete deployment docs
- old build configuration
- old component implementation
- old layout / CSS just for reference
- obsolete importer copied into active tools

必要なら`docs/legacy/`にinventory / rationaleだけ残す。

## Rebuild phases

### Phase 0 — Design freeze

- proposed SoT / contracts review
- accepted ADR
- target directory layout freeze
- migration acceptance criteria

### Phase 1 — Legacy freeze

- current main audit
- `legacy-site-v1-final` tag
- route / content / asset inventory
- current production screenshot / performance baseline

### Phase 2 — Active tree reset

feature branch上で旧implementation-only fileを削除し、target skeletonを作成する。

Git historyを消去しない。orphan branch / history rewriteは不要。

### Phase 3 — Foundation

- package/toolchain
- Astro current major
- Tailwind 4
- content collections
- registries
- base layouts
- SEO / security headers
- CI / validation

### Phase 4 — Content migration

contentをcollection単位で移す。

旧記事bodyはできるだけMDXを保持し、legacy HTML wrapperは明示inventoryへ限定。

### Phase 5 — Media migration

- `public/` article imagesをclassification
- local optimized assetへ移行
- heavy assetをR2へ移行
- HEIC input ingest導入

### Phase 6 — Article pipeline

website runtimeが安定してからArticle Jobを実装。

pipelineとsite rendererを同時greenfield実装してdebug surfaceを増やさない。

### Phase 7 — Visual redesign

architecture / content contractsが安定した後、design token / component module上でvisual redesign。

## Rollback

migration branchが失敗してもlegacy tagから旧siteを再構築できることをcutover条件とする。

production切替前にlegacy build procedureがtagから再現できることを1回確認する。

## Cutover gate

- content count / route count inventory一致または意図した差分説明
- required legacy redirect prepared
- representative page screenshot review
- SEO / sitemap / robots / 404 validation
- performance baseline regression review
- production deployment procedure verified
- rollback artifact verified
