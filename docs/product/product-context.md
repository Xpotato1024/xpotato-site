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

**contentを継続追加・更新しやすく、URL continuity、metadata、taxonomy、media、search、配信性能、AI provenanceを低い運用コストで保守できること**が主目的。

Blogをprimary publishing pathとし、Notes / Projects / Tools / Pagesはsame site shell / identity / governanceを共有する。

通常の新規/更新記事はAI-first Article Jobで生成・検証・監査・human approvalされるworkflowを標準とする。

manual articleもsame content contractsへ入れられるが、AI candidateのhuman approval gateを自動publishで迂回しない。

## Primary authoring unit

日常運用の中心は1件のcontent revision。

Blog articleのnormal flow:

1. topic / notes / source hintをArticle Jobへ与える
2. source / evidenceを固定
3. AI draft
4. citation / technical example assessment
5. independent content audit + bounded revision
6. visual plan / hero generate or ingest + visual audit
7. private candidate preview
8. human exact-candidate approval
9. approved mediaをR2へpublish/verify
10. MDX / registries / compact provenanceをfeature branchへexport
11. PR validation / merge
12. static build + Pagefind indexing + deploy

記事ごとにcanonical URL、OG metadata、JSON-LD、sitemap、archive、RSS、related、search metadata、responsive variants、cache headerを手作業で個別設定しない。

## Authoring goals

### G1. MDX-first

本文はMarkdown/MDXを長期sourceとする。

ordinary prose / heading / list / code / table / link / image / footnoteはportable Markdownを優先する。

special presentationだけtyped semantic content moduleを使う。

raw HTML、style attribute、arbitrary JavaScript / React importを自由度とはみなさない。

### G2. Stable content identity, movable routes

contentはstable UUIDv4 ContentIdを持つ。

slug / routeはhuman-readableで変更可能。

route renameではsame ContentIdを維持しredirectを用意する。

したがってmedia/provenance/update lineageをURL stringへ結合しない。

### G3. Minimal SEO surface

normal frontmatterはeditorial metadataだけ。

canonical、OG、structured data、sitemap、RSS、archive/search metadataはsystem-derived。

Blog hero/social cardもfrontmatter pathではなくMedia Registryから解決する。

SEO overrideはduplicate/syndicated/noindex等のexception-only。

### G4. Managed taxonomy / discovery

category/subject/tool category/tagはstable registry ID。

free-form term増殖を避ける。

archive / pagination / RSS / relatedはbuild-time generated。

full-text searchはstatic Pagefind artifactとし、server/databaseを検索だけのために導入しない。

### G5. Flexible but maintainable content modules

Figure、Gallery、Callout、Steps、Comparison、LinkCard、Details、Demo等のsemantic moduleを組み合わせる。

layout freedomをarticle-local CSS / Tailwind / arbitrary JSXの増殖で実現しない。

Tool interactive implementationもMDX source pathではなくregistry binding。

### G6. Camera-source friendly, R2-first media

HEIC / HEIFをfirst-class inputとして受け付ける。

iPhone撮影設定をWeb都合でJPEG固定へ変更させない。

raw sourceはprivate。ingestでorientation / color / metadata / dimensionsをnormalizeする。

normal content media binaryはGitへ保存せず、approved normalized masterをcontent-addressed immutable R2 objectとして公開する。

MDXはR2 URLではなくsemantic `media:` IDを参照する。

public R2 objectを唯一のrecovery copyにしない。

### G7. AI visual completeness without factual confusion

Blogはhero required。

source mediaがないsoftware articleではAI-generated conceptual heroを利用できる。

AI generation unavailable/unsuitableならdeterministic design-system coverへfallback。

AI visualはtechnical evidenceではない。

fake UI / terminal / code / benchmarkを事実画像として作らない。

factual diagram/chartはdeterministic source / actual evidenceを優先する。

social cardのtitle/brandingはsoftware rendererがactual metadataから生成する。

### G8. Evidence-bound AI authoring

AI articleのmaterial claimはsource/evidenceへ追跡できる。

