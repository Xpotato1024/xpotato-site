---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - Blog frontmatter contract
  - content metadata derivation rules
---

# Blog Frontmatter Contract

## Goal

通常のBlog記事では、著者・AIがSEO boilerplateを大量入力しない。

frontmatterは**content identity / editorial metadata / exceptional override**だけを保持し、canonical URL、OGP、JSON-LD、archive membership等はbuild systemが導出する。

## Exact logical shape

```ts
interface BlogFrontmatter {
  schemaVersion: 1;

  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;

  category: CategoryId;
  tags: TagId[];

  draft: boolean;
  featured?: boolean;

  hero: HeroRef;

  series?: {
    id: SeriesId;
    order?: number;
  };

  legacyUrls?: string[];

  seo?: {
    canonicalOverride?: string;
    noindex?: boolean;
    titleOverride?: string;
    descriptionOverride?: string;
  };
}
```

## Required fields

通常Blog記事でrequired:

- `title`
- `description`
- `pubDate`
- `category`
- `tags`
- `draft`
- `hero`

Blogはhero必須。hero取得方法は`synthetic-media-policy.md`を正とする。

## Title / description

`title`は人間向け記事titleの正本。

`description`は記事一覧・meta description・share summaryの共通sourceとして利用できる簡潔な説明。

通常は別の`summary` fieldを持たない。UIが短い説明を必要とする場合、descriptionのclamp / display logicで対応する。

本当に別summaryが必要なuse caseが生じた場合だけ追加する。

## Date

ISO dateを使用する。

`updatedDate`はmaterial content updateだけで更新する。formatting-only、typo-onlyで自動更新しない。

## HeroRef

```ts
type HeroRef =
  | {
      kind: "local";
      assetId: string;
      origin: "camera" | "screenshot" | "diagram" | "ai_generated" | "deterministic_cover";
    }
  | {
      kind: "r2";
      assetId: string;
      path: string;
      origin: "camera" | "screenshot" | "diagram" | "ai_generated" | "deterministic_cover";
    };
```

raw filesystem pathをhero identityとしない。asset registry / generated asset manifestへ解決できるIDを使用する。

## SEO derivation

通常記事では自動導出:

- canonical URL = collection route + slug
- OG title = `seo.titleOverride ?? title`
- meta description = `seo.descriptionOverride ?? description`
- OG description = 同上
- BlogPosting JSON-LD = article metadata + canonical URL + hero derivative
- sitemap = `draft=false && noindex!=true`

`seo` objectはexception-only。

## Legacy URLs

`legacyUrls`はidentity evidenceであり、redirectがactiveという意味ではない。

redirect registry生成・provider-level redirectとの差分検査に利用する。

## Slug

slugをfrontmatterの必須fieldにしない。

content filename / content IDから安定したslugを導出する方式を標準とする。明示slug overrideが必要になった場合は、URL migration / redirectを同時に要求する別contractとして追加する。

## Validation

- title / description non-empty
- category exists
- all tags exist
- duplicate tag禁止
- pubDate <= updatedDate where updated exists
- hero asset exists and audit status valid
- legacy URL duplicate禁止
- canonical override absolute HTTPS URL
- draft=falseでunresolved publication blockerがない
