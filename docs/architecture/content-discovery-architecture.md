---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - content discovery architecture
  - archive and pagination generation
  - RSS generation
  - static site search architecture
  - related content generation
---

# Content Discovery Architecture

## Goal

記事数が増えても、authorがarchive / RSS / search index / related listを手作業で管理しない。

content discoveryはsource content + taxonomy / media registryからdeterministicに導出する。

## Layers

```text
MDX + frontmatter + registries
            |
            v
   build-time content catalog
      /       |        \
     /        |         \
archives   RSS/feed   related-content
     |                    \
     v                     \
static HTML pages           \
     |                       \
     +---- searchable regions + metadata
                    |
                    v
      post-build SearchDocument extraction
                    |
                    v
      xpotato deterministic tokenizer
                    |
                    v
         serialized MiniSearch index
                    |
                    v
            /search/ only runtime
```

search indexはrebuildable artifactでありcontent SoTではない。

## Derived content catalog

buildで公開対象entryからinternal `ContentDiscoveryRecord`を導出する。

```ts
interface ContentDiscoveryRecord {
  contentId: ContentId;
  collection: "blog" | "notes" | "projects" | "tools" | "pages";
  route: string;
  title: string;
  description: string;

  pubDate?: string;
  updatedDate?: string;

  categoryId?: string;
  subjectId?: string;
  toolCategoryId?: string;
  tagIds: string[];

  featured: boolean;
  heroAssetId?: string;
  siteSearchEligible: boolean;
  webIndexable: boolean;
}
```

これはderived build objectでありauthorが手書きしない。

## Published / searchable set

normal public discoveryへ含める条件:

- `draft=false`
- route valid
- content schema valid
- collection-specific publication gate valid

`webIndexable`とsite internal search eligibilityは別semanticだが、initial policyでは`webIndexable=false` contentをsite searchにも含めない。

private / preview / draft contentをserialized search indexへ漏らさない。

## Blog archive

### Root

```text
/blog/
/blog/page/2/
/blog/page/3/
...
```

page 1は`/blog/`のみ。`/blog/page/1/`を生成しない。

### Category

```text
/blog/category/<slug>/
/blog/category/<slug>/page/2/
```

Taxonomy Registryのactive categoryから生成。

### Tag

`TagRecord.archive=true`のみ:

```text
/blog/tag/<slug>/
/blog/tag/<slug>/page/2/
```

### Year

記事が存在する年だけ:

```text
/blog/archive/<yyyy>/
```

month archiveはinitial non-goal。

## Notes discovery

```text
/notes/
/notes/page/2/
/notes/subject/<slug>/
```

subject archiveは`NoteSubjectRecord.archive=true`のみ。

## Projects / Tools

Projects:

```text
/projects/
```

Tools:

```text
/tools/
```

初期content数ではstatus/technology/tool categoryごとの大量indexable routeを作らない。

client-side grouping/filterを追加しても無制限query combinationをSEO routeにしない。

## Pagination

paginationはstatic generation。

initial profile:

```text
Blog: 12 items/page
Notes: 12 items/page
```

page sizeはversion-controlled discovery profileで管理しfrontmatterへ置かない。

rules:

- empty page生成禁止
- page 1 duplicate URL禁止
- each page self-canonical
- previous/next normal `<a>`
- JavaScriptなしで全pageへ到達可能
- out-of-range 404

## Ordering

Blog / Notes:

1. `pubDate desc`
2. stable ContentId / route tie-break

Project/Tool orderingもmachine profileからdeterministicにする。

## RSS

Blog public feedをstatic生成する。

```text
/rss.xml
```

initial profile:

```text
max items: 20
mode: summary
```

full long-form article/media/interactive contentをfeedへ複製しない。

GUIDはstable ContentId + site identityからderiveしslug renameでitem identityを変えない。

runtime server不要。

## Related content

article pageのrelated contentはbuild-time deterministic calculation。

signals:

- shared technology tags
- shared topic tags
- same Blog category / Note subject
- same collection
- recency = tie-break only

initial max:

```text
4 items
```

