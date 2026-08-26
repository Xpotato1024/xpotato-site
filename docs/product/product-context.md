---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - product purpose
  - authoring goals
  - quality priorities
---

# Product Context

## Purpose

`xpotato-site`は、個人の技術記事・学習記録・制作物・小規模ツールを長期的に蓄積し、読みやすく高速に公開するためのpublishing platformである。

目的は「Astro siteを維持すること」ではない。

**contentを継続追加・更新しやすく、URL continuity、metadata、taxonomy、media、search、配信性能、AI provenance、recoveryを低い運用コストで保守できること**が主目的。

Blogをprimary publishing pathとし、Notes / Projects / Tools / Pagesはsame site shell / identity / governanceを共有する。

通常の新規/更新記事はAI-first Article Jobで生成・検証・監査・human approvalされるworkflowを標準とする。

## Primary authoring unit

Blog article normal flow:

1. topic / notes / source hint
2. source / evidence固定
3. AI draft
4. citation / technical example assessment
5. independent content audit + bounded revision
6. visual plan / hero generate or ingest
7. independent visual audit
8. audited canonical masterからresponsive variants生成
9. private candidate preview
10. human exact-candidate approval
11. privacy-normalized canonical masterをprivate source-mediaへpersist
12. delivery master/variantsをpublic R2へpublish
13. exact public bytesをprivate protected-mediaへcopy/verify
14. MDX / registries / compact provenanceをfeature branchへexport
15. PR validation / merge
16. static build + deterministic MiniSearch index generation
17. GitHub Actions + Wrangler deploy

SEO/archive/RSS/related/search/media variants/cache headerを記事ごとに手管理しない。

## Authoring goals

### G1. MDX-first

本文はMarkdown/MDXを長期sourceとする。

ordinary prose / heading / list / code / table / link / image / footnoteはportable Markdownを優先する。

special presentationだけtyped semantic content moduleを使う。

### G2. Stable content identity, movable routes

contentはstable UUIDv4 ContentIdを持つ。

slug/route変更でもsame ContentIdを維持しredirectを用意する。

media/provenance/update lineageをURL stringへ結合しない。

### G3. Minimal SEO surface

normal frontmatterはeditorial metadataだけ。

canonical、OG、structured data、sitemap、RSS、archive/search metadataはsystem-derived。

Blog hero/social cardもMedia Registryから解決する。

### G4. Managed taxonomy / discovery

category/subject/tool category/tagはstable registry ID。

archive / pagination / RSS / relatedはbuild-time generated。

full-text searchはMiniSearch serialized static artifact + repository-owned deterministic Japanese/technical tokenizerとし、server/databaseを導入しない。

### G5. Flexible but maintainable content modules

Figure、Gallery、Callout、Steps、Comparison、LinkCard、Details、Demo等のsemantic moduleを組み合わせる。

layout freedomをarticle-local CSS/Tailwind/arbitrary JSXの増殖で実現しない。

Tool interactive implementationもregistry binding。

### G6. Camera-source friendly, R2-first, reprocessable and recoverable media

HEIC/HEIFをfirst-class inputとして受け付ける。

iPhone撮影設定をWeb都合でJPEG固定へ変更させない。

raw camera sourceはjob/user inputでありsiteのlong-term media SoTにはしない。

ingestでorientation / sRGB / metadata / dimensionsをnormalizeし、privacy-safe lossless canonical masterを作る。

human approval後:

1. canonical masterをprivate source-media R2へ保存
2. delivery master/AVIF/WebP/fallback variantsをpublic R2へpublish
3. exact public bytesをseparate private protected-media R2へcopy

initial protected-mediaはindefinite Bucket Lock + no automatic expiration。

private source-mediaはfuture re-encode sourceで、public delivery recovery authorityとは分離する。

MDXはR2 URLではなくsemantic `media:` IDを参照する。

Cloudflare Imagesをmedia correctnessの必須機能にしない。

### G7. AI visual completeness without factual confusion

Blog hero required。

