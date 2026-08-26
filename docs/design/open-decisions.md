---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# vNext Open Decisions

This document is not current specification SoT。Only implementation-measurement/provider details that are unsafe or irrational to guess before implementation remain open。

An open item is not automatically a phase blocker。It becomes blocking only when current correctness/security/recoverability cannot be implemented/reviewed unambiguously without the value。

## O1. Performance budgets

Open:

- route-class JS/CSS hard byte budgets
- MiniSearch serialized index/search-route transfer budget
- representative LCP image transfer target
- lab thresholds beyond Core Web Vitals

Fix after foundation build/device/profile measurement。Do not invent arbitrary KiB limits before measurement。

## O2. Visual style profile

Open:

- palette/texture
- generated hero illustration style
- hero composition/safe area
- social-card visual design
- home/card visual hierarchy

Architecture already fixes style profile versioning/synthetic-media truth boundary。Choose by candidate comparison during visual redesign。

## O3. Comparison module child API

Use before/after image, code diff, and table comparison fixtures to fix v1 child/props API。Avoid premature generic layout builder。

## O4. Exact legacy archive ref naming

Mechanism fixed:

- annotated Git tag required
- optional legacy branch only if a real hotfix need exists

Exact tag string is chosen from actual cutover revision。

## O5. Cloudflare implementation pin / cutover details

Target architecture is defined, but current infra counterpart remains Proposed/provider mutation BLOCKED。Exact status=`architecture/infrastructure-handoff.md`。

Open implementation details:

- GitHub Actions exact trigger/environment approval
- Wrangler exact pinned version/command
- Cloudflare provider/API adapter exact versions
- site deploy / infra read-plan / normal mutation exact permission sets
- source/public/protected media data-plane credential mechanism
- temporary credential delegation choice
- existing Workers Builds/Pages/manual Dashboard state retire/import/cutover
- provider resource read-back selectors
- exact R2/Worker/domain values promoted at infra ADR acceptance

Fix using then-current official provider schema after infra ADR acceptance。Dashboard click sequence is not an open decision。

## O6. Public/protected/source media garbage collection

Launch default fixed:

- normal Article Job does not delete source/public/protected objects
- private canonical source has no automatic expiration initially
- protected exact media uses indefinite-protection target / no automatic expiration
- no automatic published-object GC

Future open:

- never-exported public/source orphan grace period
- retired public/source object GC condition
- retained Git refs/tags/releases protection algorithm
- future protected lock/retention migration

Actual storage growth must justify a separate privileged GC ADR。

## O7. Interactive module bundle budget classes

Exact `small | medium | large` thresholds depend on actual PrimeFactorizer vNext bundle measurement。Fix in machine performance profile after implementation。

---

# Resolved during design

## Lifecycle / clean-room audit governance

- `architecture/design-status.md`
- `governance/audit.md`
- `governance/severity.md`
- ADR-0025

Design remains `PRE_FREEZE_REVIEW`; implementation/provider activation stays blocked until acceptable fresh clean-room audit + explicit operator acceptance。

## Cross-repository provider binding

`architecture/infrastructure-handoff.md` pins exact `Xpotato-Server` proposal revision。Mutable branch head is navigation only。

## Portable durable content-authoring model

ADR-0027 + content/taxonomy/module/interactive contracts:

- portable Markdown/MDX first
- stable managed taxonomy registry IDs
- approved semantic modules
- Interactive Module Registry for runtime binding
- no normal provider/runtime/search/SEO implementation path in article source
- legacy implementation-coupled fields require deliberate migration

Exact seed/module props remain contract/profile details rather than ADR facts。

## External AI input disclosure admission

ADR-0026 + `contracts/external-ai-disclosure-contract.md` + `operations/external-ai-disclosure-profile.md`:

