---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# vNext Open Decisions

未決事項を「あとで考える」で放置せず、確定に必要なevidenceとphaseを記録する。

current specificationのSoTではない。決定後はcanonical doc / machine-readable configへ反映し、materialならADRを作る。

## O1. Media ingest numerical profiles

未決:

- photo master max dimension
- JPEG/fallback master quality
- screenshot master policy
- hero normalization dimensions

確定:

- representative iPhone HEIC / screenshot fixture
- visual quality / R2 master size / retina delivery比較

phase: media-ingest implementation前。

## O2. AI execution profiles

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

## O3. Article resource budgets

未決:

- max source discovery calls
- semantic revision count
- image candidate count
- retry budget

representative jobsのdry-runからfinite conservative defaultsを決める。

## O4. Performance budgets

未決:

- route-class JS/CSS byte budget
- image transfer target
- lab thresholds beyond Core Web Vitals

legacy/vNext baselineとrepresentative mobile profileで確定。

phase: visual redesign前。

## O5. Visual style profile

未決:

- palette / texture / illustration style
- hero composition
- social card design

visual redesignで複数candidate比較。

architectureはversioned style profileだけ固定済み。

## O6. Comparison module API

representative article fixtureで実需要を確認してchild API固定。

premature generic layout builderを避ける。

## O7. Exact legacy tag / branch naming

annotated tag必須、legacy branch optional。

exact remote-safe nameはcutover taskで決定。

## O8. Cloudflare production exact values / cutover

**control-plane architectureは解決済み。**

確定:

- production CI/CD = GitHub Actions
- Worker/static asset deploy = Wrangler
- Cloudflare Workers Builds / Pages dashboard build settingsをproduction SoTにしない
- Worker custom-domain binding = `Xpotato-Server` OpenTofu/API
- DNS / R2 bucket / R2 custom domain / CORS / lifecycle / Bucket Lock / Cache/Compression/redirect Rules = `Xpotato-Server` desired state
- normal operationでCloudflare Dashboard configurationを要求しない
- Dashboard = bootstrap / billing / account recovery / break-glass / true provider-gap exception

未決なのはimplementation exact valueのみ:

- GitHub Actions trigger / environment approval policy
- Wrangler exact pinned version / command
- Cloudflare provider exact pinned version
- site deploy / infra plan / infra apply token permission sets
- existing Cloudflare Workers Builds/Pages stateが存在する場合のretire/cutover procedure
- zone-level Cache/Compression Rulesのexact measured values

Dashboard手順を未決事項として持たない。

## O9. Media delivery numerical profiles

**delivery architectureは解決済み。**

baseline:

- deterministic prebuilt R2 variants
- Cloudflare Images Transformationsはoptional adapter
- Cloudflare Imagesが無効でもnormal responsive delivery成立

未決:

- inline/hero/gallery responsive widths
- AVIF/WebP/fallback encode quality
- screenshot lossless/lossy profile
- exact quality profile
- optional Cloudflare Imagesを有効化するperformance/cost threshold

representative masterをmobile/desktop DPR別に測定して確定。

## O10. Private raw media retention

未決:

- iPhone original long-term location
- backup / retention
- AI raw generated image retention

public deliveryとは別trust boundary。private infrastructure方針と突合する。

## O11. Published R2 media retention / garbage collection

default: published versioned objectを自動削除しない。

未決:

- never-published orphan grace period
- retired published object retention
- retained Git tag/releaseをGC protectionへ含めるexact rule

actual storage growth / rollback requirementから決定。

## O12. Interactive module bundle budget classes

`small | medium | large`のexact byte threshold未決。

vNext foundation + PrimeFactorizer migration後に測定。

## O13. Published media protection exact infra values

**保護の要否とArticle Job gateは解決済み。**

vNextではpublic R2 mediaを唯一のrecovery copyにせず、`MEDIA_PUBLISHED -> MEDIA_PROTECTED -> EXPORTED`をhard gateとする。

initial protection classはCloudflare内のdestruction-resistant protected copy。provider-independent second copyはlaunch hard requirementにしない。

infra側で未決なのはexact implementation values:

- protection prefix/bucket exact shape
- Bucket Lock期間
- lifecycle expiration
- publicationからprotection完了までのSLO/RPO相当
- scheduled integrity verification cadence

これらは`Xpotato-Server` machine-readable desired stateの責務。

migration cutoverでold Git media copyを削除する前にrepresentative restore drill必須。

## O14. Discovery profile remaining values

architectureはarchive/RSS/related/Pagefind Extended選択まで確定済み。

current inventoryはBlog 44 / Projects 6 / Notes 1 / Tools 1。

initial design defaults:

- Blog pagination: 12 items/page
- Notes pagination: 12 items/page
- RSS: 20 items
- RSS mode: `summary`
- related content: max 4 items

理由:

- current Blog 44件を4 pageへ自然に分割
- 12は2/3/4-column layoutで扱いやすい
- full RSSで長文/media/interactive contentを複製しない
- relatedを本文末尾で過密にしない

未決:

- related score weights / minimum score
- Pagefind exact pinned version
- initial search UI adapter
- Japanese search regression fixture set

phase: discovery implementation前。

## O15. Technical example execution profiles

contract / isolated workspace boundaryは確定済み。

current migration fixturesにはBash/PowerShell/SQL/technical benchmark articleが存在する。

未決:

- initial supported languages/runtimes
- runtime versions
- resource/time limits
- network-enabled profileが本当に必要か
- shell command risk classifierのexact rule set

初期はselected migration fixtureから最小profileだけ作り、generic remote code execution platform化しない。

## Resolved during design

### Initial taxonomy seeds

2026-08-26 inventoryで解決。

Blog 44件をinitially:

- `software`: 31
- `infrastructure`: 12
- `robotics`: 1

へpartitionする。

`devlog`はtopical categoryではなくArticle Job modeへ移す。`network`はinitial top-level categoryにせずtag/topicへ、published 0件の`app`もseedしない。

Notes subject seed: `infrastructure`。

Tool category seed: `calculation`。

exact tag registryはfrozen legacy scanからmachine generation + human alias/merge reviewで作る。proseへ全tagを第二SoTとして列挙しない。

### Media placement boundary

current Gitにはknown raster/photo mediaだけで約4.54 MBあり、Project overview / WordPress images / photographic UI heroが混在することを確認。

vNext:

- photo / screenshot / raster project/content/site hero / AI raster / gallery -> R2-first
- small deterministic SVG / logo / favicon / icon / tiny texture / test fixture -> Git candidate

に確定。

### Cloudflare dashboard boundary

normal operationはGit-driven control plane。

- GitHub Actions + Wrangler site deployment
- OpenTofu/API infrastructure
- Dashboardはbootstrap/billing/recovery/break-glass

に確定。

### Responsive media provider dependency

prebuilt responsive R2 variantsをbaselineとし、Cloudflare Images Transformationsはoptional adapterに確定。

### Collection-specific schemas outside Blog

Notes / Projects / Tools / Pages contract定義済み。

### ContentId encoding

lowercase canonical RFC 4122 UUID v4に確定。Node toolchain built-in generatorを利用できる。

### Static search engine

Pagefind Extendedに確定。Japanese specialized segmentation supportを利用する。exact version/UIはO14。

### Compatibility redirects

current meta-refresh compatibility pages:

- `/blog/prime-factorizer/`
- `/blog/category/tools/`

はvNextでreal application path 301 redirectへ昇格する。
