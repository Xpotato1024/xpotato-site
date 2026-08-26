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

Article Job は、1件の公開候補コンテンツを生成・監査・承認・exportするための最上位 work unit である。

Article Job は「AI session」や「Git branch」を identity としない。入力条件を正規化した job specification と、そこから生成される immutable artifact lineage を正とする。

## Logical schema

実装時は TypeScript / Zod を machine-readable SoT とし、この文書は field semantics の正本とする。

```ts
interface ArticleJobSpec {
  schemaVersion: 1;
  jobId: string;

  target: {
    collection: "blog" | "notes" | "projects" | "tools" | "pages";
    mode:
      | "explanation"
      | "tutorial"
      | "investigation"
      | "build_log"
      | "incident"
      | "comparative_review";
    workingTitle: string;
    slugHint?: string;
    existingContentId?: string;
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
    externalUpload: boolean;
  };
}
```

## Job ID

`jobId` は人間可読の表示名ではなく opaque unique identifier とする。

slug、記事title、branch名から導出しない。slug変更でjob identityが変わるべきではないためである。

実装候補はUUIDv7等の時間順序性を持つIDだが、IDアルゴリズム自体はmachine-readable implementation contractで固定する。

## Job fingerprint

job fingerprint は canonical serialization した `ArticleJobSpec` の SHA-256 とする。

canonical JSON rules:

- UTF-8
- object key orderをcanonicalize
- array orderはsemantic orderとして保持
- insignificant whitespaceを含めない
- date / enum / boolean representationをschemaで固定

除外してよいのは、計算時刻やUI表示用comment等、semantic inputではないfieldだけである。除外fieldはschemaで明示する。

## Existing article update

既存記事更新では `existingContentId` を必須とし、現在公開中 article bytes / metadata / media refs を source artifact として固定する。

update job は「新記事生成」と同じpipelineを使えるが、human review packageに before / after diff を追加する。

## Permission semantics

permission は capability grant ではなく、そのArticle Jobで許可された上限である。

例えば `externalImageAI = false` のjobでは、visual plannerがAI heroを推奨してもexecutorはimage backendを呼ばない。

`externalUpload` はR2等へのupload permissionであり、Article Jobの通常exportには不要とする。

## Resource budgets

Article Jobはunbounded agent loopにしない。

実装policyで少なくとも次のbudgetを持つ。

- source discovery request count
- external text AI call count
- semantic revision count
- image generation candidate count
- visual revision count
- maximum artifact bytes
- maximum job workspace bytes

exact値はmachine-readable profileのSoTとし、docsへ重複固定しない。

budget exhaustionはconstraintを弱める理由にせず`BLOCKED`へ進める。

## Provider neutrality

ArticleJobSpecにprovider/model名を埋め込まない。

provider selectionはexecution profile側が所有する。Jobは「external text AIを許可するか」等のpermissionだけを持つ。

これによりmodel replacementでcontent request semanticsが変わらないようにする。

## Mutability

job specをmaterialに変更した場合、同じjob workspaceを暗黙継続しない。

- editorial wordingのtypo等、semantic fingerprintに影響しないfieldだけ変更可能
- target、reader outcome、required claim、permission等が変わる場合は新fingerprintを生成
- downstream artifactはstaleとして扱う

実装時はstate rewindで履歴を書き換えるより、新attempt / child jobとしてlineageを残す方式を優先する。
