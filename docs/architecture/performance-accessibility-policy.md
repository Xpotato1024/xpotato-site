---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - frontend performance policy
  - accessibility target
---

# Performance and Accessibility Policy

## Performance objective

field Core Web Vitalsのgood thresholdをp75で満たすことをtargetとする。

- LCP <= 2.5 s
- INP <= 200 ms
- CLS <= 0.1

mobile / desktopを分けて評価する。

external definitionが更新された場合はcurrent standardを再確認する。

## Route classes

### Content-only

Blog / Notes / normal Page:

- React hydration 0 target
- Pagefind runtime 0
- global third-party JS 0 baseline

explicit Demoがあるarticleだけinteractive exception。

### Static discovery

Blog archive / category / tag / year / Notes archive / Projects listing:

- static HTML links
- JSなしdefault
- filter convenienceが必要でもprogressive enhancement

### Search

`/search/`:

- Pagefind client runtime allowed
- search-specific JSをこのrouteへ局所化
- article/archive routeへsearch bundleを送らない

### Interactive Tool

registry-bound React islandだけhydrate。

Tool chunk / React runtimeをunrelated routeへ漏らさない。

## Performance budget

legacy + vNext foundation baseline取得後、route classごとのmachine-readable budgetを固定する。

根拠なくKiB上限を先に決めない。

baseline前からinvariant:

- content-only React runtime 0
- content-only Pagefind runtime 0
- third-party script default-off
- layout dimensions known for media/iframe
- below-the-fold image lazy default
- LCP candidate lazy禁止
- route別JS/CSS/build artifact diffをCIで観測
- site buildはR2 master downloadを行わない

budgetはregressionごとに黙って引き上げない。

## R2 content media

normal article photo / screenshot / AI heroはR2 public master。

performance policy:

- master自体をviewportへ直接送らない
- finite responsive width profile
- AVIF/WebP/fallback policy
- edge transformまたはR2 prebuilt variants
- width/height/aspect ratioはMedia RegistryからHTMLへ反映
- immutable object/variant cache

Git bundled asset pipelineをarticle image optimizationの標準にしない。

## Media delivery profiles

usage classごとにmachine profileを持つ。

candidate:

- hero
- inline
- gallery thumbnail
- overview
- social card

exact widths/qualityはrepresentative imageで測定して決める。

article authorがpixel width/qualityを個別指定しない。

## LCP media

first-view Blog hero等:

- lazy loadしない
- correct responsive source
- intrinsic dimensions/aspect ratio
- unnecessary giant sourceを避ける
- measured needがあれば`fetchpriority=high`

preloadはLCP改善が実測できる場合に限定し、全heroへ無条件追加しない。

## CLS

- media dimension known
- font fallback stable
- ad/embed slotを導入する場合はspace reservation
- client hydration前後でlayout structureを不必要に変えない

## Search performance

Pagefindはpost-build static index。

- browserは必要chunkだけ取得するengine特性を利用
- site-wide search JS preload禁止
- `/search/`初期load budgetを別route classで管理
- index size / query latencyをcontent増加時に観測

検索indexが大きくなってもserver runtimeへ即移行せず、Pagefind chunk behavior / scope / metadataを先に評価する。

## Interactive performance

Interactive Module Registryのbudget classをbundle measurementへ結び付ける。

- visible/idle hydration優先
- `client:load`はfirst-view immediate interaction requirementのみ
- article Demo moduleはpage-local
- heavy libraryをglobal utilityへ昇格させない

## Fonts

日本語本文はsystem font stack default。

Japanese web fontはbrand requirement + measured valueなしに導入しない。

導入時:

- subset
- self-host consideration
- preload necessity
- fallback metrics / CLS
- transfer bytes

を評価する。

## Motion

animationはtransform/opacity中心。

`prefers-reduced-motion`を尊重し、motionなしでも情報/操作を失わない。

scroll-linked ambient effectはreadability / battery / main-thread costを測定し、低価値なら削除する。

## Accessibility target

WCAG 2.2 Level AA target。

minimum review:

- landmarks / headings
- keyboard-only operation
- visible focus
- accessible names/labels
- contrast
- target size
- alt/decorative media semantics
- forms/errors/status where present
- reduced motion
- zoom/reflow
- search keyboard/result announcement behavior
- interactive Tool controls

AI-generated heroでもdecorative/content-bearing semanticsを明示する。

## Automated versus manual

automated scannerだけでAA conformanceとしない。

representative routes:

- Blog
- archive
- Search
- Tool
- content with Demo

をmanual keyboard/semantic smoke対象にする。

## Sources

Core Web Vitals / WCAG provenanceは`../references/external-sources.md`。