- provider-use permission != input disclosure
- initial policy `article-external-ai-disclosure-v1`
- public anonymous Web/public GitHub pinned source may be admitted under explicit class rules
- ArticleJobBrief/user/private/raw image default deny until exact/derived authorization
- secret/capability-bearing actual material hard-deny
- derived-only raw-byte exclusion
- exact request manifest = actual outbound provider input set
- denied required evidence cannot be silently omitted
- safe policy/manifest/run hashes remain durable while full private disclosure inventory may be cleaned

Provider/model change does not silently alter this disclosure profile。

## Media processing profiles

`operations/media-processing-profiles.md`:

- canonical raster lossless WebP / sRGB8 / max8192
- photo inline 480/768/1200/1800, max delivery2560
- hero 640/960/1440/1920/2560
- gallery 320/640/960/1280
- screenshot lossless WebP + PNG
- social card 1200x630 PNG
- no upscale

## Private canonical media source

ADR-0022 + source-storage contract:

- raw camera/provider original is not site long-term SoT
- approved privacy-normalized canonical master is future re-encode source
- actual provider resource remains infra-proposal dependent until accepted

## Article Job retention / durable lineage

ADR-0024 + retention/provenance contracts:

- full workspace ephemeral; no automatic time-only deletion
- cleanup only after exact durable Git ref and required lineage/persistence validation
- durable material claim -> evidence/source bindings
- safe external AI policy/manifest/run hash lineage
- cleanup-safe protected media recovery binding
- receipt/bundle hash alone is not enough when required semantics would otherwise disappear
- raw private source/prompts/reasoning/logs/full disclosure inventory are not long-term Git/public state

## Initial Article Job AI provider/resource profile

`operations/ai-execution-profiles.md`:

- bounded Terra/Sol semantic stage mapping
- GPT-Image-2 image profile
- semantic invocations max15
- search tool calls max10
- image attempts max2
- revision cycles max2
- one transient retry
- text240s / image360s

Provider-use profile is independent from the external-input disclosure profile。

## Technical example verifier

`operations/technical-example-profiles.md`:

- network none/non-root/read-only rootfs
- memory256MiB / PID32 / CPU1 / wall15s / workspace64MiB / output1MiB
- execute Python stdlib/self-contained Node/disposable SQLite
- parse/type-check mainly Bash/PowerShell/TypeScript/JSON/YAML/Compose
- system/cloud/package-manager/Docker workload/Git remote mutation automatic execution excluded

## Discovery/search profile

- Blog/Notes12/page
- RSS20 summary
- related max4
- related weights1/2/4/2, minimum4
- MiniSearch7.2.0
- shared tokenizer `xpotato-ja-tech-bigram-v1`
- fuzzy initially off
- `/search/` route-local runtime only

ADR-0016 Pagefind is **Rejected**; ADR-0021 MiniSearch remains Proposed until freeze acceptance。

## Stable ContentId

ADR-0023:

- lowercase canonical UUIDv4
- immutable internal identity
- mutable route/slug

## Initial taxonomy seeds

- Blog software31 / infrastructure12 / robotics1
- Notes subject infrastructure
- Tool category calculation

## Media placement

Photo/screenshot/raster content/project/site hero/AI/gallery -> object-storage first。

Small deterministic SVG/logo/favicon/icon/tiny texture/fixture -> Git candidate。

## Cloudflare control-plane target

ADR-0019 + exact infra handoff:

- GitHub Actions + Wrangler site deploy target
- Git-driven infra desired state / OpenTofu or official API adapter
- R2 config admin operator-ephemeral/off persistent CP/site CI trust
- Dashboard bootstrap/billing/recovery/break-glass only
- no initial requirement for custom Cache/Compression/CORS/Cloudflare Images

Provider exact values are not active desired state while infra ADR-0024 remains Proposed。

## Published exact media recovery

ADR-0018/0020 + protection/recovery/provenance:

- separate protected exact-byte plane target
- durable CompactMediaRecoveryBinding before cleanup
- exact restore starts from Git revision without old Article Job workspace

## Compatibility redirects

- `/blog/prime-factorizer/`
- `/blog/category/tools/`

will become real application 301 redirects in accepted migration design。
