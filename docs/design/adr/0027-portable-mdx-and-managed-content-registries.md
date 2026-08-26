---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0027: portable MDX + managed registriesをdurable content modelにする

## Context

vNextの価値は現在のAstro component treeを保存することではなく、記事・note・project・toolを長期に追加/更新でき、framework/design/storage変更でcontent全件を書き換えないことである。

Legacy/content systemsでは次が混ざりやすい。

- free-form category/tag textがroute/archive identityになる;
- article MDXがReact component file pathやhydration directiveをimportする;
- layout freedomのためarticle-local JSX/CSS/Tailwind utilityが増える;
- hero/storage/provider URLやSEO presentation metadataがfrontmatterへ入る;
- runtime component renameやdesign changeがarticle source migrationを引き起こす。

これらを許すとcontent sourceがimplementation topologyへ結合する。

## Decision

vNext durable content modelは**portable Markdown/MDX + stable managed registries + approved semantic modules**とする。

## 1. Portable Markdown/MDX first

Plain semantic Markdownを第一選択にする。

- prose/headings/lists
- code/table/blockquote/link
- footnote/citation output
- ordinary logical media reference

をframework-specific componentなしで表現する。

MDXはspecial semantic moduleが必要な箇所だけに使う。

## 2. Stable managed taxonomy

Category/subject/tool-category/tagはfree-form route-generating textではなくversion-controlled stable registry ID。

- label/description/slugはmanaged metadata;
- unknown termをsilent create/fallbackしない;
- AI/importerの新termはproposalとしてreviewする;
- archive/indexabilityはregistry policyからderiveする;
- display label変更だけでcontent全件を書き換えない。

Exact initial taxonomy seed/valueはmigration inventory/contractの責務であり、このADRへ固定しない。

## 3. Approved semantic modules

Plain Markdownで意味を十分に表せない場合だけ、small approved semantic module setを使う。

Examples:

- Figure
- Gallery
- Callout
- Steps
- Comparison
- LinkCard
- Details
- Demo

Article sourceへarbitrary JSX component import、React source path、generic layout component、article-local utility framework sprawlをnormal APIとして許さない。

Exact props/module list versionはcontent-module contractで管理できる。

## 4. Interactive Module Registry

Interactive implementationはcontentから分離する。

Tool/Demo article sourceはstable logical module IDだけを参照し、registryが:

- implementation import
- UI framework
- hydration policy
- allowed collection/runtime metadata

を所有する。

React component移動/hydration tuningでMDXを書き換えない。

## 5. Presentation/provider metadata is derived or registered

Article sourceへnormal caseで埋め込まない:

- physical R2/CDN URL/object key
- React/Astro component source path
- hydration directive
- responsive image width/format list
- canonical URL/OG/JSON-LD/sitemap membership
- archive/search implementation details

Content keeps semantic identity/editorial facts. Site renderer/registries/config derive presentation/discovery/provider output。

## 6. Unknown implementation escape hatch is explicit

Shared semantic moduleで表現できないmaterial use caseは、ad-hoc article importでsilent bypassせず:

1. ordinary Markdownで表現可能か確認;
2. existing semantic module compositionを検討;
3. article-specific exceptional implementationが本当に必要ならexplicit review;
4. recurring patternならshared module/registry contractへpromote。

The exception does not create a second general authoring API。

## Why managed taxonomy and modules are one content-model decision

Both solve the same durability problem:

> content should reference stable semantic identities, not implementation/display strings that create hidden routes/runtime dependencies.

Taxonomy registry stabilizes information architecture identity; semantic/interactive registries stabilize presentation/runtime identity。

## Alternatives

### Free-form category/tag frontmatter

Authoring is simple initially but typo/spelling drift can create new archives/routes and makes alias/rename/indexability hard to govern, so rejected。

### Arbitrary MDX JSX/imports as normal authoring

Provides maximum local freedom but couples durable article source to current framework/component tree and permits uncontrolled client/runtime dependency growth, so rejected。

### CMS/plugin-style presentation metadata

Adds a second authoring/storage system and encourages content source to carry provider/SEO/presentation implementation details; not required for this personal Git/MDX publishing model。

### Plain Markdown only, no semantic modules

Very portable but insufficient for intentional galleries/callouts/steps/demos/tools without falling back to raw HTML or fragile conventions。A small typed semantic extension is preferable。

## Consequences

Positive:

- framework/design/provider changes require fewer content rewrites;
- taxonomy typo/alias/archive behavior is deterministic;
- AI authoring has a bounded content vocabulary;
- content-only routes do not accidentally inherit React/runtime imports;
- presentation/storage/discovery can evolve independently from article semantics。

Costs:

- one-time legacy content/taxonomy/runtime migration;
- registry/schema/tooling must exist;
- genuinely novel article layouts require explicit design rather than arbitrary inline JSX;
- unknown taxonomy/module proposals can block publication until reviewed。

These costs are accepted because long-term content durability/maintainability outrank unconstrained per-article implementation freedom。

## Migration implication

Greenfield migration must:

- convert legacy free-form/current taxonomy to reviewed registry IDs;
- remove presentation/storage/runtime fields from frontmatter where system-derived;
- replace direct runtime component imports with approved semantic/interactive bindings;
- isolate raw legacy HTML as migration debt rather than bless it as vNext API;
- preserve semantic content even when exact old visual implementation is retired。

## Revisit triggers

- a real repeated content need cannot be represented without excessive semantic-module complexity;
- multi-author workflow makes registry proposal/review friction materially harmful;
- a CMS becomes a separate explicit product requirement;
- content needs executable/interactive documents where current static MDX boundary is no longer adequate。

A revisit changes the authoring contract and requires a material ADR/migration plan rather than silent expansion of arbitrary imports。

## Related

- `../../architecture/content-architecture.md`
- `../../contracts/taxonomy-registry-contract.md`
- `../../contracts/content-module-contract.md`
- `../../contracts/interactive-module-registry-contract.md`
- `../../contracts/blog-frontmatter-contract.md`
- `../../contracts/collection-frontmatter-contracts.md`
