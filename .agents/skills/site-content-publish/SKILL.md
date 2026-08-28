---
name: site-content-publish
description: 内容と根拠が既に承認済みのmanual contentを、vNextのContentId、MDX/frontmatter、taxonomy、semantic media、route、interactive registry、provenance規約へ接続するためのSkill。記事調査、raw media変換、R2/Cloudflare操作、production deploy、human approvalの代行には使わない。
---

# Site Content Publish

## Purpose

Manual/legacy-approved contentを**current lifecycleに違反せず**repository publishing contractへ接続する。

This Skill is not the normal AI-first Article Job replacement。It does not gain source/public/protected storage credentials or bypass Article Job/human/provider gates。

## Read first

1. `docs/architecture/design-status.md`
2. `docs/product/product-context.md`
3. `docs/architecture/content-architecture.md`
4. relevant frontmatter/taxonomy/route contracts
5. `docs/architecture/media-pipeline.md`
6. `docs/contracts/media-asset-registry-contract.md`
7. `docs/architecture/seo-discovery-policy.md`
8. `docs/architecture/frontend-policy.md`
9. `docs/operations/validation.md`
10. provider/media taskなら`docs/architecture/infrastructure-handoff.md`
11. current implementation/schema only after lifecycle permits implementation

If Design=`PRE_FREEZE_REVIEW`, do not write target vNext structures into legacy production implementation as if migration were active。Use this Skill for design/manual-content preparation only within explicit task scope。

## Do use for

- approved/manual content collection classification
- stable ContentId/route/frontmatter/taxonomy planning
- semantic `media:` references to already-authorized/persisted media records
- approved content-module usage
- Interactive Module Registry binding metadata
- manual/legacy publication provenance proposal
- deterministic validation/reporting

## Do not use for

- topic research / evidence invention / argument drafting
- Article Job semantic AI stages
- generating human approval
- HEIC/raw image decode/normalization/variants
- persistent canonical-source storage
- public R2 upload
- protected-media copy
- Cloudflare/DNS/provider mutation
- production deploy/merge
- automatic legacy migration while lifecycle blocked

## Workflow

### 1. Check lifecycle and content class

Read `design-status.md` first。

Choose only an existing collection unless a material architecture change is explicitly requested:

- blog
- notes
- projects
- tools
- pages

If target schema is proposed but implementation migration is blocked, report target mapping without mutating old implementation as if accepted。

### 2. Resolve stable identity separately from route

Every vNext content entry has stable UUIDv4 ContentId。

For existing vNext content:

- preserve same ContentId
- route/title/file rename does not create new identity

For new manual content after implementation gate opens:

- use repository-defined ContentId generator
- never use slug/date/legacy numeric ID as ContentId

Route/slug is mutable human identity and must satisfy route contract。Route rename requires redirect handling。

### 3. Build minimal frontmatter

Use collection contract only。

Rules:

- no manually duplicated canonical/OG/JSON-LD/sitemap/search metadata
- no hero/object/component/provider path in normal frontmatter
- taxonomy only existing stable registry IDs
- unknown taxonomy becomes explicit proposal, not silent new term
- do not invent date/publication state
- no arbitrary provider/SEO fields

### 4. Media: semantic refs only

**Do not place normal article/project/site photographic/raster media in `src/assets/content` or `public/`.**

vNext normal media model:

```text
raw input
 -> private canonical media processing
 -> approved canonical source storage
 -> public delivery objects
 -> protected exact copy
 -> Git Media Registry/provenance
```

This Skill only integrates media already represented by a valid/authorized Media Registry record or an explicitly approved migration/manual media transaction completed outside the Skill。

MDX authoring:

```md
![説明](media:semantic-asset-id)
```

Never write:

- direct site-owned R2/custom-domain URL as semantic source
- object key
- `r2:/...`
- raw `.heic/.heif`
- manually maintained AVIF/WebP variants

If only raw/unpersisted media exists, stop and report required media workflow。Do not improvise an ad-hoc converter/uploader。

### 5. Integrate MDX/modules

Use plain Markdown first。Approved semantic modules only when needed。

Do not:

- add new LegacyHtml wrapper
- add arbitrary runtime component imports
- put React source path/hydration directive in Tool/Blog MDX

Interactive content binds stable Interactive Module Registry ID。Runtime framework/hydration is registry/runtime implementation responsibility, not content authoring metadata。

### 6. Provenance / traceability

For Article Job content, use Article Job export path instead of this Skill to ensure cleanup-safe material claim/source/recovery lineage。

For truly manual/legacy content after implementation exists:

- create/update explicit manual/legacy Publication Provenance according to contract
- do not pretend manual content came through Article Job
- do not invent evidence history
- preserve known source/legacy identity only

If material claims need evidence review, route back to research/Article Job rather than manufacturing provenance。

### 7. SEO/discovery derivation

Validate that content-derived system can generate:

- canonical
- social metadata
- structured data
- archives/pagination/RSS
- related content
- MiniSearch document eligibility

Do not hand-maintain generated search index/archive/feed records in content source。

### 8. Validate

Use repository deterministic validation when implementation gate is open。

Check at least:

- ContentId uniqueness/binding
- route/redirect
- frontmatter/taxonomy
- `media:` resolution + rights/provenance
- content module/interactive registry
- citation/provenance semantics applicable to origin
- SEO/discovery derivation
- no raster/raw/provider URL leakage
- no unexpected client runtime

Normal validation does not require remote media downloads/provider credentials。

### 9. Report; no deploy/provider mutation

Report:

- lifecycle status
- collection + ContentId + route
- taxonomy
- semantic media/interactive bindings
- provenance origin
- validation result
- unresolved media/provider/redirect/migration step
- draft/public intent

Do not claim R2/DNS/redirect/deploy happened unless a separate authorized operation actually did it。

## Definition of Done

- work is compatible with current lifecycle/task scope
- stable ContentId and route are not conflated
- frontmatter/taxonomy contracts satisfied
- no normal raster media added to Git
- semantic media refs resolve valid registry or are explicitly blocked pending external workflow
- no React path/hydration directive embedded in content
- manual/legacy provenance is truthful; Article Job provenance not forged
- deterministic validation passes where implementation exists, or unavailable step is explicitly bounded
- no approval/provider/deploy side effect was silently performed

## Stop / escalation

Stop rather than improvising when:

- Design/implementation gate does not permit requested migration write
- content identity is ambiguous
- unknown taxonomy/route owner
- only raw/unpersisted media exists
- media rights/provenance not authorized
- interactive module binding is missing
- manual content needs factual research/evidence work
- provider counterpart is still Proposed/blocked for required operation
- target vNext design conflicts materially with current implementation
