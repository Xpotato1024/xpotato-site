---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# vNext Open Decisions

未決事項を「あとで考える」で放置せず、確定に必要なevidenceとphaseを記録する。

current specificationのSoTではない。決定後はcanonical doc / machine-readable configへ反映し、materialならADRを作る。

## O1. Initial taxonomy records

未決:

- exact Blog category IDs/labels
- Note subject IDs
- Tool category IDs
- initial tag registry

確定:

- legacy migration inventory
- synonym / duplicate / one-off term集計
- broad taxonomy再設計

phase: content migration前。

## O2. Media ingest numerical profiles

未決:

- photo master max dimension
- JPEG quality
- screenshot master policy
- hero normalization dimensions

確定:

- representative iPhone HEIC / screenshot fixture
- visual quality / R2 master size / transform quality / retina delivery比較

phase: media-ingest implementation前。

## O3. AI execution profiles

未決:

- default text provider/model
- default vision auditor
- default image generator
- snapshots

architectureはprovider-neutral。

確定:

- implementation時点capability / price / structured output / image quality比較
- representative evalでP0/P1 / schema adherence確認

phase: Article pipeline provider implementation前。

## O4. Article resource budgets

未決:

- max source discovery calls
- semantic revision count
- image candidate count
- retry budget

representative jobsのdry-runからfinite conservative defaultsを決める。

## O5. Performance budgets

未決:

- route-class JS/CSS byte budget
- image transfer target
- lab thresholds beyond Core Web Vitals

legacy/vNext baselineとrepresentative mobile profileで確定。

phase: visual redesign前。

## O6. Visual style profile

未決:

- palette / texture / illustration style
- hero composition
- social card design

visual redesignで複数candidate比較。

architectureはversioned style profileだけ固定済み。

## O7. Comparison module API

representative article fixtureで実需要を確認してchild API固定。

premature generic layout builderを避ける。

## O8. Exact legacy tag / branch naming

annotated tag必須、legacy branch optional。

exact remote-safe nameはcutover taskで決定。

## O9. Cloudflare production integration details

未決:

- exact Workers build project setting
- app workspace build root/command
- zone-level compression/cache exact values

provider stateは`Xpotato-Server` SoTとimplementation時に突合。

## O10. Media delivery profiles

未決:

- inline/hero/gallery responsive widths
- AVIF/WebP/fallback order
- quality profiles
- Cloudflare Images adapter exact URL contract
- prebuilt R2 variant fallback profile

representative masterをmobile/desktop DPR別に測定して確定。

## O11. Private raw media retention

未決:

- iPhone original long-term location
- backup / retention
- AI raw generated image retention

public deliveryとは別trust boundary。private infrastructure方針と突合する。

## O12. Published R2 media retention / garbage collection

default: published versioned objectを自動削除しない。

未決:

- never-published orphan grace period
- retired published object retention
- retained Git tag/releaseをGC protectionへ含めるexact rule

actual storage growth / rollback requirementから決定。

## O13. Interactive module bundle budget classes

`small | medium | large`のexact byte threshold未決。

vNext foundation + representative Tool migration後に測定。

## O14. Published media protection policy

R2-first mediaはGitにbytesを持たないためbackup/recovery protectionが必要。

未決:

- protection backend exact design
- protection RPO
- `MEDIA_PUBLISHED -> EXPORTED`の間にhard protection gateを追加するか
- same-provider destruction-resistant copyとprovider-independent copyの段階
- protection receiptをArticle Job workspaceへどこまでbindするか

確定方法:

- current `Xpotato-Server` backup/recovery architectureへwebsite media data classを追加する設計
- R2 media representative restore drill
- publish latency / operational complexity比較

最低限、migration cutoverでold media copyを削除する前にrecovery pathをverifiedにする。

## O15. Discovery profile exact values

architectureはarchive/RSS/related/Pagefind選択まで確定済み。

未決:

- Blog/Notes page size
- RSS max item count
- RSS `summary | full`
- related max items / weights / minimum score
- Pagefind exact pinned version
- initial search UI adapter
- Japanese search regression fixture set

確定方法:

- migrated content count / article length distribution
- representative Japanese/English mixed queries
- output bytes / UX measurement

phase: discovery implementation前。

## O16. Technical example execution profiles

contract / isolated workspace boundaryは確定済み。

未決:

- initial supported languages/runtimes
- runtime versions
- resource/time limits
- network-enabled profileが本当に必要か
- shell command risk classifierのexact rule set

初期は必要なarticle fixtureから最小profileだけ作り、generic remote code execution platform化しない。

## Resolved during design

### Collection-specific schemas outside Blog

Notes / Projects / Tools / Pages contract定義済み。

### ContentId encoding

lowercase canonical RFC 4122 UUID v4に確定。Node toolchain built-in generatorを利用できる。

### Static search engine

Pagefind Extendedに確定。Japanese specialized segmentation supportを利用する。exact version/UIはO15。
