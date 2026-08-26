---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0027: portable MDX + controlled registries/modulesをdurable content authoring modelにする

## Context

vNext migration will preserve and continue growing a long-lived body of Blog/Notes/Projects/Tools/Pages content while framework, visual design, storage provider, search implementation, and interactive components may change over time。

If article source directly owns:

- free-form taxonomy that creates routes implicitly
- arbitrary React/component imports
- hydration directives/source paths
- provider media URLs/object keys
- SEO/social/search implementation fields
- page-specific arbitrary layout/runtime code

then future framework/provider/design changes require broad content rewrites and allow AI/manual authors to create unreviewed runtime/taxonomy surface。

The content model therefore needs an explicit durability/governance decision, not just scattered schema rules。

## Decision

Adopt a portable, controlled authoring model。

### 1. Markdown/MDX body is the durable content source

Use ordinary Markdown semantics first:

- prose/headings/lists
- code/tables/quotes
- links/footnotes
- logical media references

MDX is allowed for **approved semantic content modules**, not arbitrary application/runtime imports as normal authoring API。

### 2. Editorial metadata only in normal frontmatter

Frontmatter contains stable/editorial facts such as title/description/dates/taxonomy/editorial flags according to collection contract。

Do not store normal per-article implementation details such as:

- canonical/OG/JSON-LD/sitemap/search records
- responsive image width/format paths
- provider object/domain IDs
- React source path/hydration directive

These are system-derived or registry-owned。

### 3. Controlled taxonomy registry

Category/subject/tool-category/tags use stable version-controlled registry IDs。

- unknown term does not silently create a new route/taxonomy entity
- aliases/retired terms are explicit
- label changes do not require content identity change
- archive/indexability policy belongs to registry, not free-form article text

### 4. Semantic content-module registry

Special presentation uses a small approved semantic module API such as Figure/Gallery/Callout/Steps/Comparison/LinkCard/Details/Demo。

Article authors/AI do not introduce arbitrary JSX/layout/runtime dependencies as the default way to gain design freedom。

New reusable presentation need becomes a module proposal/review rather than invisible article-local architecture。

### 5. Interactive Module Registry

Tool/Demo content refers to stable semantic module IDs. Framework component path, React implementation, hydration directive, and bundle class belong to Interactive Module Registry/runtime implementation, not MDX body/frontmatter。

This allows interactive implementation to change without mass content rewrite and keeps React/runtime cost explicit/localized。

### 6. Semantic media references

Site-owned media in MDX uses logical `media:<asset-id>` references. Media Registry owns canonical source/public delivery/profile/provenance identities; provider domains/object keys remain implementation details。

### 7. System-derived discovery/presentation metadata

Canonical URL, social metadata, structured data, archive/RSS/related/search documents, responsive media markup and similar derived state are generated from content + registries/config。

Do not duplicate them manually per article as a second SoT。

### 8. Stable ContentId remains separate

This ADR uses ADR-0023 stable ContentId as entity identity. Portable authoring model does not make filepath/slug/title the identity authority。

## Alternatives

### Free-form MDX with arbitrary React imports and article-local layout code

Maximum local freedom but couples content to current framework/component paths, broadens runtime/security surface, and makes AI-generated content capable of architecture changes by import. Rejected as normal authoring model。

### Free-form category/tag strings that implicitly generate routes

Low authoring friction initially but produces spelling drift, duplicate/thin archives, unstable URLs and unreviewed taxonomy growth. Rejected。

### Framework/CMS-specific JSON as canonical content

Could give strict schema but reduces portability/readability and makes content lifetime depend more directly on the current application/tool. Rejected for primary prose source。

### Put provider URLs/component paths/SEO fields directly in frontmatter

Simple implementation but makes storage/framework/search changes mass-content migrations and creates duplicated SoT. Rejected。

### Pure Markdown with no semantic modules

Highly portable but unnecessarily limits figures/galleries/callouts/interactive demos. Controlled semantic MDX provides a bounded compromise。

## Consequences

Positive:

- long-lived prose remains readable/versionable outside the current renderer
- taxonomy/media/runtime/provider changes are localized to registries/config
- AI/manual authoring has a smaller safe surface
- redesign/framework/provider migration requires fewer content rewrites
- interactive runtime remains explicit and route-local

Costs:

- module/taxonomy/interactive registries need governance/validation
- genuinely novel article presentation may require adding/promoting a module rather than immediate arbitrary JSX
- legacy content with raw HTML/component/provider paths needs migration work

## Revisit triggers

- a real recurring content class cannot be represented without excessive semantic-module friction
- the site becomes an application/document platform where per-document runtime code is a core requirement rather than an exception
- an editor/CMS is adopted whose canonical source model materially improves durability without coupling content to proprietary/runtime representation
- controlled taxonomy no longer scales to the content domain and a different ontology model is required

## Related

- `architecture/content-architecture.md`
- `contracts/blog-frontmatter-contract.md`
- `contracts/collection-frontmatter-contracts.md`
- `contracts/taxonomy-registry-contract.md`
- `contracts/content-module-contract.md`
- `contracts/interactive-module-registry-contract.md`
- `contracts/media-asset-registry-contract.md`
- ADR-0023
