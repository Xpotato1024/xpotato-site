---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# vNext Open Decisions

未決事項を「あとで考える」で放置せず、確定に必要なevidenceとphaseを記録する。

この文書はcurrent specificationのSoTではない。決定後はcanonical doc / machine-readable configへ反映し、必要ならADRを作成する。

## O1. Initial taxonomy records

未決:

- exact Blog category IDs / labels
- Note subject IDs
- Tool category IDs
- initial tag registry

確定方法:

- legacy migration inventoryを取得
- synonym / duplicate / one-off termを集計
- broad taxonomyを少数に再設計

確定phase: content migration開始前。

## O2. Media ingest numerical profiles

未決:

- photo public master max dimension
- JPEG quality
- screenshot master policy
- hero normalization dimensions

確定方法:

- representative iPhone HEIC / screenshot fixtureでvisual qualityとR2 master sizeを比較
- edge transform品質 / bandwidth / retina viewportを評価

確定phase: media-ingest implementation前。

## O3. AI execution profiles

未決:

- default text provider/model
- default vision auditor
- default image generator
- snapshots

architectureはprovider-neutral。

確定方法:

- implementation時点のcapability / price / structured output / image quality比較
- representative evalでP0/P1 / schema adherence確認

確定phase: Article pipeline provider implementation前。

## O4. Article resource budgets

未決:

- max source discovery calls
- semantic revision count
- image candidate count
- retry budget

確定方法:

- representative jobsをdry-run
- unnecessary loop / failure recoveryを観測

initial implementationではfinite conservative defaultsを置き、eval後に変更する。

## O5. Performance budgets

未決:

- route-class JS / CSS byte budget
- image transfer target
- lab thresholds beyond Core Web Vitals target

確定方法:

- legacy production baseline
- vNext foundation baseline
- representative mobile profile

確定phase: visual redesign前。

## O6. Visual style profile

未決:

- actual palette / texture / illustration style
- hero composition profile
- social card design

確定方法:

- design system / visual redesign phaseで複数candidate比較

architectureはstyle profileがversioned inputであることだけ固定する。

## O7. Comparison module API

`Comparison`の内部child APIは代表記事fixtureを1件作ってから固定する。

premature generic layout builderを避ける。

## O8. Exact legacy tag / branch naming

legacy archiveはannotated tag必須。optional branchはhotfix needがある場合のみ。

exact tag nameはcutover taskでremote conflictを確認して決める。

## O9. Cloudflare production integration details

未決:

- exact Workers build project setting
- app workspace build root / command
- zone-level compression / cache rule exact values

ownership boundaryは確定済み。provider exact stateは`Xpotato-Server`側SoTと突き合わせてimplementation phaseで確定する。

## O10. Media delivery profiles

未決:

- inline / hero / galleryごとのresponsive width set
- AVIF / WebP / fallback order
- quality profile
- Cloudflare Images adapterのexact URL contract
- prebuilt R2 variant fallback profile

確定方法:

- representative R2 masterでtransform結果を比較
- mobile / desktop DPR別bytesとvisual qualityを測定
- current Cloudflare capability / pricingをimplementation時に確認

確定phase: site media renderer implementation前。

## O11. Private raw media retention

公開サイトarchitectureはraw camera sourceをpublic R2 / Gitへ置かないことだけ固定している。

未決:

- iPhone originalをどこへ長期保存するか
- backup / retention
- AI raw generated image retention期間

これはpublic site deliveryとは別trust boundary。NAS / private object storage等のcurrent infrastructure方針と突き合わせて決める。

## O12. Published R2 media retention / garbage collection

defaultはpublished versioned objectを自動削除しない。

未決:

- never-published orphan grace period
- retired published objectのretention
- retained Git tag / releaseをGC protectionへ含めるexact rule

R2 storage usageが実際に増えた時点で容量・rollback requirementから決定する。

## O13. Interactive module bundle budget classes

`small | medium | large`というregistry分類のexact byte thresholdは未決。

vNext foundationとPrimeFactorizer migration後のroute-local bundleを測定して決める。

## Resolved during design

### Collection-specific schemas outside Blog

Notes / Projects / Tools / Pagesのlogical contractは`contracts/collection-frontmatter-contracts.md`で定義済み。

legacy fieldをそのまま継承せず、summary / image path / React import等を別registryへ分離した。
