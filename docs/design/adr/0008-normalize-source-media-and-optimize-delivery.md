---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0008: camera sourceをprivate canonical mediaへ正規化しdelivery variantsを自動生成する

## Context

記事・project・site visualにはiPhone HEIC/HEIF、JPEG/PNG、screenshot、AI生成raster等が入る。

raw sourceをGit/public storageへ直接置くと:

- HEIC decoder依存がsite buildへ漏れる
- GPS/EXIF等のprivacy riskがある
- repository historyがbinaryに比例して肥大化する
- authorがresponsive variantsを手作業する負担が増える
- lossy public artifactから再encodeすると将来profile変更で品質が累積劣化し得る

## Decision

- HEIC / HEIFをfirst-class ingest inputとする。
- raw camera/provider originalはGit/public R2/private canonical source planeへそのまま長期保存しない。
- dedicated media-ingest toolchainでorientation、sRGB、private metadata strip、bounded dimensionsをdeterministicに正規化する。
- rasterのprivate canonical masterはversioned profileのlossless WebPをbaselineとする。safe SVGはsanitized vector sourceを維持できる。
- semantic visual/masterをindependent auditした後にだけdelivery variantsを生成する。
- responsive AVIF/WebP/fallbackはversioned profileからdeterministicにprebuildする。
- photo/screenshot/AI raster/project/site photographic hero等のpublic binaryはsizeに関係なくR2-firstとする。
- GitはMDX、registry、hash/profile/provenance、小さなdeterministic SVG/icon等だけを標準とする。
- authorはAVIF/WebP/width/qualityを記事ごとに手管理しない。
- Cloudflare Images等provider transformはoptional adapterでありbaseline correctness requirementにしない。

## Media planes

```text
raw user/provider input
 -> private canonical master
 -> visual audit
 -> deterministic delivery variants
 -> human approval
 -> private canonical source storage
 -> public immutable delivery objects
 -> protected exact-byte recovery copy
```

各persistent mutationはArticle Job state/approval contractに従う。

## Alternatives

### iPhoneをJPEG撮影へ固定

Web implementation都合をauthoring deviceへ漏らすため不採用。

### typical imageを`src/assets/content`へcommit

小規模では簡単だがGit history/clone/CIが画像数に比例して成長するため長期baselineにはしない。

### raw HEIC/JPEG originalをsite private R2へ永久保存

future re-encodeには有用だがGPS/device metadataを含むpersonal archive責務までsiteへ取り込むため不採用。privacy-normalized canonical sourceだけを保持する。

### all imagesをCloudflare Imagesへ直接依存

provider feature/cost/enablementがpublication correctnessへ入るためbaselineにはしない。

## Consequences

- dedicated/pinned media toolchainが必要。
- private canonical sourceとpublic delivery/recovery identityを分離できる。
- Git repository growthをphotographic/raster media countから切り離せる。
- exact processing profile/toolchainをcandidate/provenanceへbindする必要がある。
- future profile変更はcanonical sourceからnew candidateとして再生成できる。

## Related

- `contracts/media-ingest-contract.md`
- `contracts/media-variant-generation-contract.md`
- `contracts/private-canonical-media-storage-contract.md`
- ADR-0014
- ADR-0020
- ADR-0022
