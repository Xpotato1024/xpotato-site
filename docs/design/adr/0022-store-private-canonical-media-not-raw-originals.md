---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0022: raw camera originalではなくprivacy-normalized canonical media sourceをprivate保存する

## Context

vNextはiPhone HEIC/HEIFをfirst-class inputとして扱い、media delivery profileを将来変更できることを目標にする。

public delivery用JPEG/WebP/AVIFだけを保存すると、将来quality/width/formatを変更する際にlossy public artifactから再encodeすることになり品質劣化が累積し得る。

一方、raw HEIC/JPEG/PNG originalをCloudflare site infrastructureへ長期保存すると:

- GPS/EXIF/device metadata等のprivacy-sensitive sourceが蓄積する;
- personal photo archive responsibilityをwebsite platformが背負う;
- raw/source retention policyがpublication recoveryと混同される;
- storage/credential blast radiusが増える。

さらにcurrent public exact bytesのrecoveryはADR-0020のprotected-media planeで別途解決している。

したがって「future re-encoding source」と「raw personal original」と「published exact-byte recovery」を分離する必要がある。

## Decision

### Raw original

HEIC/JPEG/PNG/original screenshot/AI provider raw outputはArticle Job/user input。

- Gitへ保存しない;
- public media planeへ直接publishしない;
- websiteのprivate source-media bucketへrawのまま自動長期保存しない;
- full Article Job workspace cleanup後に失われてもcurrent published recoveryを壊さない設計にする。

personal original backupはwebsite architectureの責務外。

### Private canonical source

approved mediaにはprivacy-normalized canonical sourceを作る。

initial raster profile:

```text
lossless WebP
sRGB 8-bit
orientation normalized
private metadata stripped
max long edge 8192
no upscale
```

trusted vectorはsanitized SVG。

human approval後、public delivery publication前にseparate private source-media object storageへcontent-addressed immutable objectとしてstore/reuseする。

### Purpose

canonical source planeは:

- future AVIF/WebP/JPEG width/quality profile regeneration;
- lossy chained re-encoding回避;
- approved semantic visual/source identityの長期保持;

を担当する。

### Not recovery authority for current public bytes

current published objectのexact recoveryはseparate protected-media planeが担当する。

canonical sourceから再encodeして近い画像を作れることをexact restoreと呼ばない。

### Initial storage protection

source-media planeはinitially:

- private/no public custom domain;
- content-addressed;
- no automatic expiration;
- normal credential no Delete/config admin;
- Bucket Lock hard requirementなし。

source bucket lossは`REPROCESSING_SOURCE_DEGRADED`であり、current public site lossではない。

## Why not raw original retention

raw original retentionをwebsite platformのdefaultにするとprivacy/data-management scopeが過剰に広がる。

必要なpublication derivative再生成には、metadata-stripped canonical pixel sourceで十分である。

raw originalそのものの価値（写真library、camera metadata、編集履歴）はwebsiteとは別personal archive concern。

## Why lossless WebP

raster canonical sourceはpublic delivery formatではなくintermediate preservation format。

lossless WebPにより一度privacy normalizationしたpixel sourceをlossy圧縮せず保持し、AVIF/WebP/JPEG variantsを同じcanonical pixelsから再生成できる。

WebP format limits内に収まるようmax long edge 8192をprofileで固定する。

## Consequences

Positive:

- raw GPS/EXIFをCloudflare website storageへ恒久蓄積しない;
- future media profile変更でlossy chainを避ける;
- source/public/protected rolesが明確;
- user personal photo backupとsite publicationを分離できる;
- full Article Job archiveをlaunch requirementにしなくてよい。

Negative:

- private source-media bucket/storageが追加される;
- canonical source自体はraw originalの完全archiveではない;
- source-media loss時、future high-quality reprofile capabilityが低下する;
- canonical profile/toolchainをversioned管理する必要がある。

## Alternatives rejected

### Raw HEIC/JPEG originalをprivate R2へ永久保存

privacy/scope/storage burdenが大きく、website publication requirementを超えるため不採用。

### Public 2560px JPEGだけをsourceにする

future AVIF/WebP/JPEG reprofileでchained lossyとなるため不採用。

### Protected public bytesだけ保持

exact current recoveryには十分だが、新profile生成の高品質sourceにならないため単独では不十分。

### Git LFS

website media sourceをrepository checkout/version controlへ結合する必要がなく、Git/LFS operation surfaceを増やすため不採用。

## Revisit triggers

- personal raw-photo archivalがwebsiteと統合すべきexplicit requirementになる;
- lossless WebPがtoolchain/format制約を満たさなくなる;
- source-media storage growthがmaterialになる;
- source-media lossが許容不能となりlock/secondary backup requirementが発生する。

## References

- `../../contracts/media-ingest-contract.md`
- `../../contracts/private-canonical-media-storage-contract.md`
- `../../operations/media-processing-profiles.md`
- ADR-0020 protected-media recovery decision
