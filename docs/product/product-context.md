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

通常記事はAI-first Article Jobで生成・監査・human approvalされることを標準 workflow とする。人間が手書きする記事も同じcontent contractへexportできるが、AI pipelineを迂回することを優位な標準経路とはしない。

## Primary authoring unit

日常運用の中心は 1 本の MDX 記事である。

理想的な記事追加は次だけで完結する。

1. topic / notes / source hintをArticle Jobへ与える。
2. source / evidenceを固定する。
3. AI draftと独立監査を通す。
4. 必要な画像をingest / generateする。
5. candidate previewを確認する。
6. 人間がexact candidateをapproveする。
7. repositoryへexportする。
8. PR merge 後に static build / deploy される。

記事ごとに canonical URL、OG metadata、JSON-LD、sitemap、archive entry、responsive image variant、cache header を人手で個別設定する運用にはしない。

## Authoring goals

### G1. MDX-first

本文は Markdown / MDX を正本とする。

通常の段落、見出し、list、code、table、image は Markdown で書けるようにし、特殊な表現だけ typed content module を使う。

記事本文へ raw HTML、style attribute、任意 JavaScript を大量に埋め込むことを自由度とはみなさない。

### G2. Minimal SEO surface

著者が毎回入力する SEO 専用 field を最小化する。

通常記事では title / description / date / category / tags / hero 等の content metadata から canonical、OG、structured data、sitemap entry を自動生成する。

SEO override は duplicate / syndicated content 等の例外時だけ使用する。

### G3. Managed taxonomy and archives

category は少数の broad topic、tag は横断的な topic / technology とする。

free-form tag の無制限増殖を避け、stable ID を持つ registry で管理する。archive page の生成・indexability も taxonomy registry から決める。

### G4. Flexible but maintainable design modules

記事は layout を固定 template へ閉じ込めず、Figure、Gallery、Callout、Steps、Comparison、LinkCard、Demo 等の module を組み合わせられるようにする。

自由度は component composition と semantic variant で提供し、記事ごとの ad-hoc CSS / React island の増殖で実現しない。

### G5. Camera-source friendly media

画像入力は authoring environment に合わせる。特に iPhone の High Efficiency 撮影で得られる HEIC / HEIF を第一級 input として受け付ける。

撮影側へ「Web のために JPEG に設定変更する」ことを要求しない。

raw source は公開物ではない。ingest pipeline で orientation、color space、metadata、size、filename を正規化し、Web 用 master / derivative を生成する。

### G6. AI visual completeness

Blog記事は原則heroを持つ。

適切なsource mediaがないソフトウェア記事等では、AI-generated conceptual heroを標準候補にする。

AI visualはtechnical evidenceではなく、生成文字・fake UI・fake benchmark等を避ける。AI generationが使えない場合はdeterministic design-system coverへfallbackできる。

OGP上のtitle / brandingはAI画像へ描かせずsoftware rendererがactual metadataから生成する。

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

### G9. Localized interactivity

Tool や記事内 Demo では React 等の browser state を利用できるが、site 全体を SPA にしない。

interactive feature の runtime cost はその feature を使う route に閉じ込める。

### G10. Auditable AI without repository pollution

AI draft、source snapshot、prompt exchange、audit artifact等はprivate Article Job workspaceで管理し、公開site repositoryへ大量のAI作業履歴をcommitしない。

repositoryへexportするのはhuman-approved content / mediaと、必要最小限のpublication provenanceだけとする。

## Information architecture

### Blog

公開技術記事。新着順、category、tag、year archive から辿れる。

### Notes

学習メモ・資料。Blog より editorial completeness を要求しないが、public metadata / route contract は持つ。

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
2. maintainability / authoring simplicity
3. accessibility / semantic HTML
4. performance / delivery efficiency
5. discoverability / SEO correctness
6. visual novelty

performance と SEO を軽視する意味ではない。**自動化可能な最適化は強く適用する一方、内容の正確性や継続更新性を犠牲にした optimization は採用しない**という優先順位である。

## Non-goals

- CMS GUI の再構築
- site-wide SSR
- site-wide React / SPA
- SEO plugin 相当の設定画面
- 記事ごとの手作業での WebP / AVIF 生成
- raw iPhone photo をそのまま public asset として commit / publish
- tag 数を増やすこと自体を information architecture とみなすこと
- framework / animation / UI library の showcase 化
- AI provider/modelをsite runtimeへ直接埋め込むこと
- AI draftをhuman reviewなしで自動publishすること

## Success criteria

vNext implementation は少なくとも次を満たす。

- 通常の記事追加で SEO boilerplate を手入力しない。
- ordinary article image は Markdown syntax だけでも responsive delivery される。
- HEIC / HEIF の authoring source を repository 外で手変換せず ingest できる。
- source mediaがないBlogでもAI hero / deterministic fallbackによりheroを欠損しない。
- content-only article route は原則 framework hydration 0。
- category / tag typo、route conflict、broken asset を build 前に検出できる。
- AI draftのmaterial claimがsource/evidenceへ追跡できる。
- authorとauditorが同じhidden contextを共有しない。
- human approval前のcandidateがcanonical `apps/site/src/content`へ直接書かれない。
- fingerprinted asset は長期 immutable cache、HTML は更新を即時反映できる cache policy を持つ。
- design redesign が content source の大規模書き換えを要求しない。
- 旧実装はGit tagから再現でき、vNext active treeにfull legacy source copyを残さない。