citationはfixed Source IDからdeterministicにpublic footnoteへcompileする。

AIにURL/reference stringを自由生成させて根拠とみなさない。

software code/command exampleは:

- illustrative
- syntax checked
- sandbox executed
- evidence observed
- not verifiable

を区別する。

AI自己申告をverificationにしない。

### G9. Maximum practical delivery optimization

static-first simplicityを保ちながら:

- static prerender
- route-local JS
- fingerprinted bundled asset
- R2 responsive media
- modern image formats
- edge cache
- text compression
- measured LCP treatment
- third-party minimization

を自動適用する。

micro-optimizationのためにrequest-time app server、複雑なcache invalidation、独自画像backendを追加しない。

### G10. Durable content / swappable tooling

長期identity:

- ContentId
- MDX meaning
- taxonomy ID
- semantic media asset ID
- evidence/provenance lineage

をframework / visual design / storage URLから分離する。

Astro component path、React file path、R2 domain、Pagefind implementationは交換可能なimplementation detail。

### G11. Localized interactivity

Tool / Demoだけclient runtimeを許容する。

interactive runtime costを利用routeへ閉じ込め、site全体をSPAにしない。

search runtimeもinitially`/search/`へ限定する。

### G12. Auditable AI without repository pollution

full source snapshots、AI responses、prompt exchange、verification logs、raw generated visualはprivate Article Job workspace。

Gitへexportするのは:

- human-approved MDX/frontmatter
- taxonomy/media/interactive registry changes
- compact Publication Provenance
- site code/config/docs

content media binaryやfull AI work historyではない。

## Information architecture

### Blog

public technical article。newest、category、tag、year archive、related、RSS、searchからdiscoverable。

### Notes

learning/research note。Blogよりeditorial completenessを要求しないがstable ContentId / route contractを持つ。

### Projects

project identity中心。chronological article listingを目的にしない。

### Tools

static explanation + registry-bound interactive module。

### Pages

About等のlong-lived page。

Homeは独立content storeではなくcollectionのfeatured/new entryへのentrypoint。

## Quality priority

trade-off priority:

1. content correctness / publication safety
2. maintainability / authoring simplicity
3. recoverability / durable identity
4. accessibility / semantic HTML
5. performance / delivery efficiency
6. discoverability / SEO correctness
7. visual novelty

自動化可能なoptimizationは強く適用するが、correctness、recovery、継続更新性を犠牲にしない。

## Non-goals

- CMS GUI再構築
- site-wide SSR
- site-wide React/SPA
- SEO plugin相当の設定画面
- articleごとの手作業WebP/AVIF生成
- raw iPhone photoをpublic/Gitへ直接publish
- Gitをcontent photo archiveとして利用
- taxonomy countを増やすこと自体の目的化
- framework/animation/UI library showcase
- AI provider/modelをpublic runtimeへ埋め込む
- AI draftをhuman reviewなしで自動publish
- searchのためのruntime database/service
- generic remote code execution platformの構築

## Success criteria

- normal Blog create/updateでSEO boilerplateを手入力しない
- every content has stable ContentId
- site-owned imageはsimple Markdown logical refでresponsive deliveryされる
- HEIC/HEIFをmanual external conversionなしでingestできる
- content media増加でGit repository sizeが比例増加しない
- Blogはsource/AI/deterministic strategyでhero欠損しない
- content-only route framework hydration 0 target
- taxonomy typo、route conflict、broken media、stale provenanceをpublish前に検出
- material claims are source/evidence traceable
- citations cannot invent unknown source URL
- technical examples expose verification class/limitations
- author/auditor hidden contextを共有しない
- human approval前candidateはcanonical site/R2をmutateしない
- approved Git revisionはverify済みR2 objectだけを参照
- published media has recovery requirement beyond active public object
- archive/RSS/search/relatedはcontentから自動再生成可能
- visual redesign/storage domain/search engine変更がMDX大規模rewriteを要求しない
- old implementationはGit tagから再現でき、active vNext treeにfull legacy copyを残さない
