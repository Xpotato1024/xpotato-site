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

## 目的

`xpotato-site` は、個人の技術記事・学習記録・制作物・小規模ツールを長期的に蓄積し、読みやすく高速に公開するための publishing platform である。

単に「Astro で作られたサイト」を維持することが目的ではない。主目的は、**記事を継続して追加・更新しやすく、公開後も URL・metadata・画像・taxonomy・配信性能を低い運用コストで保守できること**である。

Blog は最も頻繁に更新される第一級 content とし、Notes / Projects / Tools / Pages は同じ site shell と content governance を共有する。

## AI-first authoring

Blog の通常 authoring は AI-first とする。

人間が完成 MDX をゼロから書くことを通常フローの前提にせず、topic / intent / reader / user notes / source refs / media を Article Job へ渡し、AI が source discovery、evidence 整理、初稿、監査対象、visual plan を生成する。

AI-generated output は proposal であり、canonical repository content ではない。deterministic validation と independent audit を通し、人間が exact preview candidate を承認した後だけ repository へ export する。

詳細は `ai-authoring-context.md` を正とする。

## Primary authoring unit

日常運用の中心は 1 本の **Article Job** と、その最終成果物である 1 本の MDX 記事である。

理想的な記事追加は、人間視点では次だけで完結する。

1. topic / intent / reader を与える。
2. 必要なら notes、GitHub ref、写真等を渡す。
3. network / external AI / image generation の許可範囲を決める。
4. pipeline が source / evidence、draft、audit、hero、MDX candidate、preview を作る。
5. preview と unresolved item を確認する。
6. exact candidate を approve する。
7. approved candidate が branch / PR 用 content として export される。

記事ごとに canonical URL、OG metadata、JSON-LD、sitemap、archive entry、responsive image variant、cache header を人手で個別設定する運用にはしない。

## Authoring goals

### G1. MDX-first final content

公開本文は Markdown / MDX を正本とする。

通常の段落、見出し、list、code、table、image は Markdown で表現し、特殊な表現だけ typed content module を使う。

記事本文へ raw HTML、style attribute、任意 JavaScript を大量に埋め込むことを自由度とはみなさない。

AI pipeline の private request / response / manifest は MDX へ混ぜず、article content と provenance artifact を分離する。

### G2. Minimal SEO surface

著者が毎回入力する SEO 専用 field を最小化する。

通常記事では title / description / date / category / tags / hero 等の content metadata から canonical、OG、structured data、sitemap entry を自動生成する。

SEO override は duplicate / syndicated content 等の例外時だけ使用する。

### G3. Managed taxonomy and archives

category は少数の broad topic、tag は横断的な topic / technology とする。

free-form tag の無制限増殖を避け、stable ID を持つ registry で管理する。archive page の生成・indexability も taxonomy registry から決める。

AI は taxonomy を提案できるが、未知IDを勝手に canonical registry へ追加しない。

### G4. Flexible but maintainable design modules

記事は layout を固定 template へ閉じ込めず、Figure、Gallery、Callout、Steps、Comparison、LinkCard、Demo 等の module を組み合わせられるようにする。

自由度は component composition と semantic variant で提供し、記事ごとの ad-hoc CSS / React island の増殖で実現しない。

AI author は approved content-module registry の範囲で構成を提案する。

### G5. Camera-source friendly media

画像入力は authoring environment に合わせる。特に iPhone の High Efficiency 撮影で得られる HEIC / HEIF を第一級 input として受け付ける。

撮影側へ「Web のために JPEG に設定変更する」ことを要求しない。

raw source は公開物ではない。ingest pipeline で orientation、color space、privacy metadata、size、filename を正規化し、Web 用 master / derivative を生成する。

### G6. Hero-complete publishing

Blog publish candidate は hero visual を持つことを原則とする。

適切な real/source image がない software article では、AI-generated conceptual illustration を作る。それも使えない場合は deterministic design-system cover へ fallback する。