source mediaがなければAI conceptual hero、生成不可/不適切ならdeterministic cover。

AI visualはtechnical evidenceではない。

fake UI / terminal / code / benchmarkを事実画像として作らない。

### G8. Evidence-bound AI authoring

material claimはsource/evidenceへ追跡できる。

citationはfixed Source IDからdeterministicにcompileする。

technical examplesは:

- illustrative
- syntax checked
- sandbox executed
- evidence observed
- not verifiable

を区別する。

initial automatic executionはsmall isolated Python/Node/SQLite profilesだけ。shell/system/cloud mutationを自動実行しない。

### G9. Maximum practical delivery optimization

static-first simplicityを保ちながら:

- static prerender
- route-local JS
- fingerprinted bundled assets
- content-addressed R2 media
- prebuilt responsive modern image formats
- immutable cache metadata
- standard edge cache/compression
- measured LCP treatment
- third-party minimization

を自動適用する。

Cloudflare固有optimizationを無理由に増やさない。

### G10. Durable content / swappable tooling

長期identity:

- ContentId
- MDX meaning
- taxonomy ID
- semantic media asset ID
- canonical source hash
- public master/variant hashes + profile lineage
- evidence/provenance lineage

をframework / storage URL / provider/search implementationから分離する。

Astro component path、React path、R2 domain、MiniSearch implementation、Cloudflare Imagesは交換可能なimplementation detail。

### G11. Localized interactivity

Tool/Demoだけclient runtime。

search runtimeも`/search/`へ限定し、normal content routeへMiniSearch/search JSを送らない。

### G12. Auditable AI without repository pollution

full source snapshots、AI responses、raw original、canonical/variant bytes、verification logsはprivate/off-Git。

Gitへexport:

- human-approved MDX/frontmatter
- registries
- compact provenance/source-media identity
- site code/config/docs

### G13. Git-driven provider control plane

normal production operationでCloudflare Dashboard clickを要求しない。

- site CI/CD: GitHub Actions
- Worker deploy: Wrangler
- provider desired state: `Xpotato-Server`
- OpenTofu first where supported
- provider gap: official API reconcile adapter
- R2 config admin: operator-held ephemeral

Dashboardはbootstrap/billing/account recovery/break-glassへ限定する。

## Quality priority

1. content correctness / publication safety
2. maintainability / authoring simplicity
3. recoverability / durable identity
4. accessibility / semantic HTML
5. performance / delivery efficiency
6. discoverability / search/SEO correctness
7. visual novelty

## Non-goals

- CMS GUI
- site-wide SSR/React/SPA
- SEO plugin-style settings
- articleごとの手作業image variants
- raw camera photoをGit/public R2/private source-mediaへそのまま保存
- Gitをphoto archiveとして利用
- search runtime database/service
- generic remote code execution platform
- AI draftのhuman reviewなしpublish
- Cloudflare Dashboardを日常control planeにする
- Cloudflare Images/Cache Rules/Compression Rulesをinitial correctness requirementにする

## Success criteria

- normal Blog create/updateでSEO boilerplateなし
- stable ContentId
- simple logical media refでresponsive delivery
- HEIC/HEIFをmanual conversionなしでingest
- Git sizeがmedia数に比例増加しない
- approved canonical sourceからfuture profileへre-encode可能
- raw camera metadataをCloudflare site storageへ恒久保存しない
- published exact bytesをprivate protected-mediaからrestore可能
- Blog hero欠損なし
- content-only hydration 0 target
- taxonomy/route/media/provenance errorsをpublish前検出
- claims/citations traceable
- technical example verification class明示
- human approval前にpersistent media/canonical siteをmutateしない
- archive/RSS/related/searchを自動再生成可能
- Japanese compound searchがbuild/query tokenizer差で崩れない
- Cloudflare Images無効でもmedia delivery正常
- normal deploy/media/provider reconcileがDashboard clickなしで可能
- visual redesign/storage/search engine変更がMDX大規模rewriteを要求しない
- old implementationはGit tagから再現可能
