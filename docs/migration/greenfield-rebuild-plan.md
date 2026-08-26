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

**旧実装をGitでimmutableに保存した後、active implementation treeをnpm-workspace構成へ再構築する。**

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
- annotated tagを作成
- tag messageに旧production identity / date / migration issueを記録
- tagがremoteに存在することを確認
- tagから旧buildが再現できることを確認
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
- target npm workspace layout freeze
- migration acceptance criteria

### Phase 1 — Legacy freeze

- current main audit
- `legacy-site-v1-final` annotated tag
- route / content / asset inventory
- current production screenshot / performance baseline
- tagから旧site build再現確認

### Phase 2 — Workspace skeleton

feature branch上でvNext root workspaceを作る。

```text
apps/site
packages/content-contracts
packages/article-pipeline
packages/media-ingest
packages/site-validators
```

この時点では旧siteを削除し切らず、new workspaceのfoundation validationだけ先に行ってよい。

### Phase 3 — New site foundation

- Node / npm workspace baseline
- Astro current major
- Tailwind 4
- shared content-contracts
- Content Layer
- taxonomy registries
- base layouts
- SEO / security headers
- CI / validation

new `apps/site` が代表fixture contentでbuildできることを確認する。

### Phase 4 — Content migration

collection単位でcontentをnew siteへ移す。

旧記事bodyはできるだけMDXを保持し、legacy HTML wrapperは明示inventoryへ限定。

content count、slug、legacy URL、asset referenceをmachine-readable inventoryで照合する。

### Phase 5 — Media migration

- old `public/` article imagesをclassification
- local optimized assetへ移行
- heavy assetをR2へ移行
- HEIC input ingest導入
- representative image delivery確認

### Phase 6 — Route parity and redirect

- current public route inventoryとnew buildを比較
- intended removalを明示
- path redirect生成
- query-based WordPress redirectをinfra側へhandoff
- sitemap / canonical整合

### Phase 7 — Old implementation removal

new siteがparity gateを通過した後、feature branch上で旧active implementation-only fileを削除する。

ここで初めてroot旧`src/`、旧Astro config、旧Tailwind config、obsolete script等を削除する。

Git historyを消去しない。orphan branch / history rewriteは不要。

### Phase 8 — Article pipeline

website runtimeが安定してからArticle Jobを実装。

pipelineとsite rendererを同時greenfield実装してdebug surfaceを増やさない。

`content-contracts`だけはsite foundation時点で先に導入する。

### Phase 9 — Visual redesign

architecture / content contractsが安定した後、design token / component module上でvisual redesign。

## Migration inventories

implementation開始時に少なくとも次をmachine-readableに取得する。

- route inventory
- content inventory
- taxonomy inventory
- local asset inventory
- R2 logical refs
- legacy URL inventory
- interactive component inventory
- client JS baseline

inventoryはmigration evidenceであり、将来のcurrent SoTにはしない。

## Rollback

migration branchが失敗してもlegacy tagから旧siteを再構築できることをcutover条件とする。

production切替前にlegacy build procedureがtagから再現できることを1回確認する。

new production cutover後もrollback window中は旧build artifactまたはtag build pathを保持する。

## Cutover gate

- content count / route count inventory一致または意図した差分説明
- required legacy redirect prepared
- representative page screenshot review
- SEO / sitemap / robots / 404 validation
- performance baseline regression review
- no unintended React hydration on content-only routes
- production deployment procedure verified
- rollback artifact verified
- old source no longer referenced by workspace/build/config
