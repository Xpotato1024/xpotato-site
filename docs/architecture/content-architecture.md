---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - content model
  - URL and taxonomy semantics
  - legacy content boundary
---

# Content Architecture

## Product relation

primary authoring unit=1本のportable MDX content entry。

AI-first publishingはArticle Job standardだが、long-term content sourceはMDX + registries。

## Content engine / identity

Astro current Content Layer/Collectionsをtarget。

legacy `src/content/config.ts` compatibility APIをtarget designにしない。

全entryはstable UUIDv4 ContentId。

```text
ContentId = immutable internal identity
slug/path = mutable public route
```

media/provenance/update/related lineageはContentIdへbindする。

## Collections

- blog
- notes
- projects
- tools
- pages

exact frontmatter contractsを参照し、presentation/storage/runtime fieldをfrontmatterへ混ぜない。

## MDX-first

plain Markdown:

- prose/headings/lists
- code/table/blockquote
- link/footnote
- ordinary logical image

site-owned image:

```md
![説明](media:semantic-asset-id)
```

R2 URL/keyをMDXへ直書きしない。

approved semantic modules only:

- Figure
- Gallery
- Callout
- Steps
- Comparison
- LinkCard
- Details
- Demo

arbitrary JSX/React import/article-local layout CSSをdefault authoring APIにしない。

## Interactive content

Tool/Demo implementationはInteractive Module Registryでbind。

MDXはReact path/hydration directiveを持たない。

## Metadata classes

1. stable/editorial facts
2. system-derived
3. exception-only override

system-derived:

- canonical/OG/JSON-LD
- archives/RSS
- MiniSearch search document eligibility/metadata
- related input
- media delivery variants

をfrontmatterへ重複しない。

## Taxonomy

free-form taxonomy禁止。

- Blog category
- Note subject
- Tool category
- Tag technology/topic

unknown termをsilent create/fallbackしない。

## URL ownership

- Blog `/blog/<slug>/`
- Notes `/notes/<slug>/`
- Projects `/projects/<slug>/`
- Tools `/tools/<slug>/`
- Pages route registry/root-level

route rename=same ContentId + redirect。

path redirect=site、query/domain/provider redirect=infra。

## Media ownership

media semantic layers:

```text
raw job/user input
 -> privacy-normalized canonical source
 -> deterministic delivery master/variants
 -> private candidate/human approval
 -> private canonical source-media storage
 -> public delivery media
 -> protected exact-byte recovery media
 -> Git registry/provenance
```

### Raw

HEIC/JPEG/PNG等。Git/R2 long-term site sourceにしない。

### Canonical source

lossless privacy-normalized reprocessing source。

private source-media plane only after approval。

### Public delivery

content-addressed delivery master + prebuilt variants。

### Protected recovery

exact public object copy; browser/provider URL identityではなくreceipt chainで追跡。

Gitにはmedia bytesを置かず:

- semantic asset ID
- canonical source SHA/profile
- public delivery SHA/key/profile
- provenance/rights

を保存する。

## Visual policy

Blog:

- hero required
- social card required

Notes/Projects/Tools optional、Pages default none。

AI hero=non-evidence。

## Citations / examples

citation=fixed Source ID -> deterministic footnote。

technical examples:

- illustrative
- syntax_checked
- sandbox_executed
- evidence_observed
- not_verifiable

verification classをAI自己申告で昇格させない。

## Discovery derivation

archive/pagination/RSS/related/searchはcontent + registriesからbuild-time derived。

static search:

- MiniSearch 7.2.0
- shared tokenizer `xpotato-ja-tech-bigram-v1`
- serialized index is deploy artifact, not content SoT

search engine変更でMDX/frontmatterを書き換えない。

## MDX safety

- new raw legacy HTML禁止
- arbitrary `set:html`禁止
- approved module/transform only
- provider/storage URLをauthoring APIにしない
- runtime metadata fetchをnormal article renderへ入れない

## AI publication boundary

```text
source/evidence
 -> draft
 -> example assessment
 -> content audit/revision
 -> visual/canonical media
 -> visual audit
 -> variants
 -> candidate/preview
 -> human approval
 -> canonical source store
 -> public delivery publish
 -> protected copy
 -> repository export
```

full job workspaceはdurable Git ref確認後にexplicit cleanup可能。

## Validation

- ContentId uniqueness
- collection schema/routes
- taxonomy refs
- media logical/canonical/delivery refs
- visual policy
- citation/example integrity
- approved modules/interactive binding
- redirect conflicts
- discovery exclusion
- MiniSearch eligibility metadata
- provenance/source-storage/publication/protection hash consistency
- no content raster media in Git
