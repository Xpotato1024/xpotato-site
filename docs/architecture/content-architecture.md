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

## Decision basis

Material rationale=`../design/adr/0027-portable-mdx-and-managed-content-registries.md`。

The durable content-authoring model is intentionally **portable Markdown/MDX + stable managed registries + approved semantic modules**, not free-form taxonomy/arbitrary runtime imports/provider paths embedded in article source。

Exact field/module/taxonomy values remain contract/profile concerns; changing this authoring model itself is a material decision requiring a new ADR/migration plan after acceptance。

## Product relation

Primary durable authoring unit=one portable MDX content entry + registries/provenance。

AI-first publication uses Article Job, but long-term reader content does not depend on AI session/provider/job workspace。

## Content engine / identity

Target Astro current Content Layer/Collections。

Every entry has stable UUIDv4 ContentId:

```text
ContentId = immutable internal identity
slug/path = mutable public route
```

Media/provenance/update/related lineage binds ContentId。Legacy collection APIs are migration evidence, not target API。

## Collections

- blog
- notes
- projects
- tools
- pages

Frontmatter contracts hold editorial/stable facts only; presentation/storage/runtime fields live in registries/contracts。

## MDX-first

Plain Markdown first for prose/headings/lists/code/table/blockquote/link/footnote/ordinary logical image。

Site media:

```md
![説明](media:semantic-asset-id)
```

No direct provider object URL/key in authoring surface。

Approved semantic modules:

- Figure
- Gallery
- Callout
- Steps
- Comparison
- LinkCard
- Details
- Demo

No arbitrary article JSX/React import/layout utility sprawl as default authoring API。

If a repeated semantic need is missing, propose/review a shared module rather than silently creating a second arbitrary authoring API。A truly one-off exceptional implementation requires explicit review and does not become the normal content contract。

## Interactive content

Tool/Demo implementation binds through Interactive Module Registry。MDX owns no React file path/hydration directive。

Framework/component/hydration changes stay in runtime registry/implementation so durable MDX does not require mass rewrite。

## Metadata classes

1. stable/editorial facts
2. system-derived
3. exception-only overrides

System-derived includes canonical/OG/JSON-LD, archives/RSS, MiniSearch documents, related input, media delivery variants。

Normal content does not duplicate provider/search/runtime/SEO implementation paths in frontmatter。

## Taxonomy

Managed registries only:

- Blog category
- Note subject
- Tool category
- technology/topic tags

Unknown term cannot silently create/fallback。

Registry IDs are stable semantic identities。Labels/slugs/archive/indexability/aliases are managed metadata; a display-label change alone does not require rewriting content identity。

Exact initial seed/migration dispositions are owned by taxonomy/migration contracts, not ADR-0027。

## URL ownership

- Blog `/blog/<slug>/`
- Notes `/notes/<slug>/`
- Projects `/projects/<slug>/`
- Tools `/tools/<slug>/`
- Pages route registry/root-level

Route rename=same ContentId + redirect。

Application path redirect=site; query/domain/provider redirect=infra after accepted provider state。

## Material claim durability

Detailed Source/Evidence/Claim records are Article Job artifacts。Published reader content must not lose support semantics when those private artifacts are cleaned。

Every **material Article Job claim** must export a cleanup-safe compact binding:

```text
published statement hash/locator
 -> evidence proposition summary/hash + interpretation
 -> durable CompactSourceRef identity
```

Citation and durable evidence binding are separate:

- citation = reader-facing public source representation
- material claim binding = internal durable support traceability

Private-only source may remain non-citable while still represented by safe description/hash in durable provenance。

External-AI disclosure permission is another independent dimension; see `../contracts/external-ai-disclosure-contract.md` / ADR-0026。A content source being citable/public-safe does not automatically mean it is admitted to an external provider request。

## Media ownership

```text
raw job/user input
 -> privacy-normalized canonical source
 -> visual audit
 -> deterministic delivery master/variants
 -> private candidate/human approval
 -> private canonical source storage
 -> public delivery media
 -> protected exact-byte media
 -> compact recovery binding
 -> Git registry/provenance
```

### Raw

HEIC/JPEG/PNG/provider raw etc。Not long-term site storage authority。

### Canonical source

Lossless privacy-normalized future reprocessing source。Persisted privately only after approval when required。

### Public delivery

Content-addressed delivery master + prebuilt variants。

### Protected exact bytes

Exact public required object set。Full receipt is operational artifact; Git retains cleanup-safe compact `protectedObjectRef` bindings for normal restore initiation after job cleanup。

Git media/provenance stores provider-neutral:

- semantic asset ID
- canonical source SHA/profile/storage class
- public delivery SHA/key/profile
- rights/provenance
- protection receipt hash + compact recovery refs

No media bytes/account credentials/provider IDs。

## Visual policy

Blog hero + social card required。Notes/Projects/Tools optional; Pages default none unless page policy says otherwise。

AI-generated visual is non-evidence。

## Citations / technical examples

AI citation: fixed Source ID -> deterministic public footnote only。

Technical examples expose verification class:

- illustrative
- syntax_checked
- sandbox_executed
- evidence_observed
- not_verifiable

AI self-report does not promote verification class。

## Discovery

Archives/pagination/RSS/related/search derive from content + registries at build time。

Static search target:

- MiniSearch 7.2.0
- tokenizer `xpotato-ja-tech-bigram-v1`
- serialized deploy artifact

Changing search engine must not require content/frontmatter rewrite。

## MDX safety

- no new raw legacy HTML path
- no arbitrary `set:html`
- approved modules/transforms only
- no provider/storage URL as content API
- no runtime metadata fetch for normal article rendering
- no arbitrary framework import as normal authoring API

## AI publication boundary

```text
source/evidence
 -> disclosure-admitted external/local semantic processing as applicable
 -> draft/claims
 -> examples
 -> independent content audit/revision
 -> visual/canonical source
 -> independent visual audit
 -> delivery variants
 -> candidate with durable material-claim ledger proposal
 -> preview/human approval
 -> canonical source storage
 -> public delivery publication
 -> exact-byte protection/full receipt
 -> durable mediaRecovery binding
 -> repository export
```

`EXPORTED` means long-term claim traceability/media restore entrypoint has been materialized in Git provenance, not merely that bundle/receipt hashes exist。

Full private job workspace may later be explicitly cleaned only under ADR-0024 retention policy。

## Migration implication

Greenfield migration must deliberately convert legacy implementation-coupled content:

- free-form/current taxonomy -> reviewed stable registry IDs
- presentation/storage/runtime frontmatter -> system/registry-owned fields where appropriate
- direct component/React/hydration binding -> semantic content/Interactive Module Registry IDs
- direct site-owned media paths/URLs -> semantic media registry refs
- raw legacy HTML -> semantic MDX/module representation or explicitly bounded migration debt

Do not preserve an old implementation detail solely to avoid this one-time migration if doing so would create a second durable authoring model。

## Validation

- ContentId/route/collection schema
- taxonomy refs + no silent unknown creation
- logical/canonical/delivery media refs
- visual policy
- citation/example integrity
- all material Article Job claims have current durable support bindings
- approved modules/interactive bindings
- no arbitrary normal runtime imports/provider paths in content
- redirect conflicts/discovery exclusion
- MiniSearch eligibility
- canonical-source/publication/protection/recovery-binding chain consistency
- cleanup-safe provenance has no private raw body/path/credential
- no content raster media bytes in Git
