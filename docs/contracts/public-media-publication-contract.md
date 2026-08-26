---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - public media object identity
  - R2 object key policy
  - approved media publication transaction
---

# Public Media Publication Contract

## Principle

content mediaはsemantic asset identityとphysical object identityを分離する。

- MDX / frontmatter: semantic identity
- Git Media Registry: semantic -> immutable object binding
- R2: normalized public bytes

public objectを同じkeyへ破壊的上書きしない。

## Media object identity

normalized public Web masterのexact bytesをSHA-256で識別する。

```ts
interface PublicMediaObject {
  sha256: string;
  format: "jpeg" | "png" | "webp" | "avif" | "svg";
  width?: number;
  height?: number;
  sizeBytes: number;
  contentType: string;
  objectKey: string;
}
```

`objectKey`はhashから決定的に導出する。

logical pattern:

```text
media/v1/objects/sha256/<first-two>/<sha256>.<ext>
```

例:

```text
media/v1/objects/sha256/8a/8a3f...c91.jpg
```

exact prefixはimplementation configで固定できるが、次を満たす。

- bytes identityをkeyへ含める
- same bytes -> same key
- changed bytes -> new key
- semantic article slugをobject identityへ要求しない

## Why content-addressed keys

- overwriteを構造的に避けられる
- Git rollback時、旧registryが旧objectを指せる
- identical normalized bytesはdeduplicate可能
- cache purgeを前提にしない
- Article Job candidate段階でupload先を事前計算できる

## Semantic asset identity

articleはobject hashを直接参照しない。

例:

```text
contentId: blog:nas-memory-upgrade
assetId: nas-memory-slot
```

`assetId`はcontent内で安定したsemantic ID。

写真を差し替えてもassetIdを維持できる。Git revisionごとのMedia Registryが、その時点のobject hashへbindする。

## Candidate media object

human approval前はR2へpublic uploadしなくてよい。

Article Job candidateはlocal private stagingにexact normalized masterを持ち、次を固定する。

```ts
interface CandidateMediaObject {
  assetId: string;
  localArtifactSha256: string;
  plannedObject: PublicMediaObject;
  provenanceRef: string;
}
```

planned object keyはhashから決まるため、preview / approval前に確定できる。

## Publication timing

**public R2 mutationはhuman approval後。**

normal path:

```text
candidate
  -> preview
  -> human approval
  -> media publication
  -> repository export
```

previewはlocal candidate media adapterを使用できるため、public uploadを要求しない。

## MediaPublicationRequest

```ts
interface MediaPublicationRequest {
  schemaVersion: 1;
  jobId: string;
  candidateSha256: string;
  approvalRecordSha256: string;
  objects: CandidateMediaObject[];
  publicUploadAuthorized: true;
}
```

AI / Skillは`publicUploadAuthorized`を自己生成できない。

human approval laneまたは明示operator policyからのみ成立する。

## Upload behavior

objectごとに:

1. planned keyを計算済みであることを確認
2. R2に同keyが存在するか確認
3. 存在しない -> exact candidate bytesをupload
4. 存在する -> expected object identityと矛盾しないことを検証してreuse
5. upload/reuse後にsize / content metadata / availabilityを検証
6. publication manifestへ結果を記録

既存keyへ異なるbytesを上書きして解決しない。identity mismatchはintegrity failure。

## Response headers

content-addressed public masterは長期cache可能。

application requirement:

```text
Cache-Control: public, max-age=31536000, immutable
```

exact header ownership / provider application methodはdeployment / infrastructure contractに従う。

## MediaPublicationManifest

```ts
interface MediaPublicationManifest {
  schemaVersion: 1;
  jobId: string;
  candidateSha256: string;
  approvalRecordSha256: string;
  objects: Array<{
    assetId: string;
    sha256: string;
    objectKey: string;
    action: "uploaded" | "reused";
    verifiedSizeBytes: number;
    verifiedAt: string;
  }>;
  completedAt: string;
  manifestSha256: string;
}
```

repository exportはこのmanifestに含まれるobjectだけをMedia Registryへbindする。

## Failure semantics

upload途中で失敗してもapproved candidateをmutateしない。

jobは`HUMAN_APPROVED`に留まり、same candidate / approvalでidempotent retryできる。

部分uploadされたobjectはcontent-addressed immutable objectなのでretry時にreuseできる。

## Orphan objects

### Never-published orphan

upload成功後にGit exportが一度も成立しなかったobjectはorphan候補になり得る。

garbage collectionはgrace period後に:

- current Git media registry
- retained release/tag registry
- active Article Job publication manifest

を確認してからplanする。

### Previously published object

過去Git revision / rollbackに必要なobjectを自動削除しない。

R2はmedia historyを保持するためのstorage planeであり、Gitからbinaryを追い出す代わりにversioned objectを保持する。

retired published objectの削除はexplicit archival policy対象。

## Raw media

private HEIC / original photo / AI raw outputはこのpublic R2 namespaceへ置かない。

private raw retentionは別trust boundary。

## Infrastructure boundary

site repositoryは:

- logical object key contract
- object identity
- media publication manifest
- required cache semantics

を所有する。

bucket resource / account / credential / provider lifecycleは`Xpotato-Server`側SoT。
