---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - content media asset registry contract
  - hero asset resolution
---

# Media Asset Registry Contract

## Purpose

記事frontmatter / MDXからstorage pathとmedia provenanceを分離し、content identityに対してmedia roleを解決する。

特にBlog heroはfrontmatterでpathを持たず、このregistryから解決する。

## MediaAssetRecord

```ts
interface MediaAssetRecord {
  schemaVersion: 1;
  assetId: string;
  contentId: string;

  role:
    | "hero"
    | "inline"
    | "gallery"
    | "download"
    | "social_source";

  origin:
    | "camera"
    | "screenshot"
    | "diagram"
    | "ai_generated"
    | "deterministic_cover";

  storage:
    | {
        kind: "local";
        relativePath: string;
      }
    | {
        kind: "r2";
        logicalPath: string;
      };

  media: {
    format: string;
    width?: number;
    height?: number;
    sizeBytes: number;
    sha256: string;
  };

  provenanceRef: string;
  visualAuditRef?: string;
  status: "active" | "retired";
}
```

## Asset identity

`assetId`はstorage pathではない。

path変更、local→R2 migration、format変更でarticle content identityを変えない。

actual bytesが変わる場合はnew media hash / provenanceを持つversioned recordとして更新する。

## Hero invariant

公開Blog記事はcontent IDごとにexactly one:

```text
role = hero
status = active
```

を持つ。

複数active heroはvalidation error。

hero storage / originをfrontmatterへ複製しない。

## Inline image relation

通常Markdown inline imageはlocal relative importを直接利用できる。

すべてのinline imageをregistry必須にしない。registry化は次で利用する。

- Article Jobで生成 / ingestしたasset lineage
- Gallery等で複数role管理が必要
- R2 storage
- download asset
- hero / social source

普通の手書きlocal imageまで過剰registry化しない。

## Generated social card

social cardは`role=hero` visual + actual metadataからdeterministic生成するbuild artifactであり、通常registryへauthoring assetとして登録しない。

candidate manifestは生成されたsocial card hashを保持する。

## Provenance

`provenanceRef`はorigin別recordへ解決する。

- camera / screenshot: media ingest record
- AI generated: GeneratedImageRecord
- deterministic cover: cover-generation manifest
- diagram: source / generator record

AI originはvisual audit required。

## R2

R2 `logicalPath` はversioned / immutableを基本とする。

provider bucket ID / account IDはsite repository asset recordへ持たない。

## Registry storage

implementation candidate:

```text
apps/site/src/content-registry/media-assets.ts
```

ただしArticle Job export頻度・record数が増える場合、generated registryをcontent ID単位へ分割してよい。

exact storage shapeはperformance / merge conflictを測定して決定する。
