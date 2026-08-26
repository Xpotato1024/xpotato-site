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

確定方法:

- representative iPhone HEIC / screenshot fixture
- visual quality / normalized master size / retina delivery比較

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

- production site CI/CD = GitHub Actions
- Worker/static asset deploy = Wrangler
- Cloudflare Workers Builds / Pages dashboard build settingsをproduction SoTにしない
- Worker custom-domain/DNS/provider Rules = `Xpotato-Server` desired state
- OpenTofuをprovider-supported durable resourceの第一選択
- provider gapはofficial Cloudflare API reconcile adapter
- security-sensitive R2 bucket configuration desired valuesはGit管理するが、configuration admin credentialをCP/site CIへ常設しない
- R2 bucket config変更はoperator-authorized ephemeral admin credential + CLI/API read-back validation
- normal operationでCloudflare Dashboard configurationを要求しない
- Dashboard = bootstrap / billing / account recovery / break-glass / true provider-gap exception

未決なのはimplementation exact valueのみ:

- GitHub Actions trigger / environment approval policy
- Wrangler exact pinned version / command
- Cloudflare provider exact pinned version
- site deploy / infra read-plan / durable infra mutation token permission sets
- public-media publisher / protected-media writer exact R2 credential mechanism
- current Workers Builds/Pages stateが存在する場合のretire/cutover procedure
- zone-level Cache/Compression Rulesのexact measured values

Dashboard click手順を未決事項として持たない。

## O9. Media delivery numerical profiles

**delivery architectureは解決済み。**

baseline:

- normalized masterからdeterministic prebuilt R2 variants
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
- private raw backup / retention
- AI raw generated image retention

public/protected Web mediaとは別trust boundary。private infrastructure方針と突合する。

## O11. Public media garbage collection

default: published versioned public R2 objectをnormal Article Jobが自動削除しない。

initial protected-media copyはindefinite lock + no automatic expirationなので、protected storage reclamationもlaunch scope外。

未決:

- never-exported public orphan grace period
- public retired object retention / GC rule
- protected storage growthがmaterialになった場合のGit retained-ref-aware GC design

実storage growth / rollback requirementを観測してから別privileged policy/ADRを設計する。

## O12. Interactive module bundle budget classes

`small | medium | large`のexact byte threshold未決。

vNext foundation + PrimeFactorizer migration後に測定。

## O13. Published media protection implementation details

**architectureは解決済み。**

vNext initial protection class:

- public delivery bucketと別のprivate protected-media R2 bucket
- protected bucketにpublic custom domainなし
- `MEDIA_PUBLISHED -> MEDIA_PROTECTED -> EXPORTED` hard gate
- protected mediaはexact public master/variant bytes
- Bucket Lock = indefinite
- automatic expiration lifecycle = none
- normal public publisherにprotected bucket accessなし
- normal protection writerにDelete / bucket configuration / lock modification permissionなし
- R2 config admin = operator-held ephemeral only
- provider-independent second copyはinitial launch hard requirementではない

`Xpotato-Server` design branch `codex/site-vnext-cloudflare-control-plane` のADR-0024 proposalと整合させる。

未決なのはimplementation-specific value/operation:

- exact protected bucket name
- object key/prefix convention inside protected bucket
- protected write/read credentialsの具体permission mechanism
- protection operation execution location/invocation method
- scheduled integrity verification cadence
- receipt/recovery drill automation detail

migration cutoverでold Git media copyを削除する前にrepresentative exact-byte restore drill必須。

## O14. Discovery profile remaining values

architectureはarchive/RSS/related/Pagefind Extended選択まで確定済み。

initial canonical defaults:

- Blog pagination: 12 items/page
- Notes pagination: 12 items/page
- RSS: 20 items
- RSS mode: `summary`
- related content: max 4 items

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

Blog 44件:

- `software`: 31
- `infrastructure`: 12
- `robotics`: 1

`devlog`はtopical categoryではなくArticle Job modeへ移す。`network`はinitial top-level categoryにせずtag/topicへ、published 0件の`app`もseedしない。

Notes subject seed=`infrastructure`。
Tool category seed=`calculation`。

exact tag registryはfrozen legacy scanからmachine generation + human alias/merge review。

### Media placement boundary

current Gitにはknown raster/photo media約4.54 MB。

vNext:

- photo / screenshot / raster project/content/site hero / AI raster / gallery -> R2-first
- small deterministic SVG / logo / favicon / icon / tiny texture / fixture -> Git candidate

### Cloudflare dashboard boundary

normal operation:

- GitHub Actions + Wrangler site deploy
- Xpotato-Server Git desired state + OpenTofu/API reconcile
- R2 config adminはephemeral operator capability
- Dashboardはbootstrap/billing/recovery/break-glass

### Responsive media provider dependency

prebuilt responsive R2 variantsをbaseline、Cloudflare Images Transformationsはoptional adapter。

### Published media recovery plane

public delivery R2と別private protected-media bucket + indefinite Bucket Lock + no automatic expirationをinitial architectureに採用。

### Collection-specific schemas outside Blog

Notes / Projects / Tools / Pages contract定義済み。

### ContentId encoding

lowercase canonical RFC 4122 UUID v4。

### Static search engine

Pagefind Extended。exact version/UIはO14。

### Compatibility redirects

- `/blog/prime-factorizer/`
- `/blog/category/tools/`

はvNextでreal application path 301へ昇格。
