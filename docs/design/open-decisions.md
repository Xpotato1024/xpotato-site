---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# vNext Open Decisions

この文書はcurrent specificationのSoTではない。Design Freeze時点で合理的に固定できない**実測/provider-implementation detail**だけを残す。

Open itemは存在するだけでphase blockerではない。Current phaseでcorrectness/security/recoverabilityを一意に設計できない場合だけP1。

## O1. Performance budgets

未決:

- route-class JS/CSS hard byte budget
- MiniSearch serialized index / search-route JS transfer budget
- representative LCP image transfer target
- lab thresholds beyond Core Web Vitals

vNext foundation build + mobile/profile measurementで確定する。

**Build実測なしに任意KiB値をarchitectureへ捏造しない。**

## O2. Visual style profile

未決:

- palette / texture
- generated hero illustration style
- hero composition/safe area
- social card visual design
- home/card visual hierarchy

Architectureはstyle profile versioning / synthetic-media truth boundaryまで固定済み。Visual redesign phaseでcandidate比較後に決める。

## O3. Comparison module child API

Before/after image、code diff、table comparison等のrepresentative fixtureを見てv1 child/props APIを固定する。

Premature generic layout builderを避ける。

## O4. Exact legacy archive ref naming

Mechanism fixed:

- annotated Git tag required
- optional legacy branch only if real hotfix need exists

Exact tag string is chosen at cutover from actual legacy generation/revision。

## O5. Cloudflare implementation pin / cutover details

Target architecture is defined, but **current infra counterpart remains Proposed and provider mutation BLOCKED**。Exact status/revision is only `architecture/infrastructure-handoff.md`。

未決:

- GitHub Actions exact trigger/environment approval
- Wrangler exact pinned version/command
- Cloudflare provider/API adapter exact versions
- site deploy / infra read-plan / normal mutation permission sets
- source/public/protected media data-plane credential exact mechanism
- temporary credential delegation採否
- existing Workers Builds/Pages/manual Dashboard stateのretire/import/cutover
- provider resource read-back selectors
- acceptance時にpromoteするexact R2/Worker/domain resource values

These are fixed only after infra ADR-0024 acceptance using then-current official provider schema。Dashboard click sequence is not an open decision。

## O6. Public/protected/source media garbage collection

Launch default:

- normal Article Job does not delete published/source/protected objects
- private canonical source automatic expirationなし
- protected exact media indefinite protection target / no automatic expiration
- no automatic published-object GC

未決:

- never-exported public/source orphan grace period
- retired public/source object GC condition
- retained Git refs/tags/releasesをGC protectionへ含めるalgorithm
- future protected storage lock/retention migration

Actual storage growth must justify a separate privileged GC ADR. Recoverability wins over early reclamation initially。

## O7. Interactive module bundle budget classes

`small | medium | large` exact thresholds are measurement-dependent。

PrimeFactorizer vNext island actual bundle measurement後にmachine performance profileへ固定する。

---

# Resolved during design

## Lifecycle / clean-room audit governance

- `architecture/design-status.md`
- `governance/audit.md`
- `governance/severity.md`
- ADR-0025

Design is `PRE_FREEZE_REVIEW`; implementation/provider activation remain blocked until fresh clean-room P0=0/P1=0 + explicit operator acceptance。

## Cross-repository provider binding

`architecture/infrastructure-handoff.md` pins exact `Xpotato-Server` proposal revision。Mutable branch head is navigation only。

## Media processing profiles

`operations/media-processing-profiles.md`:

- canonical raster lossless WebP / sRGB8 / max 8192
- photo inline 480/768/1200/1800, max delivery 2560
- hero 640/960/1440/1920/2560
- gallery 320/640/960/1280
- screenshot lossless WebP + PNG
- social card 1200x630 PNG
- no upscale

## Private canonical media source

ADR-0022 + `private-canonical-media-storage-contract.md`:

- raw camera/provider originals are not site long-term SoT
- approved privacy-normalized canonical master is future re-encode source
- provider resource remains infra-proposal dependent until accepted

## Article Job retention / durable lineage

ADR-0024 + `article-job-retention-policy.md` + `publication-provenance-contract.md`:

- full workspace ephemeral; no automatic time-only deletion
- cleanup only after exact durable Git ref and persistence chains validate
- durable Git provenance keeps public-safe material claim -> evidence/source bindings
- durable Git provenance keeps cleanup-safe protected media recovery binding
- receipt/bundle hashes alone are not sufficient when underlying job artifacts are deleted
- raw private source/prompts/reasoning/logs are not long-term Git/public state

## Initial Article Job AI profile/resource budget

`operations/ai-execution-profiles.md`:

- bounded Terra/Sol stage mappings
- GPT-Image-2 image profile
- semantic invocations max15
- search tool calls max10
- image attempts max2
- revision cycles max2
- one transient retry
- text 240s / image 360s

## Technical example verifier

`operations/technical-example-profiles.md`:

- network none / non-root / read-only rootfs
- memory256 MiB / PID32 / CPU1 / wall15s / workspace64 MiB / output1 MiB
- execute: Python stdlib / self-contained Node / disposable SQLite
- parse/type-check mainly: Bash / PowerShell / TypeScript / JSON/YAML/Compose
- system/cloud/package-manager/Docker workload/Git remote mutation automatic execution外

## Discovery/search profile

- Blog/Notes 12/page
- RSS 20 summary
- related max4
- related weights 1/2/4/2, minimum4
- MiniSearch 7.2.0
- shared tokenizer `xpotato-ja-tech-bigram-v1`
- fuzzy initially off
- `/search/` route-local runtime only

ADR-0016 Pagefind proposal is **Rejected**; ADR-0021 MiniSearch is Proposed until freeze acceptance。

## Stable ContentId

ADR-0023:

- lowercase canonical UUIDv4
- immutable internal identity
- mutable human route/slug

## Initial taxonomy seeds

- Blog: software31 / infrastructure12 / robotics1
- Notes subject: infrastructure
- Tool category: calculation

## Media placement

Photographic/raster content/project/site hero/screenshot/AI/gallery -> object-storage first。

Small deterministic SVG/logo/favicon/icon/tiny texture/fixture -> Git candidate。

## Cloudflare control plane target

ADR-0019 + exact infra handoff:

- GitHub Actions + Wrangler site deploy target
- Git-driven infra desired state / OpenTofu or official API adapter
- R2 configuration admin operator-ephemeral/off persistent CP/site CI trust
- Dashboard bootstrap/billing/recovery/break-glass only
- no initial requirement for custom Cache/Compression/CORS/Cloudflare Images

Provider values are not active current desired state while infra ADR-0024 remains Proposed。

## Published exact media recovery

ADR-0018/0020 + protection/recovery/provenance contracts:

- separate protected exact-byte plane target
- durable CompactMediaRecoveryBinding in Git before cleanup
- exact restore begins from Git revision without requiring old Article Job workspace

## Compatibility redirects

- `/blog/prime-factorizer/`
- `/blog/category/tools/`

will become real application 301 redirects in accepted migration design。
