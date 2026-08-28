---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - validation strategy
  - deterministic PR gates
  - external integration validation
---

# Validation

## Principle

Validation layers:

1. **Design/governance validation** — lifecycle/ADR/SoT/cross-repo binding。
2. **Deterministic repository gate** — no live provider credentials/media downloads required。
3. **External integration gate** — provider/media/recovery/production state when lifecycle permits。

Normal site build does not depend on live AI/R2/Cloudflare availability。

---

# Design / governance validation

Before Design Freeze phase-gate:

- `architecture/design-status.md` identifies current lifecycle
- `governance/audit.md` / `governance/severity.md` reachable from `docs/README.md`
- P0/P1/P2 semantics unambiguous
- material cross-repo dependency uses exact SHA-pinned `architecture/infrastructure-handoff.md`
- mutable branch name is navigation only
- counterpart status matches handoff
- Proposed infra values are not active production desired state
- ADR lifecycle terms are correct (`proposed`/`accepted`/`rejected`/`superseded`)
- ADR numbers/identities are unique
- material decisions have ADRs, including:
  - stable ContentId
  - ephemeral Article Job + durable compact lineage
  - clean-room lifecycle
  - external-AI input disclosure admission
  - portable controlled content-authoring model

Validation/audit code never auto-promotes Design/ADR status。

---

# Deterministic repository gate

Logical target:

```text
npm ci
 -> workspace/lock/toolchain validation
 -> generated schema freshness
 -> unit/contract tests
 -> content/registry/provenance validation
 -> type/Astro check
 -> Astro build
 -> SearchDocument + MiniSearch index build
 -> static output/search validation
 -> frontend/a11y/bundle checks
```

Exact commands become root/workspace package machine SoT during implementation。

## Phase 1A legacy migration preparation

Normal vNext CI includes the lightweight frozen-legacy gate:

```text
npm run migration:legacy:check
```

It verifies the annotated tag object/peeled commit, compact baseline schema, deterministic Git-object inventory digest, design-time deltas, and cross-record invariants。It does not run a nested legacy dependency install/build。

Explicit operational commands:

```text
npm run migration:legacy:inventory
npm run migration:legacy:inventory:check
npm run migration:legacy:reproduce
```

The full reproduction uses two separate isolated detached worktrees, exact legacy lockfile, pinned reported Node/npm versions, and two clean dist manifests。Generated inventory/build evidence stays under `.local/migration/` and is not Git SoT。These checks do not create tags automatically and do not open deletion, cutover, deploy, or provider gates。

The frozen legacy source currently has an observed cross-checkout ordering nondeterminism for equal-date/equal-score content。Therefore the committed Phase 1A baseline records `legacyBuild.status = FAIL`, and `npm run migration:legacy:reproduce` intentionally fails after preserving exact manifests and differing paths。A successful process exit must not be obtained by excluding or rewriting the changed HTML or by modifying the frozen legacy source。

## Network / side-effect policy

Normal deterministic gate:

- no live AI calls
- no R2 writes
- no Cloudflare mutation
- no remote media download
- no external web refetch
- no production credential requirement

Use synthetic/frozen fixtures。

## Workspace boundary

- `apps/site` -> `article-pipeline` prohibited
- `apps/site` -> `example-verifier` prohibited
- `apps/site` -> AI provider SDK prohibited
- `content-contracts` provider-neutral
- `example-verifier` / `media-ingest` do not depend on Astro runtime
- root package orchestrates only

## CI/CD definition

