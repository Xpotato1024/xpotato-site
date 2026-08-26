---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - initial static search implementation profile
  - Japanese/technical tokenizer profile
  - search result ranking defaults
---

# Static Search Profile v1

## Decision

vNext initial full-text searchは **MiniSearch 7.2.0 + repository-owned deterministic tokenizer** を採用する。

Pagefind Extendedはinitial baselineから外す。

理由はPagefind 1.5.2で、日本語index時Lindera segmentationとbrowser query時`Intl.Segmenter`の不一致により、自然なcompound queryが無関係結果へ崩れる再現性の高いopen issueがあるため。

xpotato-siteは日本語技術記事がprimary contentなので、search correctnessをlibrary convenienceより優先する。

## Package

initial:

```text
minisearch = 7.2.0
```

requirements:

- exact versionをroot lockfileでpin
- index/search tokenizerはsame repository-owned implementation
- serialized indexはbuild artifactでGit非管理
- search runtimeは`/search/` routeだけでload

MiniSearchはcustom tokenizer、JSON serialization/deserializationを提供する。

## Why not Pagefind v1.5.x initially

Pagefind Extended自体はJapanese indexing supportを持つが、v1.5.xでquery側に`Intl.Segmenter`を導入した結果、index tokenizerとquery tokenizerが日本語compoundで一致しないcaseが報告されている。

代表例:

```text
新幹線
```

index: `新` + `幹線`
query: `新幹線`

となり、fallback matchingでgeneric `新` が支配して無関係ページが上位になり得る。

upstream issue workaroundとしてgenerated Pagefind bundle patchも提案されているが、minified internal code patchをproduction search contractにしない。

Pagefindはfuture candidateとして再評価可能。upstreamがsame-tokenizer semanticsを保証し、regression fixtureがPASSする場合のみ新ADRで戻す。

## Search architecture

```text
Astro static build
  -> published/indexable HTML/content extraction
  -> SearchDocument[]
  -> shared xpotato tokenizer
  -> MiniSearch index build
  -> serialized static index
  -> deploy artifact

/search/
  -> route-local search JS
  -> fetch serialized index
  -> same shared tokenizer
  -> MiniSearch.loadJSON
  -> query/results
```

server/search databaseは不要。

## SearchDocument

initial logical fields:

```ts
interface SearchDocument {
  id: ContentId;
  route: string;
  collection: "blog" | "notes" | "projects" | "tools" | "pages";
  title: string;
  description: string;
  taxonomyText: string;
  headingText: string;
  bodyText: string;
  pubDate?: string;
}
```

stored result fields:

- route
- collection
- title
- description
- pubDate

body全文をresult payloadへduplicateしない。

initial result UIはtitle + description + collection/date/taxonomy badgeを基本とし、body excerpt generationをlaunch requirementにしない。

## Shared tokenizer v1

ID:

```text
xpotato-ja-tech-bigram-v1
```

implementationはpure deterministic TypeScript functionとし、build/browserで同じsourceを使用する。

### Normalization

1. Unicode NFKC
2. Latin alphabetはlowercase
3. control/invisible separatorsをnormal delimiterへ
4. punctuationをtechnical-token例外以外はboundaryとして扱う

locale/runtime dictionary tokenizerにcorrectnessを依存しない。

### CJK/Japanese runs

対象:

- Han
- Hiragana
- Katakana
- prolonged sound mark `ー`

contiguous runをUnicode code point単位で処理する。

run length:

- 1: single token
- 2: exact 2-char token
- 3+: overlapping bigrams

例:

```text
新幹線 -> 新幹, 幹線
うさぎ -> うさ, さぎ
マイレージ -> マイ, イレ, レー, ージ
```

index/searchで同じ結果になる。

単一漢字queryもsupportするため、document indexingではCJK unigramも低-weight auxiliary fieldへ生成できる。ただしprimary body tokenへunigramを混ぜてgeneric hitを支配させない。

initial implementationでは:

- primary CJK field = bigram/exact pair
- auxiliary `cjkSingles` field = unigram, low boost

とする。

### ASCII / technical runs

technical runは少なくとも:

```text
A-Z a-z 0-9 _ - . + #
```

を考慮する。

例:

```text
GPT-5.6
C++
C#
WSL2
xpotato-site
Astro
```

whole normalized tokenを保持し、区切り文字を含むtokenでは有用なsub-tokenも生成できる。