exact score weights/minimum scoreはversioned profileで固定する。

rules:

- self excluded
- draft/noindex excluded
- deterministic order
- request-time AI/embedding APIなし

semantic/vector relatedを導入する場合はmaterial decision。

# Static full-text search

## Engine

initial engineは **MiniSearch 7.2.0**。

search semanticsは`../operations/static-search-profile.md`を正とする。

Pagefind ExtendedはADR-0016で検討したが、current Pagefind 1.5.2でJapanese index/query segmentation mismatchのopen issueを確認したためADR-0021でsupersedeした。

## Tokenization ownership

Japanese search correctnessをruntime dictionary差へ依存させない。

repository-owned pure tokenizer:

```text
xpotato-ja-tech-bigram-v1
```

をbuild/indexとbrowser/query双方で使う。

primary Japanese/CJK token:

- contiguous CJK run length 2 = exact pair
- length 3+ = overlapping bigram
- low-weight unigram auxiliary field for single-character query support

ASCII technical tokenはwhole token + bounded sub-token rule。

例:

```text
新幹線       -> 新幹, 幹線
マイレージ   -> マイ, イレ, レー, ージ
xpotato-site -> xpotato-site, xpotato, site
GPT-5.6      -> gpt-5.6, gpt, 5.6
```

same tokenizer sourceをbuild/browserで共有し、Node/browser ICU dictionary差をsearch correctnessへ入れない。

## Build order

```text
Astro build
  -> static HTML / assets
  -> searchable region extraction
  -> SearchDocument[]
  -> shared tokenizer + MiniSearch index
  -> serialized static index
  -> search validation
  -> deploy artifact
```

serialized indexはGitへcommitしない。

## Searchable scope

page templateでsearchable main bodyを明示する。

index対象:

- title
- description
- main content body
- headings
- useful taxonomy labels

index除外:

- global nav/footer
- related/common chrome duplication
- draft/noindex
- private provenance
- UI boilerplate/copy labels

## Search result payload

stored result fieldsは最小化する。

- route
- title
- description
- collection
- pubDate

body全文をresult display payloadとしてduplicateしない。

initial result UIはtitle + descriptionを中心とし、body excerpt generatorをlaunch hard requirementにしない。

## Ranking

initial relative field priorities:

```text
title        6
taxonomy     3
headings     2
body         1
CJK unigram  0.25
```

normal multi-term queryはAND優先。

- fuzzy search initial off
- CJK fuzzy/prefix expansionなし
- unrelated approximate resultを0-result fallbackとしてsilent表示しない

broader/OR resultsを将来追加するならUI上で明示する。

## Search UI

canonical route:

```text
/search/
```

site-owned Astro + small vanilla TypeScriptを初期標準にする。

requirements:

- accessible label
- keyboard
- IME composition aware
- debounced query
- loading/error/empty states
- result count
- normal crawlable links

searchだけのためReactを使わない。

MiniSearch/search UI bundleは`/search/`のみloadし、normal article/archive routeへ送らない。

## Search privacy

fully static/client-side。

- query server送信なし
- telemetry baselineなし
- private source/provenanceなし

## Search staleness

search indexはsame site buildから毎回生成する。

old search index + new HTMLを別deploy revisionとして混在させない。

## Validation

- archive/pagination deterministic
- no duplicate page1
- archive count = catalog filter count
- RSS valid/public only
- related no self/draft
- MiniSearch index generation succeeds
- same tokenizer fixture at build/browser
- representative Japanese compound queries expected top-k
- mixed technical query fixtures
- Pagefind issue reproduction (`新幹線` vs generic `新...`)をfalse-positive regression fixtureとして持つ
- no draft/noindex in index
- search result routes exist
- normal article route has no MiniSearch/search runtime JS
- serialized index size/search route JS sizeをbudget tracking

## References

- MiniSearch: https://www.npmjs.com/package/minisearch
- MiniSearch docs: https://lucaong.github.io/minisearch/
- Pagefind Japanese mismatch: https://github.com/Pagefind/pagefind/issues/1237
- `../operations/static-search-profile.md`
