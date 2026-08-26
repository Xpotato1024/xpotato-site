---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - media ingest pipeline
  - media storage plane semantics
  - responsive image delivery
---

# Media Pipeline

## Purpose

mediaをGit binary archive化せず、privacy-safe・reprocessable・responsive・recoverableなWeb mediaへ変換する。

current Gitには既にknown raster/photo約4.54 MBがあり、vNextはこのgrowth patternを継承しない。

## Storage/processing layers

```text
raw job/user source
  HEIC/JPEG/PNG/AI raw
      |
      | deterministic ingest
      v
private canonical master
  privacy-normalized lossless WebP / sanitized SVG
      |
      | semantic visual audit
      v
private delivery variants
  AVIF/WebP/fallback
      |
      | candidate + human approval
      v
+----------------------+----------------------+
|                                             |
v                                             v
private source-media R2                 public delivery R2
canonical re-encode source              master + variants
                                              |
                                              v
                                      private protected-media R2
                                      exact public bytes / locked
```

raw source、canonical source、public delivery、protected recoveryを別semanticにする。

## Placement boundary

R2/off-Git:

- camera photo
- screenshot
- raster Blog/Note/Project/Tool visual
- photographic/raster site hero/background
- AI-generated raster
- gallery

Git candidate:

- small deterministic SVG
- logo/favicon/icon
- tiny text-reviewable texture/graphic
- synthetic fixture

## 1. Raw source

- HEIC/HEIF
- JPEG/PNG/WebP
- original screenshot
- AI provider raw output

rules:

- Gitへcommitしない
- public R2へ直接置かない
- private source-media R2へraw camera originalを自動保存しない
- camera GPS/EXIF等をsite long-term storageへ持ち込まない
- full raw/job artifact retentionは`operations/article-job-retention-policy.md`

## 2. Private canonical master

`media-ingest-contract.md` + `operations/media-processing-profiles.md`を正とする。

raster v1:

- lossless WebP
- sRGB 8-bit
- orientation normalized
- private metadata stripped
- max long edge 8192
- no upscale

目的:

- visual audit target
- delivery variant generation source
- future format/quality reprofile source

AI-generated visualもsame downstream canonical pathへnormalizeする。

## 3. Semantic visual audit

canonical master/visualをauditした後だけdelivery variantsを生成する。

AI conceptual visualはtechnical evidenceではない。

fake UI/terminal/metric、rights/safety、composition等を確認する。

## 4. Deterministic delivery variants

`media-variant-generation-contract.md` + media processing profiles。

- finite widths
- AVIF/WebP/fallback
- screenshot lossless profile
- no upscale
- profile/toolchain/hash manifest
- no network
- no Cloudflare Images API

variantはGitへcommitしない。

## 5. Human approval

candidateは:

- canonical source SHA/profile
- delivery master/variant SHA/profile
- rights/provenance
- visual audit
- planned private/public object identities

をbindする。

approval前にpersistent source/public/protected R2 mutationをしない。

## 6. Private source-media R2

approval後、public publication前にprivacy-normalized canonical sourceをcontent-addressed private objectとしてstore/reuseする。

exact contract=`private-canonical-media-storage-contract.md`。

initial:

- private
- no custom domain
- raw original禁止
- content-addressed
- no automatic expiration
- normal writer no Delete/config admin
- Bucket Lock initial requirementなし

source-mediaはfuture re-encoding authorityであり、current published bytesのrecovery authorityではない。

## 7. Public delivery R2

approved delivery master + required variantsだけをcontent-addressed immutable keyへpublishする。

- same bytes -> same key
- changed bytes -> new key
- same key/different bytes禁止
- `Cache-Control: public, max-age=31536000, immutable`
- Media Registryがsemantic asset -> delivery setを解決

Cloudflare Imagesなしでnormal behavior成立。

## 8. Protected recovery R2

exact public delivery object setをseparate private protected-media bucketへcopy/reuseする。

initial:

- private/no public domain
- Bucket Lock indefinite
- no automatic expiration
- writer no Delete/config/lock modification

`MEDIA_PROTECTED`成立後だけGit export。

## 9. Logical MDX reference

```md
![メモリスロット](media:nas-memory-slot)
```

MDXはsource/public/protected bucket、URL、object keyを知らない。

Media Registryからresponsive HTMLへ解決する。

## iPhone / HEIC flow

1. HEIC probe/decode
2. orientation normalize
3. sRGB8
4. private metadata strip
5. lossless canonical WebP
6. semantic visual audit
7. delivery variants
8. human approval
9. private canonical source store
10. public delivery publish
11. protected exact-byte copy
12. Git registry/provenance export

JPEG撮影をauthorへ要求しない。

## AI-generated media

provider raw output:

- job-private immutable artifact during generation/audit
- provider/model/request/raw hash retained as compact lineage
- canonical normalized source is durable private media source after approval
- raw provider bytes are not launch long-term archive requirement

## Media rights

Web discovery != republication rights。

rights unknown external imageはR2へ転載せずlink/self-created diagram/authorized source/AI conceptual visualへ切替。

## Delivery adapter

baseline:

```text
public R2 immutable prebuilt variants
 -> custom domain/CDN
 -> <picture>/<srcset>
```

Cloudflare Images Transformationsはoptional performance adapterでありcanonical object setではない。

## Lifecycle

- source/public objects: normal Article Jobがdeleteしない
- protected: indefinite lock initial
- GC/retirement policyはstorage growthがmaterialになった時点のseparate privileged decision
- full job workspaceはexplicit cleanup policy

## Validation

network-free:

- no HEIC/raster content binaries in Git
- direct R2 URL/`r2:/` authoring禁止
- canonical profile/hash valid
- variant manifest complete
- media logical refs resolve
- rights/provenance valid

external:

- private canonical source receipt exact SHA
- source bucket not public
- public delivery set exact identity/cache metadata
- protected receipt exact object-set match
- representative source re-encode succeeds
- protected restore same SHA

## Sources

- Apple HEIF/HEVC: https://support.apple.com/ja-jp/116944
- Cloudflare R2: https://developers.cloudflare.com/r2/api/
- optional Images transforms: https://developers.cloudflare.com/images/optimization/transformations/overview/
