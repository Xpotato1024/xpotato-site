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

## Purpose

`xpotato-site` is a long-lived personal technical publishing platform for articles, learning notes, projects, and small browser tools。

The purpose is not “maintain an Astro site”。Primary goal:

**make content easy to add/update while preserving URL continuity, metadata, taxonomy, media, search, delivery quality, AI evidence lineage, and recovery at low operational cost.**

Blog is the primary publishing path; Notes / Projects / Tools / Pages share identity/governance/site shell。

Normal new/update Blog flow is AI-first but human-approved。

## Primary authoring unit

One content revision。

Normal Blog Article Job:

1. topic / notes / source hints
2. source discovery + deterministic pinning
3. evidence/ambiguity construction
4. AI draft
5. citation + technical-example assessment
6. independent content audit + bounded revision
7. visual plan/generation/ingest
8. independent visual audit
9. deterministic responsive variants from audited canonical source
10. private exact candidate preview
11. human approval
12. approved privacy-normalized canonical source persistence
13. approved public delivery persistence
14. exact published-byte protection
15. cleanup-safe durable claim/recovery provenance generation
16. deterministic Git export
17. PR validation / merge after separate operator workflow
18. static build + deterministic MiniSearch index
19. GitHub Actions + Wrangler deploy after accepted implementation/provider gates

Article authors do not hand-manage canonical URL/OG/JSON-LD/sitemap/archive/RSS/related/search metadata/responsive variants/cache headers per article。

## Authoring goals

### G1. MDX-first

Portable Markdown/MDX is the durable body source。Typed semantic modules only where plain Markdown cannot express intent cleanly。

Raw HTML/arbitrary JSX/runtime imports are not considered “design freedom”。

### G2. Stable content identity, movable routes

Every content has immutable UUIDv4 ContentId。Human-readable slug/route may change; same semantic content retains ContentId and gets redirects as needed。

Media/provenance/update lineage never depends on route string as identity。

### G3. Minimal SEO surface

Normal frontmatter is editorial metadata。Canonical/OG/structured data/sitemap/archive/RSS/search are derived。

Blog hero/social card resolve through Media Registry, not hand-entered file paths。

### G4. Managed taxonomy / discovery

Taxonomy uses stable registry IDs。Archives/pagination/RSS/related are build-time generated。

Full-text search is a static MiniSearch artifact using a repository-owned deterministic Japanese/technical tokenizer; no search server/database required initially。

### G5. Flexible but maintainable content modules

Use semantic Figure/Gallery/Callout/Steps/Comparison/LinkCard/Details/Demo etc。Do not achieve flexibility through article-local arbitrary JSX/CSS/runtime sprawl。

Interactive Tool implementation binds through registry rather than MDX source path。

### G6. Camera-source friendly, reprocessable and recoverable media

HEIC/HEIF first-class author input。Do not force iPhone JPEG capture for Web convenience。

Raw camera/provider originals are job/user inputs, not long-term site media SoT。

Ingest normalizes orientation/sRGB/private metadata/dimensions and produces a privacy-safe lossless canonical source。

After human approval:

1. canonical source persists to private source-media plane
2. deterministic delivery master/AVIF/WebP/fallback variants persist to public delivery plane
3. exact public bytes persist to separate protected recovery plane
4. Git receives provider-neutral source/public/recovery identities

Private canonical source = future re-encode authority。
Protected exact published bytes = current/historical exact recovery authority。

MDX uses semantic `media:` ID, not provider URL。

Cloudflare Images is not correctness-critical。

### G7. AI visual completeness without factual confusion

Blog hero required。Prefer informative real source media, otherwise AI conceptual illustration, otherwise deterministic cover。

AI visual is not technical evidence。Do not fabricate factual-looking UI/terminal/code/benchmark/hardware observation。

### G8. Evidence-bound AI authoring with post-cleanup traceability

Material claim must be traceable to validated source/evidence semantics during Article Job **and after the full private workspace is cleaned**。

Durable Git provenance must preserve public-safe:

```text
published material claim
 -> evidence interpretation/proposition identity
 -> compact source identity
```

A deleted evidence bundle hash alone is not enough。

