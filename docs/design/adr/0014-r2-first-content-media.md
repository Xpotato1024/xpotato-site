---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0014: photographic/raster site mediaはR2-firstとしGitへ蓄積しない

## Context

写真、screenshot、AI-generated hero、Project overview、photographic site hero等はcontent量とともに増える。一度Gitへcommitしたbinaryはarticleから削除してもhistoryへ残り、clone/fetch/CI/backupへ継続的なtransfer costを与える。

現行inventoryでもphotographic/raster mediaが既にGitへ存在し、長期publishing platformではsource/textとmedia bytesを分離する必要がある。

## Decision

- photographic/raster **content・project・site visual**をR2-firstにする。article mediaだけに限定しない。
- Gitに標準で保持するのはMDX、Media Registry、hash/dimensions/profile/provenance、small deterministic SVG/logo/icon/fixture等。
- Git LFSをnormal media planeにしない。
- MDXはphysical R2 URL/object keyではなくsemantic asset IDを参照する。
- public media objectはcontent-addressed immutable keyを使用し、same keyへのdifferent bytes overwriteを禁止する。
- baseline responsive deliveryは**deterministic prebuilt variants**。Cloudflare Images Transformations等はoptional adapter。
- Article Job candidate previewはprivate/local master+variant adapterを使い、approval前のR2 access/uploadを要求しない。
- normal production site buildはR2 media bytesをdownloadせず、Git registryに記録されたdimensions/object identityからHTMLを生成する。
- public R2だけをrecovery authorityにせず、separate protected media contractを要求する。

## Git-bundled exceptions

Gitへ置けるcandidate:

- small deterministic SVG
- logo / favicon / icon
- tiny design-system texture
- synthetic test fixture

「ファイルが小さい」という理由だけでphoto/screenshotをGitへ戻すescape hatchにはしない。

## Alternatives

### `src/assets` + Astro image optimizationをnormal media storeにする

Git history/build sourceがmedia countへ比例するため長期baselineとして不採用。

### Git LFS

binary storageを分離できるが、content checkout/LFS client/quota/fetch lifecycleを追加する。site publication mediaはrepository checkoutに含まれる必要がないため不採用。

### Cloudflare Images hosted/transform-first

provider-specific feature/cost/availabilityへcorrectnessが依存するためbaselineにはしない。optional delivery optimizationとしては許容する。

## Consequences

Positive:

- repository growthをmedia countから分離できる。
- storage/CDN/providerをMDXから切り離せる。
- exact prebuilt bytesをapproval/protection対象にできる。
- Cloudflare Images停止時もnormal deliveryを維持できる。

Costs:

- logical media resolver / registry / external object validationが必要。
- media publication/source/protection operationがArticle Jobへ増える。
- public provider stateは`Xpotato-Server`とのexact handoffを必要とする。

## Related

- `architecture/media-pipeline.md`
- `contracts/media-asset-registry-contract.md`
- `architecture/infrastructure-handoff.md`
- ADR-0008
- ADR-0018
