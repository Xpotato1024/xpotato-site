---
status: proposed
owner: architecture
last_verified: 2026-08-29
canonical_for:
  - legacy migration inventory schema semantics
  - vNext parity report contract
---

# Migration Inventory Contract

## Post-Freeze amendment status

The unresolved media and blocked LegacyHtml semantics in this document are a **post-Freeze proposed amendment** associated with ADR-0029。They are pending a fresh clean-room design audit and explicit operator acceptance and do not alter the accepted Frozen Design by documentation change alone。

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

`LegacyContentId` is a deterministic legacy-only identity bound to the frozen snapshot。It is not a vNext `ContentId`。

`LegacyLocator` preserves an exact locator observed in legacy source:

```ts
type LegacyContentId = string;
type LegacyLocator = string;
```

`LegacyLocator` must be non-empty and must not contain NUL。It is not restricted to repository-relative paths and may preserve exact forms such as `/wp-content/uploads/...` and `r2:/blog/...`。An `r2:/...` locator is not reinterpreted as a provider URL and must not be enriched with provider account/bucket IDs, credentials, or signed URLs。

```ts
interface LegacyContentRecord {
  collection: "blog" | "notes" | "projects" | "tools" | "pages";
  legacyPath: string;
  legacyContentId: LegacyContentId;
  title: string;
  draft: boolean;
  bodySha256: string;
  frontmatterSha256: string;
  referencedMediaPaths: LegacyLocator[];
  referencedInteractiveComponents: string[];
}
```

migration mapping:

```ts
interface ContentMigrationRecord {
  legacyContentId: LegacyContentId;
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

Git-backed bytes and unresolved references are different evidence states。`LegacyMediaRecord` is a discriminated union:

```ts
type LegacyMediaOrigin =
  | "wordpress"
  | "project"
  | "tool"
  | "site_asset"
  | "unknown";

interface VerifiedLegacyMediaRecord {
  verificationStatus: "git_verified";
  legacyPath: LegacyLocator;
  sourceFileSha256: string;
  sizeBytes: number;
  detectedFormat: string;
  width?: number;
  height?: number;
  referencedByContentIds: LegacyContentId[];
  likelyOrigin: LegacyMediaOrigin;
}

interface UnresolvedLegacyMediaRecord {
  verificationStatus: "unresolved_non_local";
  legacyPath: LegacyLocator;
  referencedByContentIds: LegacyContentId[];
  likelyOrigin: LegacyMediaOrigin;
  reason: "non_git_locator" | "missing_git_object";
}

type LegacyMediaRecord =
  | VerifiedLegacyMediaRecord
  | UnresolvedLegacyMediaRecord;
```

`non_git_locator` means the locator does not identify bytes in the frozen Git snapshot。`missing_git_object` means a Git-resolvable legacy form was referenced but the corresponding object is absent。These states remain distinguishable。

An unresolved record preserves the exact locator and references but must not contain fabricated `sourceFileSha256`, `sizeBytes`, format, or dimensions。Inventory generation does not access R2 or another provider merely to turn an unresolved record green。The record remains a migration blocker until a later accepted phase maps, retires, or verifies it。

migration mapping:

```ts
interface MediaMigrationRecord {
  legacyPath: LegacyLocator;
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
interface StaticLegacyHtmlRecord {
  contentId: LegacyContentId;
  extractionStatus: "static";
  rawHtmlSha256: string;
  disposition: "convert_mdx" | "manual_review" | "retire";
}

interface BlockedLegacyHtmlRecord {
  contentId: LegacyContentId;
  extractionStatus: "blocked";
  blocker: string;
  disposition: "manual_review";
}

type LegacyHtmlRecord =
  | StaticLegacyHtmlRecord
  | BlockedLegacyHtmlRecord;
```

`static` means a bounded static extractor recovered the actual raw HTML bytes from a string literal or substitution-free template literal。`blocked` means raw HTML use exists but safe static extraction cannot prove its bytes。

Blocked records must not contain a fabricated `rawHtmlSha256`。Inventory generation must not use `eval`, dynamic module execution, or arbitrary MDX/JavaScript execution to recover HTML。Blocked evidence remains `manual_review` and is a migration/cutover blocker。

## Inventory integrity versus migration readiness

Inventory integrity and migration/cutover readiness are separate results。

Inventory integrity may `PASS` when:

- every non-Git or Git-missing media reference is preserved as an explicit `unresolved_non_local` record;
- every non-static raw HTML use is preserved as an explicit `blocked` record;
- no referenced evidence is silently dropped;
- schema, snapshot identity, uniqueness, and cross-record invariants pass。

This `PASS` means the inventory faithfully represents both verified facts and known blockers。It does not mean unresolved media is migrated or blocked HTML is converted。

Migration/cutover readiness remains `BLOCKED` until those records receive accepted mappings/dispositions and all later content, taxonomy, media storage/recovery, route, provider, and parity gates pass。

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
