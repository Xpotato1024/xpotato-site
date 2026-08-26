---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - content slug policy
  - route registry semantics
  - application redirect contract
  - provider redirect requirement handoff
---

# Route, Slug, and Redirect Contract

## Principle

ContentIdとpublic routeを分離する。

- ContentId: immutable internal identity
- slug/path: human-readable public identity,変更可能だが安易に変えない
- redirect: route continuity contract

## New content slug

new Blog/Note/Project/ToolのslugはASCII lowercase kebab-caseを標準とする。

```text
[a-z0-9]+(-[a-z0-9]+)*
```

requirements:

- lowercase
- no whitespace
- no percent-encoded author input
- no file extension
- no leading/trailing/repeated hyphen
- reserved route collision禁止
- human-readable / topic-relevant

exact max lengthはimplementation validatorでreasonable boundを設定する。

## File naming

content file basename = current slugを標準とする。

ContentIdはfrontmatterで保持するためfilename renameでもsame identity。

legacy migrationではroute continuityを優先し、date-based/legacy slugを維持してもよい。migrationの目的をslug美化にしない。

## Slug proposal

Article Job create:

- AI/author may propose slug hint
- deterministic normalizerがsyntax/reserved/collisionをvalidate
- candidate routeをhuman reviewへ表示

AIがcollision回避のrandom suffixをsilent付加しない。

## RouteRecord

```ts
interface ContentRouteRecord {
  contentId: ContentId;
  collection: string;
  slug: string;
  route: string;
  canonical: boolean;
}
```

1 ContentIdにつきcurrent canonical content routeはexactly one。

## Reserved routes

site registry/configで少なくとも:

- `/`
- `/blog/`
- `/notes/`
- `/projects/`
- `/tools/`
- `/search/`
- `/rss.xml`
- taxonomy/archive prefixes

をcontent slug collisionから保護する。

## Route rename

published content route rename:

1. same ContentId
2. new route validates
3. old route captured
4. permanent redirect plan
5. canonical/sitemap/internal refs regenerated
6. human reviewでURL change表示
7. redirect graph validation

route changeだけでnew ContentIdを発行しない。

## ApplicationRedirectRecord

```ts
interface ApplicationRedirectRecord {
  id: string;
  sourcePath: string;
  targetPath: string;
  status: 301;
  reason: "content_route_change" | "legacy_path" | "site_structure_change";
  contentId?: ContentId;
  statusLifecycle: "active" | "retired";
}
```

static content permanent redirectは301標準。

Meta refresh redirectを標準にしない。

## Query/domain/provider redirect

WordPress query identity、host/domain redirect等はprovider-independent requirementへ変換する。

```ts
interface ProviderRedirectRequirement {
  id: string;
  match:
    | { kind: "query"; path: string; query: Record<string, string> }
    | { kind: "host"; host: string; path?: string };
  targetUrl: string;
  permanent: true;
  reason: string;
  contentId?: ContentId;
}
```

actual Cloudflare rule/configは`Xpotato-Server` owner。

site cutoverはimplemented/verified statusを確認する。

## Current migration baseline — 2026-08-26

main `927d105713561309fc5e2374396f86646b5aeb2a`のcurrent content code searchで`legacyPath`を持つpublished contentは3件確認済み。

| Legacy query | Current content | vNext requirement |
|---|---|---|
| `/?p=34` | PrimeFactorizer | provider query redirect -> `/tools/prime-factorizer/` |
| `/?p=693` | vibration-robot | provider query redirect -> migrated Blog route |
| `/?p=811` | ConoHa SSH article | provider query redirect -> migrated Blog route |

migrationで各entryへContentId割当後、ProviderRedirectRequirementもそのContentIdへbindする。

known application compatibility pages:

| Current source path | Target | Current mechanism | vNext |
|---|---|---|---|
| `/blog/prime-factorizer/` | `/tools/prime-factorizer/` | meta refresh + canonical/noindex | real 301 path redirect |
| `/blog/category/tools/` | `/tools/` | meta refresh + canonical/noindex | real 301 path redirect |

current `/pages/` routeはfixed-page listing。vNextでretireする場合もsilent deleteせずroute dispositionへ記録する。

このbaselineはdesign-time evidence。cutover時はfrozen legacy tagから再scanし:

- additional legacy URLs
- removed/renamed content
- new compatibility routes

を差分reviewする。

## Redirect registry

candidate:

```text
apps/site/src/content-registry/redirects.ts
```

or generated data from `legacyUrls` + route-change records。

exact active redirect setはmachine-readable SoTを1か所にする。

## Redirect graph validation

- exact source unique
- source != target
- no cycle
- no avoidable chain
- current canonical routeをredirect sourceにしない
- redirect target exists or allowed external canonical
- one legacy identity -> one target

A->B->Cがあれば可能な限りA->Cへflattenする。

## LegacyUrls frontmatter

frontmatter `legacyUrls`はidentity evidenceでありactive redirect configではない。

validator/generatorが:

- path legacy -> application redirect proposal
- query/domain legacy -> provider redirect requirement

へ分類する。

記録しただけでactive redirectと報告しない。

## Update job

`allowRouteChange=false` default。

trueの場合old/new route + redirect proposalをcandidate hash/human reviewへbindする。

## SEO

route rename後:

- new self canonical
- old permanent redirect
- sitemap new only
- internal links new route

old duplicate content pageを残さない。

## Validation

- slug syntax / reserved collision
- route uniqueness
- ContentId -> one canonical route
- application redirect graph acyclic/flattened
- provider redirect syntax
- legacy URL classification complete
- route-change candidate includes redirect
- sitemap/canonical consistency
- cutover legacy scan accounts for every current baseline redirect or explicit disposition
