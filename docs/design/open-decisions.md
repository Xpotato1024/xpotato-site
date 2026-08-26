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

- exact category IDs / labels
- initial tag registry

確定方法:

- legacy content inventoryを取得
- synonym / duplicate / one-off tagを集計
- broad categoryを少数に再設計

確定phase: content migration開始前。

## O2. Media ingest numerical profiles

未決:

- photo master max dimension
- JPEG quality
- screenshot size policy
- hero output dimensions

確定方法:

- representative iPhone photo / screenshot fixtureでsize / visual quality比較
- responsive deliveryとGit sizeを評価

確定phase: media-ingest implementation前。

## O3. AI execution profiles

未決:

- default text provider/model
- default vision auditor
- default image generator
- snapshots

architectureはprovider-neutral。

確定方法:

- current provider capability / price / structured output / image qualityを実装時に比較
- representative evalでP0/P1 / schema adherenceを確認

確定phase: Article pipeline provider implementation前。

## O4. Article resource budgets

未決:

- max source discovery calls
- semantic revision count
- image candidate count
- retry budget

確定方法:

- representative jobsをdry-run
- unnecessary loopとfailure recoveryを観測

initial implementationではfinite conservative defaultsを置き、eval後に変更する。

## O5. Performance budgets

未決:

- route-class JS / CSS byte budget
- image byte target
- Lighthouse-like lab thresholds beyond Core Web Vitals target

確定方法:

- legacy production baseline
- vNext foundation baseline
- representative mobile profile

確定phase: visual redesign前。

## O6. Visual style profile

未決:

- actual palette / texture / illustration style
- hero composition profile
- OGP design

確定方法:

- design system / visual redesign phaseで複数candidateを比較

architectureはstyle profileがversioned inputであることだけ固定する。

## O7. Comparison module API

`Comparison`の内部child APIは代表記事fixtureを1件作ってから固定する。

premature generic layout builderを避けるため、contractで意図だけ固定している。

## O8. Exact legacy tag / branch naming

legacy archiveはannotated tag必須。optional branchはhotfix needがある場合のみ。

exact tag nameはcutover taskでremote conflictを確認して決める。

## O9. Cloudflare production integration details

未決:

- exact Workers build project setting
- app workspace build root / command
- zone-level compression / cache rule exact values

ownership boundaryは確定済み。provider exact stateは`Xpotato-Server`側SoTと突き合わせてimplementation phaseで確定する。
