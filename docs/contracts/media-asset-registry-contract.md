---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - content media asset registry contract
  - hero asset resolution
  - R2-backed media identity
---

# Media Asset Registry Contract

## Purpose

記事frontmatter / MDXからstorage pathとmedia provenanceを分離し、content identityに対してmedia roleを解決する。

通常の記事写真・スクリーンショット・AI heroの公開masterはR2を標準とし、Gitへbinary masterを継続蓄積しない。

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
        kind: "r2";
        logicalKey: string;
      }
    | {
        kind: "git";
        relativePath: string;
        justification: "small-site-asset" | "textual-vector" | "test-fixture";
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

## Storage default

`storage.kind = "r2"` がcontent mediaのdefault。

Git storageは例外であり、次に限定する。

- favicon / logo / small UI graphic等のsite-owned small asset
- source textとしてdiff可能な小さなSVG
- deterministic test fixture

通常の記事写真、記事スクリーンショット、gallery、AI生成heroをGitへ置かない。

Git LFSをcontent mediaの標準にしない。LFSはbinary versioningがsource workflowに不可欠な場合の別手段であり、公開object deliveryのためにはR2の方が責務が直接的である。

## Asset identity

`assetId`はstorage pathではない。

R2 key変更、delivery backend変更、format変更でarticle content identityを変えない。

actual bytesが変わる場合はnew media hash / provenanceを持つversioned recordとして更新する。

## R2 key policy

R2 masterはimmutable / versioned keyを使う。

概念例:

```text
media/<collection>/<content-id>/<asset-id>/<sha256>.<ext>
```

exact prefixはimplementation configをSoTとする。

同一keyの破壊的overwriteを通常workflowで許可しない。

provider bucket ID / account IDはsite repository asset recordへ持たない。

## Hero invariant

公開Blog記事はcontent IDごとにexactly one:

```text
role = hero
status = active
```

を持つ。

複数active heroはvalidation error。

hero storage / originをfrontmatterへ複製しない。

## Inline image reference

通常MDXはstorage URLを直書きしない。

論理asset referenceを使用する。

概念例:

```md
![NAS内部のメモリスロット](media:nas-memory-slot)
```

build plugin / content rendererが`media:<asset-id>`をregistryへ解決し、responsive `srcset` / dimensions / delivery URLを生成する。

これによりR2 custom domainやdelivery backendを変更しても記事本文を書き換えない。

remote arbitrary URLは外部引用画像等の例外として扱い、site-owned mediaの標準にしない。

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

## Registry storage

registry自体はtext / structured dataなのでGit管理する。

implementation candidate:

```text
apps/site/src/content-registry/media-assets/
  <content-id>.ts | .json
```

record数増加時のmerge conflictを避けるため、巨大な単一registry fileにはしない。