When implementation gate opens:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-site.yml`
- pinned/controlled Node + `npm ci`
- deterministic validation/build before Wrangler
- scoped secret references only
- no Workers Builds/Pages dashboard deploy authority
- Wrangler config does not duplicate infra-owned hostname/DNS/R2 rules

## Content identity / routes

- every ContentId is lowercase canonical UUIDv4
- global uniqueness
- route uniqueness
- registry/provenance/interactive refs resolve same ContentId
- same-content route rename retains ContentId + redirect
- no silent ContentId regeneration

## Portable content authoring / taxonomy / modules

ADR-0027 invariants:

- durable prose source is Markdown/MDX
- normal frontmatter contains editorial/stable facts, not provider/runtime/search/SEO duplication
- taxonomy uses version-controlled stable IDs
- unknown term does not silently create archive/route
- aliases unambiguous; retired term not newly authored
- approved semantic content modules only
- arbitrary runtime/component import not normal article API
- Tool/Demo references Interactive Module Registry ID, not React path/hydration directive
- `media:<asset-id>` resolves through Media Registry
- no direct site-owned provider media URL / object key / `r2:/`
- generated archive/RSS/related/search/SEO state is not hand-maintained in article source

Migration fixture must map frozen legacy content/taxonomy/runtime fields explicitly into this model rather than silently preserve implementation-coupled fields。

## Source / evidence / claim / citation

Detailed job artifacts:

- SourceLocator typed
- GitHub source commit-pinned
- SourceRef record-hash binding
- EvidenceRecord source refs valid
- freshness gate for current claims
- ArticleClaimRecord evidence policy valid
- fabricated source/evidence ID rejected
- citation marker resolution/eligibility
- deterministic public footnote compilation

### Cleanup-safe durable claim lineage

For Article Job publication:

- every material published claim has a `CompactMaterialClaimBinding`
- statement SHA/locator matches current MDX
- claim type valid
- evidence summaries are public-safe and hashed
- every evidence `sourceId` resolves exactly one durable CompactSourceRef
- source record identity/hash present
- no raw private source body/absolute path/credential in durable summaries
- transition/non-material prose may be omitted
- material content/support change marks provenance stale

Evidence bundle hash alone is not sufficient after full workspace cleanup。

## External AI disclosure admission

Exact contract=`contracts/external-ai-disclosure-contract.md` / ADR-0026。

### Contract fixtures

Must prove:

- `externalTextAI=true` / `externalImageAI=true` does not admit any artifact by itself
- `publicSafe=true` does not imply disclosure
- citation eligibility does not imply disclosure
- source trust/public URL does not imply disclosure
- private/unknown input defaults deny
- explicit authorization is bound to exact materialized input identity/hash
- changed source/artifact hash makes prior disclosure record stale
- `allow_derived_only` request contains admitted derived bytes and excludes raw source bytes
- actual secret-bearing credential/password/private key/session cookie/Authorization/MFA/recovery/signed capability material is hard-deny
- broad user/job permission cannot override hard-deny secret class
- final serialized external request secret/private scan runs before transport

### Request exact-set fixtures

For every external text/vision/image request:

- `ExternalAiDisclosureManifest` required
- manifest policy ID/hash current
- each actual outbound artifact resolves exact disclosure record
- exact/derived mode valid
- manifest entry set = actual provider input artifact set
- provider adapter cannot append hidden file/context after manifest compilation
- request/run lineage contains same manifest SHA
- transport retry retains same request/input/manifest; changed input requires new admission

### Denied evidence semantics

Required denied source cannot be silently omitted while article/stage is marked complete。

Fixture paths:

- admitted safe derivative succeeds
- local/non-external backend succeeds when configured
- authorization-required returns explicit blocker
- claim narrowing/removal records limitation
- unresolved required evidence -> `BLOCKED`

### Vision/image fixtures

- raw private photo/screenshot not sent merely because `externalImageAI=true`
- external visual audit target image/article context each appear in manifest
- image-generation prompt derived from private input is itself an admitted request artifact

### Durable disclosure lineage

When external provider used, Publication Provenance contains only safe required lineage such as:

- disclosure policy ID/hash
- request disclosure manifest hash
- exact/derived mode summary where allowed

and excludes raw private source body/path/full private disclosure inventory/secret-bearing authorization details。

## Technical example verifier

- extractor fixtures
- parser/typecheck adapters
- disposable sandbox
- exact profile limits
- network default deny
- credential/env filtering
- mutation classifiers
- timeout/output/resource bounds
- content hash change -> stale result
- observed output requires execution/evidence

Initial profiles=`operations/technical-example-profiles.md`。Arbitrary article commands are never bulk executed by CI。

## Article Job state / approval

- ArticleJobSpec fingerprint includes disclosure policy/explicit authorization semantics
- create/update ContentId semantics
- invalid transitions rejected
- AI response private until deterministic import
- Skill/schema/artifact hash bindings
- Blog visual requirement / other collection optionality
- semantic visual audit before variants
- media profile/source change invalidates candidate/approval
- human approval cannot be AI output
- persistent source/public/protected storage before approval rejected

Canonical persistence chain:

```text
HUMAN_APPROVED
 -> MEDIA_SOURCE_STORED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

