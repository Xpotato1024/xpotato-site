---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - stable content identity
  - content ID versus slug semantics
---

# Content Identity Contract

## Problem

Media Registry、Article Job、publication provenanceはstable content identityを必要とする。

filename / slugをidentityにするとroute renameで:

- media binding
- update job target
- provenance
- related-content reference
- redirect mapping

まで別contentとして扱われてしまう。

## Decision

すべてのcontent collection entryはimmutable `id`を持つ。

```ts
type ContentId = string;

interface ContentIdentity {
  id: ContentId;
}
```

`id`はmachine-generated opaque stable identifier。

## ID semantics

- titleではない
- slugではない
- filepathではない
- collection routeではない
- Git commitではない

一度published contentへ割り当てたIDはrename / redesign / media replacementで変更しない。

## ID generation

implementation candidateはUUIDv7等。

exact encoding / prefixは`content-contracts` implementationで固定する。

requirements:

- globally unique within repository
- generated without central database
- URL renameから独立
- deterministic validation可能

humanが意味を込めたIDを手作業することを標準にしない。

## Frontmatter

`id`は全collectionでrequired machine metadata。

例:

```yaml
id: 019c...
title: Astro 7への移行
...
```

通常authorはgenerator / Article Jobが作るため、手入力作業にはしない。

## Slug

slugはroute identity。

通常はfilename / content file pathから導出する。

```text
content ID: stable
slug: rename可能
```

slug rename時:

- same content IDを維持
- legacy/current route mappingを作る
- redirectを同じchangeで用意
- Media Registry / provenance fileはcontent IDにより同一entryとして維持

## Collection move

Blog -> Notes等のcollection moveはmaterial content model change。

原則same content IDを維持できるが、route / schema / taxonomy / redirect migrationを要求する。

## Article Job

### create

CREATED時にnew ContentIdを割り当て、job targetへ固定する。

jobがcancelされ未publishでもID再利用を要求しない。

### update

existing ContentIdが必須。

base repository commit上でexactly one entryへ解決できなければBLOCKED。

## Media Registry

registry filename / content bindingはContentIdを正とする。

semantic asset IDはcontent ID内にscopeされる。

## Publication provenance

provenance recordもContentIdへbindする。

content bytes変更でContentIdを変更せず、revision/candidate hashを更新する。

## Migration

legacy contentへvNext ContentIdを割り当て、migration mappingに記録する。

legacy slug / WordPress IDをvNext ContentIdそのものとして流用しない。

## Validation

- every content entry has ID
- ID globally unique
- Media Registry content ID resolves exactly one content
- provenance content ID resolves exactly one content
- route rename does not silently create new ID
- update job cannot target ambiguous/missing ID