Citation export uses fixed Source IDs and validated public representation; AI may not invent citation URLs as authority。

Technical examples distinguish illustrative / syntax checked / sandbox executed / evidence observed / not verifiable。

### G9. Maximum practical delivery optimization

Keep static-first simplicity while automatically applying:

- prerendered HTML
- route-local JS
- fingerprinted site assets
- content-addressed public media
- prebuilt responsive modern formats
- immutable cache metadata
- standard edge cache/compression
- measured LCP treatment
- minimal third-party code

Do not add provider-specific Cache/Compression/Images rules without measured/semantic need。

### G10. Durable identity / swappable tooling

Durable identities:

- ContentId
- MDX meaning
- taxonomy IDs
- semantic media asset IDs
- canonical source hash/profile
- public delivery object hashes/profile lineage
- durable material-claim/source lineage
- cleanup-safe protected media recovery binding

Astro component path, React path, provider media domain, MiniSearch implementation, Cloudflare Images are replaceable details。

### G11. Localized interactivity

Tool/Demo only get client runtime as required。Search runtime localized to `/search/`; normal content route does not ship search JS。

### G12. Auditable AI without repository pollution

Full source snapshots, AI requests/responses, raw original/provider image, verification logs, detailed private evidence are operational job artifacts, not permanent Git/public state by default。

Before cleanup, required long-term semantics are compacted into Git:

- approved MDX/frontmatter
- registries
- public-safe SourceRefs
- material-claim evidence bindings
- compact AI/tool lineage
- canonical source identity
- public/protected persistence hashes
- cleanup-safe protected recovery references

Full prompts/private source bodies/private reasoning are not retained merely for convenience。

### G13. Git-driven provider control plane, lifecycle-safe

Target normal operation avoids Dashboard clicks:

- site CI/CD: GitHub Actions
- Worker deploy: Wrangler
- provider config owner: `Xpotato-Server`
- OpenTofu where compatible
- official API adapter for provider gaps
- R2 configuration admin operator-ephemeral/off persistent CP/site CI trust

But target provider design is not current production state until exact cross-repo handoff is accepted。Current lifecycle/status is always read from `architecture/design-status.md` + `architecture/infrastructure-handoff.md`。

Dashboard remains bootstrap/billing/account recovery/break-glass/true no-programmatic-surface exception。

## Quality priority

1. content correctness / publication safety
2. maintainability / authoring simplicity
3. recoverability / durable identity/traceability
4. accessibility / semantic HTML
5. performance / delivery efficiency
6. discovery/search/SEO correctness
7. visual novelty

## Non-goals

- CMS GUI
- site-wide SSR/SPA/React
- SEO plugin-style per-article config
- manual per-article image variant management
- raw camera originals as site media archive
- Git as photo archive
- runtime search database/service initially
- generic remote code execution platform
- autonomous AI publish without exact human approval
- full private Article Job archive as launch requirement
- Cloudflare Dashboard as normal control plane
- Cloudflare Images/custom Rules as initial correctness dependency

## Success criteria

- normal Blog create/update needs no SEO boilerplate
- stable ContentId survives route/title/content updates
- HEIC/HEIF ingest without manual external conversion
- Git size does not scale with photographic/raster media count
- approved canonical source can regenerate future profiles
- raw camera metadata is not permanently accumulated in site infrastructure
- Blog hero never missing under normal publication path
- content-only hydration target 0
- taxonomy/route/media/provenance errors fail before publication
- **after job cleanup, every material Article Job claim remains traceable to durable source/evidence semantics**
- citations cannot invent source authority
- technical example verification class/limitations remain explicit
- human approval precedes all persistent media mutation
- Git export references only persistence/protection chains bound to exact approval
- **after job cleanup, exact published media restore can start from Git Media Registry + durable `mediaRecovery`, without past chat/full job workspace**
- archive/RSS/related/search reproducible from repository content
- Japanese search not dependent on inconsistent runtime dictionary segmentation
- media delivery works without Cloudflare Images
- accepted normal deploy/media/provider reconcile does not require Dashboard clicks
- no proposed provider state is mistaken for current desired state
- design/tool/storage/search changes do not require mass MDX rewrite
- old implementation remains reproducible via legacy Git ref during migration