Tests:

- source storage failure => remain HUMAN_APPROVED/BLOCKED
- public publication is legal only from MEDIA_SOURCE_STORED
- public publication failure => remain MEDIA_SOURCE_STORED/BLOCKED
- protection failure => remain MEDIA_PUBLISHED/BLOCKED
- same candidate/approval required across receipt chain
- post-approval operational lineage may be added only without changing approved content/media/support
- required content/media/support mutation => approval stale
- EXPORTED requires cleanup-safe claim/recovery + safe external-run disclosure lineage

## Media ingest / variants

Media ingest:

- HEIC capability fixture where available
- orientation/sRGB8
- GPS/private metadata strip
- canonical lossless WebP
- max long edge 8192 / no upscale
- no Git/public mutation

Variant generation:

- canonical source SHA/profile binding
- widths exact/ascending/unique per profile
- no upscale
- AVIF/WebP/fallback completeness
- screenshot lossless policy
- SHA/size/content-type/dimensions recorded
- deterministic toolchain/profile identity
- files outside Git
- no Cloudflare Images call required

## Git media guard

Reject normal additions of:

- `.heic/.heif`
- photo/screenshot/raster content/project/site hero
- AI raster
- generated variants/canonical masters
- generated search index/dist/private Article Job artifacts

Allow candidates only for small deterministic SVG/logo/favicon/icon/tiny texture/synthetic fixture。File size is not a raster-content escape hatch。

## Media Registry / rights / canonical source

- asset IDs unique per ContentId
- public keys content-addressed
- SHA/size/dimensions/profile valid
- required fallback set present
- Blog exact hero/social card rules
- rightsRef authorized/non-unknown
- AI visual has audit lineage
- screenshot rights explicitly bounded
- no provider account/bucket/domain ID in content registry
- CanonicalSourceRecord has provider-neutral SHA/profile/storage-class identity only

## Publication Provenance

Article Job provenance requires:

- MDX/frontmatter/current route hashes
- candidate/approval hashes
- source/evidence/citation/example/audit lineage hashes
- durable CompactSourceRefs
- cleanup-safe CompactMaterialClaimBindings
- safe external-AI policy/manifest/run hash lineage for external calls
- CanonicalSourceStorageReceipt set hash + compact canonical source refs
- MediaPublicationManifest hash
- MediaProtectionReceipt hash
- cleanup-safe CompactMediaRecoveryBinding when published media exists
- compact AI/tool lineage
- no prompt/private reasoning/secret/provider credential

### Media recovery binding validation

`mediaRecovery` must:

- record protection class/policy fingerprint/full receipt SHA
- contain exactly current required public object set
- each object SHA/key/size match MediaPublicationManifest
- each object correspond to full MediaProtectionReceipt
- contain secret-free opaque `protectedObjectRef`
- not require job workspace for normal restore initiation

Receipt hash only is not cleanup-safe recovery state。

## Cleanup eligibility

`site article cleanup` rejects unless:

