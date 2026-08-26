---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - existing content Article Job update semantics
  - content revision preservation rules
---

# Article Update Contract

## Goal

AI-first Article Jobをnew article作成だけでなく、既存contentのrefresh / correction / expansion / media replacementにも安全に使う。

updateでContentId、route、semantic media identity、過去provenanceを無意識に壊さない。

## Update kinds

```ts
type ArticleUpdateKind =
  | "refresh"
  | "correction"
  | "expansion"
  | "restructure"
  | "metadata_only"
  | "media_only";
```

### refresh

software version / provider behavior / current information等を現行化。

### correction

誤りや不正確な記述を修正。

### expansion

既存論旨を維持して新しいsection / evidenceを追加。

### restructure

materialな構成変更。full content auditを要求。

### metadata_only

本文を変更せずtitle / description / taxonomy等を変更。

### media_only

本文事実を変更せずhero / screenshot / diagram等を差し替え。

## Update target

```ts
interface ArticleUpdateTarget {
  contentId: ContentId;
  baseRepositoryCommit: string;
  kind: ArticleUpdateKind;
  allowRouteChange: boolean;
}
```

base commit上でContentIdがexactly one entryへ解決する必要がある。

## Fixed prior-state bundle

update prepareで少なくとも:

- existing MDX exact bytes
- existing frontmatter
- current route / slug
- Media Registry
- Interactive binding where applicable
- current Publication Provenance
- current taxonomy snapshot

をfixed source artifactとしてbindする。

## Content ID invariant

updateはsame `ContentId`を維持する。

「全面rewriteしたからnew ID」を自動判断しない。

本当に別contentへ分岐する場合はcreate jobとして扱う。

## Route invariant

`allowRouteChange=false`がdefault。

route change時:

- same ContentId
- new slug/path
- old route -> new route redirect plan
- canonical / sitemap update
- human review packageにURL changeを強調

redirectなしroute renameをexportしない。

## Evidence requirements

updateで既存記事そのものをfact sourceとして扱わない。

past Publication Provenanceはsource discovery seed / lineageでありcurrent evidenceではない。

minimum evidence refresh:

- changed material claim
- newly added material claim
- version/date-sensitive claim in affected scope
- auditorがstale / unsupportedと判断したclaim

`refresh` / `restructure`ではscopeを広く取り、current official sourceを再確認する。

## Diff artifacts

update candidateはdeterministic diffを持つ。

```ts
interface ContentRevisionDiff {
  contentId: ContentId;
  beforeMdxSha256: string;
  afterMdxSha256: string;
  frontmatterChangedFields: string[];
  routeChanged: boolean;
  taxonomyChanges: string[];
  mediaChanges: MediaRevisionRecord[];
  materialClaimChanges: ClaimRevisionRecord[];
}
```

human reviewはrendered outputだけでなくdiffを確認できる。

## Updated date

`updatedDate`を変更する条件:

- refresh
- correctionでmaterial meaningが変わる
- expansion
- restructure

通常変更しない:

- spelling / formatting-only manual fix
- media_onlyで本文意味が変わらない
- pure implementation rendering change

exact dateはexecutorがpublication timeから設定し、AIに日付を推測させない。

## Media identity

same semantic role / subjectを差し替える場合、asset IDを可能な限り維持する。

例:

```text
assetId: architecture-overview
old object: sha A
new object: sha B
```

new Git revisionのregistryだけobject bindingを更新する。

old R2 objectはrollbackのため保持する。

semantic meaning自体が変わる場合はnew asset IDを作り、old bindingをretireする。

## Hero / social card

- hero bytes変更 -> visual audit再実行
- title / description / hero変更 -> social card derivation stale
- social cardをdeterministic再生成

media_onlyでもcandidate / visual review / human approvalを通す。

## Taxonomy change

unknown termをupdate articleのついでにsilent createしない。

taxonomy registry changeはproposalとして明示し、人間review対象にする。

## Interactive Tool update

Tool description updateとinteractive component implementation updateを分離できる。

- content-only update: same module binding
- runtime update: module registry / code PR + tool content compatibility validation

AI article jobがReact sourceを直接rewriteすることを標準にしない。

## Audit scope

`metadata_only` / `media_only`はfull semantic rewriteを要求しないが、変更が本文意味へ影響していないことをdeterministic / independent reviewで確認する。

`refresh` / `correction` / `expansion` / `restructure`はcontent audit required。

## Approval

human review bundleに必須:

- before / after rendered preview where useful
- text diff
- changed material claims
- source freshness summary
- taxonomy diff
- media diff
- route diff
- exact candidate hash

## Export

same ContentIdのcurrent files / registries / provenanceをnew revisionへ更新する。

past revision historyはGit + immutable R2 objectsで保持する。
