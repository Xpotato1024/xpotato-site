---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0023: stable ContentIdをroute/slugから分離する

## Context

vNextではcontent update、Media Registry、Publication Provenance、related-content、redirect migrationが同じlogical contentを長期参照する。

slug/filepath/URLをidentityにするとrenameやcollection moveで同一contentを別entityとして扱い、media/provenance/update lineageが壊れる。

Central databaseは持たないため、repository内だけでglobally uniqueかつroute-independentなidentityが必要。

## Decision

全content entryへimmutable `ContentId`を持たせる。

Encoding:

- RFC 4122 UUID version 4
- lowercase canonical hyphenated form
- opaque internal identity
- public URLへ露出不要

```text
ContentId = immutable machine identity
route/slug = mutable human-readable identity
```

GenerationはNode toolchainのcryptographically-random UUID v4 generator相当を使用し、humanが意味を込めたIDを標準にしない。

## Semantics

Same contentの:

- title change
- slug/route rename
- visual redesign
- media replacement
- ordinary content update

ではContentIdを変えない。

Route renameはsame ContentId + permanent redirectを要求する。

Collection moveはmaterial schema/route migrationだが、semantic entityがsameならContentId維持可能。

## Why UUID v4

- central sequence/database不要
- standard validatorで厳密に検査できる
- route/title/dateから独立
- chronologyをIDへ含める必要がない
- Node built-in toolchainで追加ID dependency不要

Publication orderは`pubDate`等のmetadataを正とするためUUIDv7のtime-orderingを必要としない。

## Alternatives

### Slug/path as identity

renameでMedia Registry/provenance/update targetまでidentity changeになるため不採用。

### WordPress ID / legacy numeric ID reuse

legacy-specificで新規contentと一貫せず、migration originをidentityへ焼き付けるため不採用。

### UUIDv7

time orderingは有用だが、このsiteではsort authorityが別metadataにあり追加semanticを持つ価値がない。

### Human-readable semantic IDs

collision/rename/meaning-changeの運用負担を増やすためbaselineにしない。

## Consequences

- migration時にlegacy entryへ一度だけnew ContentIdを割り当てる必要がある。
- globally unique validationが必要。
- Media Registry/Provenance/Article Job update targetをContentIdへbindできる。
- URL continuityとinternal identityを独立に管理できる。

## Related

- `contracts/content-identity-contract.md`
- `contracts/route-slug-redirect-contract.md`
