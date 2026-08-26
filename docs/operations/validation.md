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

1. **Design/governance validation** — lifecycle/ADR/SoT/cross-repo binding.
2. **Deterministic repository gate** — no live provider credentials/media downloads required.
3. **External integration gate** — provider/media/recovery/production state when lifecycle permits。

Normal site build does not depend on live AI/R2/Cloudflare availability。

---

# Design / governance validation

Before Design Freeze phase-gate:

- `architecture/design-status.md` exists and identifies current lifecycle
- `governance/audit.md` / `governance/severity.md` reachable from `docs/README.md`
- P0/P1/P2 semantics unambiguous
- every material cross-repo dependency uses `architecture/infrastructure-handoff.md`
- handoff has repository + exact commit SHA + relevant ADR/status
- mutable branch name is navigation only
- counterpart exact revision is readable and status matches handoff
- Proposed infra decision is not silently represented as active production desired state
- adopted/rejected/superseded ADR lifecycle is consistent
- no missing material ADR for identity/trust/recovery/lifecycle decisions

Clean-room audit procedure itself follows `governance/audit.md`; validation code must not silently promote Design/ADR status。

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
- scoped secret reference only
- no Workers Builds/Pages dashboard deploy authority
- Wrangler config does not duplicate infra-owned hostname/DNS/R2 rules

## Content identity / routes

- every content ID is lowercase canonical UUIDv4
- global uniqueness
- route uniqueness
- registry/provenance/interactive refs resolve same ContentId
- same-content route rename retains ContentId and has redirect
- no silent ContentId regeneration

## Frontmatter / taxonomy

- collection schema
- dates/status/featured semantics
- taxonomy ID active/valid
- aliases unambiguous
- retired term not newly authored
- unknown term not silent-created
- frozen migration fixture maps legacy content exactly once

## MDX / modules

- only approved modules
- no arbitrary runtime component imports
- no new raw legacy HTML path
- no direct site-owned provider media URL / `r2:/`
- `media:<asset-id>` resolves
- Demo/Interactive module IDs resolve
- internal links/routes resolve

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

- every **material** published claim has a `CompactMaterialClaimBinding`
- statement SHA/locator matches current MDX
- claim type valid
- evidence summaries are public-safe and have hashes
- every evidence `sourceId` resolves exactly one durable CompactSourceRef
- source record hash/identity present
- no raw private source body/absolute path/credential in durable summaries
- transition/non-material prose may be omitted
- material content/support change marks provenance stale

**Evidence bundle hash alone is not sufficient after full workspace cleanup.**

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

Initial profiles are `operations/technical-example-profiles.md`; arbitrary article commands are never bulk executed by CI。

## Article Job state / approval

- ArticleJobSpec fingerprint
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

- source storage failure blocks public publish
- public publish failure blocks protection/export
- protection failure blocks export
- same candidate/approval required across receipt chain
- post-approval operational lineage may be added only without changing approved content/media/support
- any required content/media/support mutation => approval stale

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
- files stay outside Git
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
- CanonicalSourceRecord has only provider-neutral SHA/profile/storage-class identity

## Publication Provenance

Article Job provenance requires:

- MDX/frontmatter/current route hashes
- candidate/approval hashes
- source/evidence/citation/example/audit lineage hashes
- durable CompactSourceRefs
- cleanup-safe CompactMaterialClaimBindings
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

Receipt **hash only** is not cleanup-safe recovery state。

## Cleanup eligibility

`site article cleanup` tests must reject unless:

- state EXPORTED
- exact exported bytes/provenance exist at operator-selected durable Git ref
- material claim bindings valid
- canonical source receipt chain valid
- publication/protection chain valid
- mediaRecovery matches full receipt when media exists
- no unresolved orphan/external side-effect tracking need
- explicit confirm

Cleanup:

- only exact job workspace
- never Git/R2 deletion
- no path escape

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
- infra revision itself marks website sub-gate accepted/open for mutation as applicable
- proposed values have been promoted to accepted machine desired state only after infra decision acceptance
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
- normal checks bounded; do not download every object every build

## Protected media validation

- full MediaProtectionReceipt candidate/approval/publication chain
- exact object-set equality
- accepted protection class/policy
- protected plane private + required lock state
- public publisher/protection writer privilege separation

## Recovery drill

Use **durable Git `mediaRecovery` binding as normal entrypoint**:

1. resolve protectedObjectRef through infra adapter
2. restore representative master/variant
3. SHA/size verify
4. simulate public loss/republication
5. site smoke

The drill must not require old Article Job workspace or chat history。

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
