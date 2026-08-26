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

allowed conceptual pattern:

```text
[a-z0-9]+(-[a-z0-9]+)*
```

requirements:

- lowercase
- no whitespace
- no percent-encoded author input
- no file extension
- no leading/trailing hyphen
- no repeated separator
- reserved route segment collision禁止
- human-readable / topic-relevant

exact max lengthはimplementation validatorでreasonable boundを設定できるが、SEO keyword stuffing目的の長大slugを作らない。

## Why ASCII slug

日本語titleでもURL transport/debug/log/CLI/redirect管理を単純に保つ。

content body/titleは日本語のまま。slugはtechnical English term等を使ったsemantic handleとしてAI/executorがproposalできる。

日本語slugを技術的に禁止する絶対要件というより、vNext standard authoring policyをASCIIへ統一する。

## File naming

content file basename = current slugを標準とする。

```text
apps/site/src/content/blog/astro-content-layer-migration.mdx
```

ContentIdはfrontmatterで保持するためfilename renameでもsame content identity。

legacy migrationではexisting route continuityを優先し、date-based/legacy slugをそのまま維持してもよい。

new slugへの一括SEO rewriteをmigrationの目的にしない。

## Slug proposal

Article Job create:

- AI/author may propose slug hint
- deterministic normalizer validates syntax/reserved words/collision
- candidate routeをhuman review packageへ表示

AIがcollision回避のためrandom数字をsilent付加しない。

collisionはnew proposal / user reviewへ戻す。

## RouteRecord

build-time route catalog:

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

site-level registry/configで少なくとも:

- `/`
- `/blog/`
- `/notes/`
- `/projects/`
- `/tools/`
- `/search/`
- `/rss.xml`
- taxonomy/archive prefixes

をcontent slug collisionから保護する。

exact listはroute registry implementation SoT。

## Route rename

published contentのroute renameはmaterial change。

required:

1. same ContentId
2. new slug/path validates
3. old path captured
4. permanent redirect plan generated
5. canonical/sitemap/internal refs regenerated
6. candidate human review highlights URL change
7. redirect collision/chain validation

route changeだけでnew ContentIdを発行しない。

## ApplicationRedirectRecord

site-owned path redirect:

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

normal content permanent redirectは301を標準とする。

static GET contentなのでmethod preservationを目的に308を標準化する必要はない。

## Redirect registry

candidate:

```text
apps/site/src/content-registry/redirects.ts
```

or generated data from content legacyUrls + explicit route-change records。

exact active redirect setはmachine-readable SoTを1か所にする。

Meta refresh redirectを標準にしない。

## Query/domain/provider redirect

WordPress `/?p=811`、domain redirect等はstatic path registryだけでは表現しにくい。

site repoはprovider-independent requirementを生成できる。

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

actual Cloudflare rule ID/configは`Xpotato-Server` owner。

site migration/cutoverはrequirementがinfra側でimplemented/verifiedされたことを確認する。

## Redirect graph validation

- exact source unique
- source != target
- no cycle
- no avoidable chain
- current canonical routeをredirect sourceにしない
- redirect target exists or allowed external canonical
- one legacy URL -> one target

A->B->Cが発生する場合、可能ならA->Cへflattenする。

## LegacyUrls frontmatter

frontmatter `legacyUrls`はidentity evidenceでありredirect registryそのものではない。

validator/generatorが:

- path legacy URL -> application redirect proposal
- query/domain legacy URL -> provider redirect requirement

へ分類する。

recordしただけでactive redirectと報告しない。

## Update job

`allowRouteChange=false` default。

trueの場合、old route + new route + redirect proposalをcandidate hash/human reviewへbindする。

## SEO

route rename後:

- new self canonical
- old permanent redirect
- sitemap new only
- internal links new route

old pageをduplicate canonical pageとして残さない。

## Validation

- slug syntax
- reserved collision
- route uniqueness
- ContentId -> one canonical route
- application redirect graph acyclic/flattened
- provider redirect requirement syntax
- legacy URL classification complete
- route-change candidate includes redirect
- sitemap/canonical consistency
