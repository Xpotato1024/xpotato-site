---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - global site configuration semantics
  - navigation registry semantics
  - site identity metadata
---

# Site Configuration Contract

## Purpose

site name、canonical origin、locale、timezone、author/site identity、navigation等をcomponentごとにhard-codeせず、1つのmachine-readable SoTから利用する。

## SiteConfig

```ts
interface SiteConfig {
  site: {
    name: string;
    shortName: string;
    canonicalOrigin: string;
    locale: "ja-JP";
    language: "ja";
    timezone: "Asia/Tokyo";
    defaultDescription: string;
  };

  publisher: {
    displayName: string;
    profilePath?: string;
  };

  navigation: NavigationItem[];

  socialLinks: SocialLink[];

  discovery: {
    rssPath: "/rss.xml";
    searchPath: "/search/";
  };
}
```

exact personal profile fieldsはpublic website requirementに必要なものだけ追加する。

## Canonical origin

`https://xpotato.net`をvNext canonical originとする。

runtime environment variableで任意originへ置換してproduction canonicalを揺らさない。

preview environmentは別base URLでrenderできても、indexability policyを明示する。

provider zone/account IDをSiteConfigへ入れない。

## Locale / language

initial public language = Japanese。

- HTML `lang=ja`
- locale formatting = `ja-JP`
- site calendar timezone = `Asia/Tokyo`

をdefaultとする。

contentごとのlanguage overrideが将来必要になればcontent contractを拡張する。

## Date semantics

current frontmatter `pubDate` / `updatedDate`はISO calendar date (`YYYY-MM-DD`)を標準とする。

reader displayはSiteConfig timezone/localeで行う。

RSS等DateTimeを要求するformatへdate-only contentを変換する場合、deterministic feed policyでsite timezoneの開始時刻等へ変換し、**actual precise publication timeを知っているかのように別metadataへ昇格させない**。

将来precise publication timeがproduct requirementになった場合、`publishedAt`等を別contractとして追加する。

## Publisher identity

Article JSON-LD / feed等でpublisher/author identityが必要な場合、SiteConfigのpublic identityを使う。

AI authorやprovider modelをarticle `author`として扱わない。

AI involvementはPublication Provenance / disclosure policyの別semantic。

## NavigationItem

```ts
interface NavigationItem {
  id: string;
  label: string;
  href: string;
  order: number;
  location: Array<"header" | "footer">;
  status: "active" | "retired";
}
```

navigation membershipをPage frontmatterへ複製しない。

route exists validationを行う。

## SocialLink

```ts
interface SocialLink {
  id: string;
  label: string;
  href: string;
  rel?: string[];
  status: "active" | "retired";
}
```

external platform linkをcontent frontmatterへ複製しない。

## Global media config

R2 domain / transform provider detailsをSiteConfig coreへ直接埋め込まない。

media delivery adapter/profileはseparate architecture config。

SiteConfigはsemantic site identityだけを所有する。

## SEO usage

SiteConfigから:

- canonical origin
- site name/title suffix
- locale
- publisher identity
- default fallback description

を取得する。

page-specific title/descriptionはcontent/page dataを優先する。

## RSS usage

- canonical origin
- feed path
- site title/description
- locale/timezone
- publisher identity

を使用する。

## Search usage

search route locationはSiteConfig / DiscoveryProfileで一致させ、二重SoTにしない。

implementationではどちらかをexact value SoTとし、もう一方は型/semantic defaultだけを持つ。

## Location

candidate:

```text
apps/site/src/site-config.ts
```

または`apps/site/src/config/site.ts`。

exact implementation pathはrepository layout内で固定する。

## Validation

- canonicalOrigin absolute HTTPS
- no trailing-path ambiguity
- locale/timezone supported
- active navigation IDs unique
- href valid internal/external form
- active internal nav route exists
- social URL valid
- RSS/search configured route agrees with generated route
- no provider secret/account ID
