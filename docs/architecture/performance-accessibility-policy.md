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

field Core Web Vitals good thresholdをp75 target:

- LCP <= 2.5 s
- INP <= 200 ms
- CLS <= 0.1

mobile/desktop別評価。

## Route classes

### Content-only

Blog / Notes / normal Page:

- React hydration 0 target
- MiniSearch/search runtime 0
- global third-party JS 0 baseline

explicit Demoだけexception。

### Static discovery

archive/category/tag/year/Projects listing:

- static HTML links
- JSなしdefault

### Search

`/search/`:

- MiniSearch 7.2.0 route-local runtime allowed
- same deterministic tokenizer
- serialized static index fetched only when search UI needs it
- unrelated routeへsearch JS/index preloadなし

### Interactive Tool

registry-bound React islandだけhydrate。

## Performance budget

vNext foundation実測後route classごとのmachine-readable budgetを固定する。

実測前に任意KiB上限を作らない。

baseline invariant:

- content-only React/search runtime 0
- third-party script default-off
- media dimensions known
- below-fold image lazy default
- LCP lazy禁止
- route JS/CSS/search-index diffをCI観測
- site buildはR2 media downloadなし

## R2 content media

public deliveryはprebuilt master/variants。

- viewportへ巨大canonical/public masterを直接送らない
- finite responsive widths
- AVIF/WebP/fallback
- dimensions/aspect ratio from registry
- immutable cache
- Cloudflare Images not baseline

private canonical source-mediaはbrowser performance path外。

## Media profiles

exact v1=`../operations/media-processing-profiles.md`。

article authorがpixel width/qualityを個別指定しない。

profile変更はrepresentative visual/size measurement + new profile versionで行う。

## LCP media

hero:

- not lazy
- correct responsive set
- intrinsic dimensions/aspect ratio
- public max/profile prevents raw giant transfer
- `fetchpriority=high` only if measured beneficial

preloadは無条件に全heroへ付けない。

## Search performance

MiniSearch search routeでは:

- serialized index transfer bytes
- MiniSearch/client tokenizer JS bytes
- parse/load time
- representative Japanese query latency
- memory use

をroute-class budgetで観測する。

indexはnormal article routeへ送らない。

corpus growthでbudgetを超えた場合:

1. indexed scope/boilerplate extraction
2. stored result fields
3. index compression/cache
4. tokenizer/index strategy

を先に評価し、即server searchへ移行しない。

## Interactive performance

Interactive Module Registry budget classをactual bundle measurementへ結ぶ。

- visible/idle hydration優先
- client:load only immediate need
- page-local modules
- heavy library global化禁止

## CLS/fonts/motion

- media dimensions known
- Japanese system font baseline
- web font requires brand + measured value
- animation transform/opacity中心
- reduced motion尊重
- motionなしでも情報/操作維持

## Accessibility target

WCAG 2.2 AA target。

review:

- landmarks/headings
- keyboard/focus
- accessible labels/names
- contrast/target size
- alt/decorative semantics
- form error/status
- reduced motion
- zoom/reflow
- search IME/keyboard/result status
- interactive Tool controls

AI heroもdecorative/content-bearing semanticsを明示する。

## Automated/manual

automated scannerだけでAA conformanceとしない。

representative routes:

- Blog
- archive
- Search
- Tool
- Demo article

をmanual smokeする。

## Sources

Core Web Vitals/WCAG provenanceは`../references/external-sources.md`。
