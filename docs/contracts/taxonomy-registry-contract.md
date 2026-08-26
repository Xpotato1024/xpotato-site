---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - category registry contract
  - tag registry contract
  - archive generation policy
---

# Taxonomy Registry Contract

## Principle

category / tagは記事frontmatterのfree-form textではなく、version-controlled registryのstable IDを参照する。

表示label変更で記事全件を書き換えない。

## Category

```ts
interface CategoryRecord {
  id: string;
  label: string;
  description: string;
  slug: string;
  indexable: boolean;
  aliases: string[];
  sortOrder?: number;
  status: "active" | "retired";
}
```

Categoryはbroad topic。Blog記事は原則1つ。

初期category数を多くしない。category追加は複数記事を継続的にまとめる価値がある場合に限る。

## Tag

```ts
interface TagRecord {
  id: string;
  label: string;
  slug: string;
  description?: string;
  aliases: string[];
  archive: boolean;
  indexable: boolean;
  status: "active" | "retired";
}
```

Tagはtechnology / concept / theme。

## Alias resolution

AI / import toolはcandidate stringをregistryへ解決する。

例:

```text
"TypeScript" -> id: typescript
"ts"         -> alias -> typescript
```

unknown termを勝手に新tagとして追加しない。

unknown tag candidateはproposal artifactへ出し、人間承認かtaxonomy-specific updateを要求する。

## Retired taxonomy

retired IDを既存記事から即削除しない。

- replacementがある場合はredirect / aliasを定義
- archive routeを維持する必要性を判断
- new contentへの使用は禁止

## Archive policy

### Category archive

`/blog/category/<slug>/`

active categoryはarchive生成。

`indexable=true`のcategoryだけsearch index対象。

### Tag archive

`archive=true`のtagだけ `/blog/tag/<slug>/` を生成。

metadata purposeだけのtagはarchiveを生成しない。

### Year archive

`/blog/archive/<yyyy>/`

記事が1件以上存在するyearだけ生成。

### Month archive

初期非対応。

記事量 / navigation needが実測で必要になった場合のみ導入。

## SEO policy

indexable archiveは:

- unique title / description
- stable canonical URL
- meaningful article list
- crawlable normal links

を持つ。

薄いtag archiveをSEO目的で大量生成しない。

## Machine-readable location

実装時の候補:

```text
src/content-registry/
  categories.ts
  tags.ts
  series.ts
```

exact valueはTypeScript registryをSoTとし、docsへ全ID一覧を重複しない。
