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

primary authoring unitは1本のMDX content entry。

AI-first Blog productionはArticle Jobを標準にするが、content source自体はportable MDX / registryとして長期維持する。

## Content engine

Astro current Content Layer / Content Collectionsを使用する。

legacy `src/content/config.ts` compatibility APIをtarget designとしない。

## Stable identity

全collection entryはmachine-generated stable UUID v4 `ContentId`を持つ。

```text
ContentId = immutable internal identity
slug/path = mutable route identity
```

Media Registry、Publication Provenance、Article update、related-content lineageはContentIdへbindする。

route renameでContentIdを変更しない。

exact contractは`contracts/content-identity-contract.md`。

## Collections

- `blog`: editorial article
- `notes`: learning/research note
- `projects`: project identity / record
- `tools`: browser utility
- `pages`: long-lived fixed page

exact frontmatter:

- Blog -> `contracts/blog-frontmatter-contract.md`
- others -> `contracts/collection-frontmatter-contracts.md`

collectionを増やす場合、schema/route/navigation/ownershipが既存collectionと実質的に異なることを示す。

## MDX-first authoring

### Plain Markdown first

- paragraph
- heading
- list
- fenced code
- table
- ordinary image logical reference
- link
- blockquote
- footnote/citation exported representation

をMarkdown第一選択とする。

### Ordinary image

site-owned image:

```md
![説明](media:semantic-asset-id)
```

R2 URL / object keyをMDXへ直書きしない。

Media Registry + delivery profileがresponsive HTMLへ解決する。

### Content modules

Markdownで意味を十分に表せない場合だけapproved module。

initial API:

- Figure
- Gallery
- Callout
- Steps / Step
- Comparison
- LinkCard
- Details
- Demo

factual software diagram用のdeterministic build-time diagram supportはimplementation fixtureで追加可能。

article-local arbitrary JSX layout / React import / Tailwind utility layoutをauthoring APIにしない。

## Interactive content

Tool MDX / Blog DemoはReact source pathやhydration directiveを所有しない。

Interactive Module Registryで:

- stable module ID
- explicit component import map
- framework
- hydration
- allowed collection

を管理する。

published Toolはexactly one active primary bindingを持つ。

## Metadata classes

metadataを:

1. stable identity/editorial facts
2. system-derived values
3. exception-only overrides

へ分離する。

system-derived:

- canonical URL
- OG metadata
- JSON-LD
- archive membership
- RSS membership
- search metadata
- related-content input
- responsive media variants

をfrontmatterへ重複保存しない。

## Taxonomy

free-form taxonomyを使わない。

registries:

- Blog category
- Note subject
- Tool category
- cross-collection Tag (`technology | topic`)

AI/authorがunknown termをsilent createしない。proposalへ分離する。

## URL ownership

- Blog `/blog/<slug>/`
- Notes `/notes/<slug>/`
- Projects `/projects/<slug>/`
- Tools `/tools/<slug>/`
- Pages root-level / route registry

slugはhuman-readable route identityでContentIdとは別。

route renameはsame changeでredirectを要求する。

## Redirect classes

### Application path redirect

site repo owner。build artifactへ反映。

### Query/domain/provider redirect

WordPress `/?p=...`、domain-level rule等は`Xpotato-Server` infrastructure owner。

frontmatter `legacyUrls`はhistorical identity evidenceでありredirect activationではない。

## Media ownership

normal content media:

- author raw source -> private
- normalized public master -> R2 immutable content-addressed object
- semantic binding -> Git Media Registry
- responsive delivery -> edge transformation or R2 variants

Gitにarticle photo / screenshot / AI hero binaryを保存しない。

Git bundled assetはfavicon/logo/small UI icon/textual SVG/fixture等に限定する。

public R2を唯一のrecovery authorityにしない。

## Collection visual policy

Blog:

- hero required
- social card required

Notes/Projects/Tools:

- hero optional unless future machine policy changes

Pages:

- page-specific requirementがなければhero不要

Blog hero requirementを全collectionへ一般化しない。

AI-generated visualはtechnical evidenceではない。

## Citations

Article Job authorはfixed Source ID markerだけを使用する。

candidate materializationでvalidated Source metadataからportable Markdown footnoteへcompileする。

private source locatorをpublic articleへ漏らさない。

## Technical examples

code/command/configuration exampleは本文fact auditとは別にverification artifactを持てる。

- illustrative
- syntax_checked
- sandbox_executed
- evidence_observed
- not_verifiable

を区別し、AIが自己申告でverified/observedへ昇格させない。

## Discovery derivation

archive / pagination / RSS / related / search metadataはcontent + taxonomy + route + media registryからbuild-time導出する。

Pagefind search indexはgenerated static artifactでcontent SoTではない。

## MDX safety

- raw legacy HTML wrapperをnew content pathにしない
- arbitrary `set:html`禁止
- approved module / remark transformのみ
- storage/provider URLをarticle authoring surfaceにしない
- runtime metadata fetchをarticle renderに持ち込まない

WordPress importerはlegacy migration referenceでありactive publishing workflowではない。

## AI authoring boundary

AI-generated draftはprivate Article Job workspace。

source -> evidence -> draft -> example assessment -> independent audit -> visual -> candidate -> human approval -> R2 media publication -> repository export

を経て初めてcanonical contentへ入る。

## Content correctness validation

- UUID v4 ContentId uniqueness
- collection schema
- duplicate/conflicting route
- taxonomy refs
- logical media refs
- collection visual policy
- citation / footnote integrity
- approved MDX modules only
- interactive module binding
- legacy redirect conflict
- draft/public discovery exclusion
- Publication Provenance hash consistency
- no content media binary in Git