- state EXPORTED
- exact exported bytes/provenance exist at operator-selected durable Git ref
- material claim bindings valid
- external AI runs have safe required disclosure/run hash lineage
- canonical source receipt chain valid
- publication/protection chain valid
- mediaRecovery matches full receipt when media exists
- no unresolved orphan/external side-effect/security-incident tracking need
- explicit confirm

Cleanup:

- exact job workspace only
- never Git/R2 deletion
- no path escape

Full private source/evidence/disclosure/AI/receipt artifacts may be removed only after their required durable semantics/hashes are already present and validated。

## Discovery / MiniSearch

Archives/pagination:

- counts/canonical page1/links
- Blog/Notes 12/page

RSS:

- public Blog only
- stable ContentId GUID
- max20 summary

Related:

- deterministic
- no self/draft/noindex
- max4
- weights sameCollection1 / primaryTaxonomy2 / technology4 / topic2 / min4

Search:

- MiniSearch 7.2.0 pinned during implementation
- tokenizer ID `xpotato-ja-tech-bigram-v1`
- build/browser exact tokenizer source/hash shared
- serialized index generated, Git ignored
- no draft/noindex
- `/search/` noindex
- search JS only search route
- Japanese compound/katakana/mixed technical/C++/C#/GPT-5.6 fixtures
- no fuzzy/unrelated zero-result fallback initially
- regression fixture for Pagefind-class `新幹線` mismatch

ADR-0016 is Rejected; ADR-0021 is the Proposed replacement until explicit freeze acceptance。

## Static output / frontend / accessibility

- canonical/title/description/OG/JSON-LD/sitemap/robots/404
- redirects consistent
- content-only React hydration 0 target
- Tool runtime route-local
- MiniSearch runtime route-local
- global JS leakage/bundle diff/console smoke
- semantic/a11y automated checks

Manual material UI checks:

- keyboard/focus
- search IME/status behavior
- Tool controls
- reduced motion
- zoom/reflow
- landmarks/headings

Exact byte performance budgets remain measurement-driven open decisions。

---

# External integration gate

External mutation/checks run only when lifecycle gate and authorization permit。

## Cross-repo provider binding

Before any vNext provider activation:

- site `infrastructure-handoff.md` exact SHA/status matches intended infra revision
- infra revision marks website sub-gate accepted/open for mutation as applicable
- proposed values promoted to accepted machine desired state only after infra decision acceptance
- no mutable branch head used as deployment authority

Current pre-freeze proposal is provider-mutation blocked。

## Private canonical source validation

When provider resources are accepted/activated:

- source plane private/no public route
- exact canonical source upload/retrieve SHA
- normal writer no delete/config admin
- representative same-profile reprocessing works

## Public delivery validation

- required master/variants reachable
- expected SHA/size/type/dimensions
- immutable key/cache metadata
- fallback valid
- bounded checks; do not download every object every build

## Protected media validation

- full MediaProtectionReceipt candidate/approval/publication chain
- exact object-set equality
- accepted protection class/policy
- protected plane private + required lock state
- public publisher/protection writer privilege separation

## Recovery drill

Use durable Git `mediaRecovery` binding as normal entrypoint:

1. resolve protectedObjectRef through infra adapter
2. restore representative master/variant
3. SHA/size verify
4. simulate public loss/republication
5. site smoke

The drill must not require old Article Job workspace/chat history。

## Cloudflare/control-plane drift

After acceptance:

- Worker domain -> expected service
- DNS
- source/public/protected resource states
- public custom domain/cache metadata
- protected lock policy
- provider redirects
- custom Cache/Compression/CORS only if explicitly adopted
- no unexplained Dashboard/manual drift
- R2 configuration admin not persistent on CP/site CI

## Production smoke

- home
- Blog + responsive media
- Tool island
- Japanese/mixed search
- RSS
- 404
- representative legacy redirect

## Ownership

Repeated invariant -> schema/validator/CI。

Provider/account exact state -> infra SoT/external validation, never normal site build SoT。
