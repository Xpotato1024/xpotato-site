---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - legacy migration inventory schema semantics
  - vNext parity report contract
---

# Migration Inventory Contract

## Purpose

旧実装をGit tagへfreezeした後、content / route / media / interactive behaviorの取りこぼしを機械的に検出する。

inventoryはmigration evidenceであり、migration完了後のcurrent site SoTではない。

## Legacy snapshot identity

すべてのinventoryは同一legacy commit/tagへbindする。

```ts
interface LegacySnapshotIdentity {
  repository: string;
  commitSha: string;
  tag?: string;
  generatedAt: string;
  generatorVersion: string;
}
```

## Content inventory

```ts
interface LegacyContentRecord {
  collection: "blog" | "notes" | "projects" | "tools" | "pages";
  legacyPath: string;
  legacyContentId: string;
  title: string;
  draft: boolean;
  bodySha256: string;
  frontmatterSha256: string;
  referencedMediaPaths: string[];
  referencedInteractiveComponents: string[];
}
```

migration mapping:

```ts
interface ContentMigrationRecord {
  legacyContentId: string;
  disposition: "migrate" | "merge" | "retire";
  vNextContentId?: string;
  rationale?: string;
}
```

`retire` / `merge`はexplicit rationale required。

## Route inventory

```ts
interface LegacyRouteRecord {
  urlPath: string;
  sourceKind: "content" | "static_page" | "redirect" | "generated_archive" | "tool";
  statusCode?: number;
  target?: string;
}
```

vNext parity record:

```ts
interface RouteParityRecord {
  legacyPath: string;
  disposition:
    | "same"
    | "redirect"
    | "retired"
    | "provider_redirect";
  vNextPath?: string;
  reason?: string;
}
```

unclassified legacy public routeはcutover blocker。

## Media inventory

```ts
interface LegacyMediaRecord {
  legacyPath: string;
  sourceFileSha256: string;
  sizeBytes: number;
  detectedFormat: string;
  width?: number;
  height?: number;
  referencedByContentIds: string[];
  likelyOrigin: "wordpress" | "project" | "tool" | "site_asset" | "unknown";
}
```

migration mapping:

```ts
interface MediaMigrationRecord {
  legacyPath: string;
  disposition:
    | "r2_content_media"
    | "git_site_asset"
    | "regenerated"
    | "retired";

  contentBindings?: Array<{
    contentId: string;
    semanticAssetId: string;
    role: string;
  }>;

  publicObjectSha256?: string;
  publicObjectKey?: string;
  rationale?: string;
}
```

### Rule

legacy article photo / screenshot / generated coverのdefault dispositionは`r2_content_media`。

favicon / logo / small UI icon等だけ`git_site_asset`候補。

## Taxonomy inventory

legacy category / tag / subject valuesをfrequency付きで抽出する。

```ts
interface LegacyTaxonomyRecord {
  namespace: string;
  rawValue: string;
  normalizedValue: string;
  usageCount: number;
  contentIds: string[];
}
```

vNext taxonomy設計時に:

- alias
- merge
- retire
- active term

へ分類する。

## Interactive inventory

```ts
interface LegacyInteractiveRecord {
  componentPath: string;
  usedByContentIds: string[];
  framework: string;
  hydrationDirective?: string;
  disposition?: "registry_module" | "rewrite" | "retire";
  vNextModuleId?: string;
}
```

旧MDXのcomponent importを全件抽出する。

## Legacy HTML inventory

`LegacyHtml` / raw imported HTMLを使用するcontentは別flagを持つ。

完全自動変換できない場合もsilent dropしない。

```ts
interface LegacyHtmlRecord {
  contentId: string;
  rawHtmlSha256: string;
  disposition: "convert_mdx" | "manual_review" | "retire";
}
```

## Parity report

cutover前にdeterministic reportを生成する。

minimum counts:

- legacy content total / migrated / merged / retired
- public route total / same / redirected / retired
- referenced media total / mapped / missing
- taxonomy raw terms / mapped / unresolved
- interactive components / mapped / unresolved
- legacy HTML / resolved / unresolved

## Cutover blockers

- unclassified public route
- referenced media with no mapping
- published content with no vNext disposition
- unknown legacy taxonomy used by published content
- Tool with no interactive disposition
- unresolved raw HTML that would lose material content
- redirect collision

## Storage

inventory outputはmigration branchの`.local/migration/`へ生成するのを標準とする。

review価値のあるsummary / explicit disposition mappingだけを`docs/migration/`またはversion-controlled migration dataとしてcommitできる。

巨大なscan outputを恒久SoTにしない。

## Validation

legacy tagから再生成したinventory hashがreviewed baselineと一致するか、差分が説明されること。
