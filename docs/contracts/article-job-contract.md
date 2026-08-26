---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - Article Job specification contract
  - Article Job immutable identity
---

# Article Job Contract

## Purpose

Article Jobは1件の公開候補contentを生成・更新・監査・承認・exportする最上位work unit。

AI session / Git branchをidentityにしない。normalized job specificationとimmutable artifact lineageを正とする。

## Logical schema

```ts
interface ArticleJobSpec {
  schemaVersion: 1;
  jobId: string;

  operation: "create" | "update";

  target: {
    collection: "blog" | "notes" | "projects" | "tools" | "pages";
    contentId: ContentId;
    existingContentId?: ContentId;
    workingTitle: string;
    slugHint?: string;

    articleMode:
      | "explanation"
      | "tutorial"
      | "investigation"
      | "build_log"
      | "incident"
      | "comparative_review";

    updateKind?:
      | "refresh"
      | "correction"
      | "expansion"
      | "restructure"
      | "metadata_only"
      | "media_only";

    allowRouteChange?: boolean;
  };

  reader: {
    outcome: string;
    assumedKnowledge: string[];
    language: "ja";
  };

  inputs: {
    userNotes: string[];
    repositoryRefs: RepositoryRef[];
    localSourceRefs: LocalSourceRef[];
    seedUrls: string[];
    sourceDiscoveryQueries: string[];
  };

  constraints: {
    requiredClaims: string[];
    forbiddenClaims: string[];
    requiredSections: string[];
    forbiddenPublicationPatterns: string[];
  };

  taxonomyHints: {
    categoryId?: string;
    tagIds: string[];
  };

  media: {
    suppliedMediaRefs: string[];
    heroPreference: "auto" | "source_media" | "ai_generated" | "deterministic_cover";
    requiredInlineVisuals: string[];
  };

  permissions: {
    networkAccess: boolean;
    externalTextAI: boolean;
    externalImageAI: boolean;
    localMediaProcessing: boolean;
    publicMediaUpload: boolean;
  };
}
```

## Operation rules

### create

- executorがnew ContentIdを割り当てる
- `existingContentId`なし
- updateKindなし
- slugHintはproposalでありstable identityではない

### update

- `existingContentId` required
- `target.contentId === existingContentId`
- updateKind required
- current base repository上でexactly one contentへresolve
- `article-update-contract.md`に従う

## Content ID

`content-identity-contract.md`を正とする。

jobIdとContentIdは別identity。

1 contentに複数Article Job revisionが存在できる。

## Job ID

opaque unique ID。

slug / title / branch名から導出しない。

UUIDv7等をimplementation candidateとするがexact encodingはmachine-readable implementation SoTで固定する。

## Job fingerprint

canonical serializationしたArticleJobSpecのSHA-256。

rules:

- UTF-8
- object key canonical order
- array orderはsemantic orderとして保持
- insignificant whitespace除外
- enum / boolean representationをschema固定

UI comment / runtime timestamp等semantic inputでないものだけ除外可。

## Existing content update

update prepareでcurrent article bytes / metadata / media registry / provenance / routeをfixed prior-state bundleへ固定する。

before/after diffをhuman review packageに含める。

## Permission semantics

permissionはそのjobで許される上限であり、操作実行そのものではない。

- externalImageAI=false -> image backendを呼ばない
- publicMediaUpload=false -> human approval後でもR2 publication stageへ進めずBLOCKED / export impossible

`publicMediaUpload=true`でもhuman approval前にuploadしてよい意味ではない。

public R2 mutationはADR-0015 / public-media-publication contractに従う。

## Resource budgets

unbounded loop禁止。

profileで少なくとも:

- source discovery count
- external text AI calls
- semantic revision count
- image candidate count
- visual revision count
- artifact bytes
- workspace bytes

を有限化する。

budget exhaustionでquality gateを弱めずBLOCKED。

## Provider neutrality

ArticleJobSpecにprovider/model名を埋め込まない。

provider selectionはexecution profile所有。

## Mutability

material spec changeはdownstream stalenessを発生させる。

同じworkspaceのhistoryを上書きするよりnew attempt / child jobとしてlineageを残す。