AI-generated hero は evidence ではなく、fake UI / output / benchmark / screenshot を事実として描かせない。

OGP の title / branding は必要なら site-owned renderer で deterministic に合成する。

### G7. Maximum practical delivery optimization

static-first architecture の単純性を維持したまま、build-time / edge-time で自動化できる最適化は積極的に適用する。

- static prerender
- route-local JavaScript
- hashed immutable assets
- responsive images
- modern image formats
- edge cache
- Brotli / Gzip、可能なら Zstandard
- explicit LCP treatment
- third-party script minimization

ただし、実測上ほぼ効果がない micro-optimization のために request-time Worker、複雑な cache invalidation、独自 image backend を導入しない。

### G8. Durable content

content の価値を framework version や UI redesign に過度に結び付けない。

MDX の本文、stable slug / URL、taxonomy ID、media identity は長期維持できる構造を優先する。

Article Job の provider/model identity は content semantics から分離し、AI vendor の変更で過去記事を大規模rewriteしない。

### G9. Localized interactivity

Tool や記事内 Demo では React 等の browser state を利用できるが、site 全体を SPA にしない。

interactive feature の runtime cost はその feature を使う route に閉じ込める。

## Information architecture

### Blog

公開技術記事。新着順、category、tag、year archive から辿れる。AI-first Article Job の主対象。

### Notes

学習メモ・資料。Blog より editorial completeness を要求しないが、public metadata / route contract は持つ。AI pipeline は利用可能だが hero requirement 等は Blog と同一にしなくてよい。

### Projects

制作物・研究 / 開発 project の紹介。記事 chronology ではなく project identity を中心にする。

### Tools

browser 上で直接使う utility。static description と interactive island を組み合わせられる。

### Pages

About 等の長期固定ページ。

Home は独立 content store ではなく、上記 collection の代表・新着・featured entry への入口とする。

## Quality priority

trade-off が発生した場合の優先順位は概ね次とする。

1. content correctness / publication safety
2. traceability / human approval integrity
3. maintainability / authoring simplicity
4. accessibility / semantic HTML
5. performance / delivery efficiency
6. discoverability / SEO correctness
7. visual novelty

performance と SEO を軽視する意味ではない。**自動化可能な最適化は強く適用する一方、内容の正確性・provenance・継続更新性を犠牲にした optimization は採用しない**という優先順位である。

## Non-goals

- CMS GUI の再構築
- site-wide SSR
- site-wide React / SPA
- SEO plugin 相当の設定画面
- 記事ごとの手作業での WebP / AVIF 生成
- raw iPhone photo をそのまま public asset として commit / publish
- AI semantic runner に canonical repository write / merge / deploy 権限を与えること
- generated hero を factual evidence として見せること
- external image API を publication availability の single point of failure にすること
- tag 数を増やすこと自体を information architecture とみなすこと
- framework / animation / UI library の showcase 化

## Success criteria

vNext implementation は少なくとも次を満たす。

- topic / notes / permitted sources から human-reviewable article candidate を AI-first pipeline で作れる。
- material claim が source / evidence bundle へ追跡できる。
- independent content audit を author と別 context で行える。
- human approval が exact candidate hash に bind される。
- 通常の記事追加で SEO boilerplate を手入力しない。
- Blog candidate は hero visual を持つ。
- suitable real hero がない software article で AI conceptual hero を生成できる。
- image generation が unavailable / unauthorized でも deterministic cover へ fallback できる。
- ordinary article image は Markdown syntax だけでも responsive delivery される。
- HEIC / HEIF の authoring source を repository 外で手変換せず ingest できる。
- content-only article route は原則 framework hydration 0。
- category / tag typo、route conflict、broken asset を build 前に検出できる。
- fingerprinted asset は長期 immutable cache、HTML は更新を即時反映できる cache policy を持つ。
- design redesign が content source の大規模書き換えを要求しない。
