---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - stable content identity
  - ContentId encoding
  - content ID versus slug semantics
---

# Content Identity Contract

## Problem

Media Registry、Article Job、publication provenanceはstable content identityを必要とする。

filename / slugをidentityにするとroute renameでmedia binding、update target、provenance、related-content、redirect mappingまで別contentとして扱われる。

## Decision

すべてのcontent collection entryはimmutable `id: ContentId`を持つ。

ContentIdは**RFC 4122 UUID version 4のlowercase canonical string**とする。

```ts
type ContentId = string; // validated UUID v4
```

example:

```text
5e1f2aa4-7b66-4c2e-8f0b-2dd6597424c1
```

prefixを付けない。

## Why UUID v4

- central database不要
- Node build/authoring toolchainの`crypto.randomUUID()`で追加dependencyなしに生成可能
- content chronology / sortをIDへ混ぜる必要がない
- standard validatorで厳密に検査できる
- route / collection / titleから独立したopaque identityになる

UUID v7のtime orderingはこのsiteでは不要。publication orderは`pubDate`等のcontent metadataを正とする。

## ID semantics

ContentIdは:

- titleではない
- slugではない
- filepathではない
- collection routeではない
- Git commitではない
- public URLへ露出させる必要はない

一度published contentへ割り当てたIDはrename / redesign / media replacement / content updateで変更しない。

## Generation

executor / migration toolがNode `crypto.randomUUID()`相当で生成する。

normalization:

- lowercase
- hyphenated canonical form
- UUID v4 version bits required
- braces / URN prefix禁止

humanが意味を込めたIDを手作業することを標準にしない。

## Frontmatter

`id`は全collection required machine metadata。

```yaml
id: 5e1f2aa4-7b66-4c2e-8f0b-2dd6597424c1
title: Astro 7への移行
```

Article Job / migration generatorが作るため、normal authoring作業では手入力不要。

## Slug

slugはmutable route identity。

通常filename / content file pathから導出する。

```text
ContentId = immutable internal identity
slug      = mutable human-readable route identity
```

slug rename時:

- same ContentId維持
- old/current route mapping
- redirectをsame changeで用意
- Media Registry / provenanceはsame ContentIdのまま

## Collection move

Blog -> Notes等はmaterial schema/route change。

same ContentIdを維持できるが、route / taxonomy / redirect migrationを要求する。

## Article Job

### create

CREATED時にnew UUID v4 ContentIdを割り当てjob targetへ固定。

cancelされたunpublished IDを再利用する必要はない。

### update

existing ContentId required。

base repository commitでexactly one contentへresolveしなければBLOCKED。

## Media / provenance

Media Registry file / Publication ProvenanceはContentIdへbindする。

semantic asset IDはContentId内scope。

content bytes変更でContentIdを変えずcandidate/revision hashesだけ更新する。

## Migration

legacy contentごとにnew UUID v4を割り当てmigration mappingへ保存する。

legacy slug / WordPress ID / dateをContentIdとして流用しない。

## Validation

- required field exists
- lowercase canonical UUID v4
- globally unique across all collections
- Media Registry ContentId resolves exactly one content
- provenance ContentId resolves exactly one content
- route rename does not silently change ID
- update job target unambiguous