例:

```text
xpotato-site -> xpotato-site, xpotato, site
gpt-5.6      -> gpt-5.6, gpt, 5.6
```

sub-token ruleはversioned tokenizer fixtureで固定する。

## MiniSearch fields / weights

initial index fields:

```text
title
taxonomyText
headingText
bodyText
cjkSingles
```

initial relative boost:

```yaml
title: 6
taxonomyText: 3
headingText: 2
bodyText: 1
cjkSingles: 0.25
```

exact MiniSearch option syntaxはimplementation configをmachine SoTとする。

## Query policy

initial:

- normal terms: AND semanticsを優先
- fuzzy: disabled
- prefix: ASCII technical tokenだけenable candidate
- CJK bigramへfuzzy/prefix expansionを掛けない
- empty/1-character generic queryではUI側でbounded behavior

reason:

small/medium personal corpusでapproximate fuzzy resultを返すより、なぜmatchしたか理解できる結果を優先する。

0 results時にsilent aggressive fuzzy fallbackをしない。

将来OR/broader-results laneを追加する場合はUI上で明示する。

## Search result ranking

ranking engineはMiniSearch built-in relevance + field boosts。

additional application-side tie break:

1. score
2. title exact/whole technical token match where exposed
3. updated/pub date only as final tie-breaker

recencyだけでtechnical relevanceを上書きしない。

## Index generation

post-Astro buildをbaselineとする。

- `data-search-body`等のexplicit searchable regionだけextract
- nav/footer/related/common chromeを除外
- draft/noindex/search-ineligible routeを除外
- HTMLからplain searchable textをdeterministicに抽出
- same build revisionからserialized MiniSearch index生成

output candidate:

```text
dist/search/search-index.json
```

stable path + revalidation cacheでよい。site deployはatomic artifactなのでindex revision skewを作らない。

index JSONはGitへcommitしない。

## Browser runtime

`/search/`だけ:

- route-local bundled MiniSearch
- route-local xpotato tokenizer
- search UI adapter
- static index fetch

normal Blog/Project/Note routeへMiniSearch JSを送らない。

MiniSearch v7系は小さなbrowser libraryで、current packageはruntime dependency 0。

## Search UI

initial UIはsite-owned Astro/vanilla TypeScriptを基本とする。

React islandは不要。search stateだけならsmall vanilla moduleで十分。

requirements:

- input label
- keyboard usable
- IME composition中に検索確定しない
- debounced query
- loading/error/0-result state
- result count
- title/description/link
- collection/taxonomy filter optional but initial architecture compatible

search queryをserverへ送らない。

## Privacy

searchはfully client-side/static。

query telemetry/analyticsをbaselineにしない。

indexへprivate provenance、source ledger、draft、noindex contentを含めない。

## Regression fixture

Design Freeze前/implementation時に少なくとも次を持つ。

### Japanese compounds

```text
新幹線
書き込み
仮想化
機械学習
自己ホスト
```

### Katakana

```text
プロテイン
インフラストラクチャ
マイグレーション
```

### Mixed technical

```text
WSL ネットワーク
Astro MDX
SQLite 書き込み
GPU 最適化
GPT-5.6
```

### False-positive guard

- query tokenを含まないgeneric `新...` pageが`新幹線` exact corpus pageより上位にならない
- `C++` / `C#` / version dotsをpunctuation removalで破壊しない
- noindex/draft route returns none

exact fixture corpusはmigrated current articlesから小さく固定する。

## Upgrade gate

MiniSearch version/tokenizer version変更時:

- serialized index regenerate
- Japanese regression fixture
- mixed technical fixture
- index bytes
- search route JS bytes
- representative latency

を比較する。

latest versionだから自動upgradeしない。

## Revisit Pagefind

Pagefindを再採用する条件:

- Japanese index/query segmentation semanticsがupstreamで整合
- current regression fixture PASS
- custom bundle patch不要
- bundle/index/UX benefitがMiniSearchよりmaterial

単にPagefindの方がSSG向けに有名という理由では戻さない。

## References

- MiniSearch package/docs: https://www.npmjs.com/package/minisearch
- MiniSearch tokenization/serialization: https://lucaong.github.io/minisearch/
- Pagefind Japanese tokenizer mismatch issue: https://github.com/Pagefind/pagefind/issues/1237
- Pagefind multilingual docs: https://pagefind.app/docs/multilingual/
