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

validationを2層に分ける。

1. **Deterministic PR gate** — credential / provider mutation / remote media downloadを必要とせず、すべてのPRで再現可能に実行する。
2. **External integration gate** — R2 / Cloudflare / production URL / media protection/recovery等、外部stateを確認する。

正常なsite buildをexternal service availabilityへ依存させない。

## Deterministic PR gate

logical order:

```text
npm ci
  -> workspace boundary / lockfile validation
  -> generated schema freshness
  -> unit / contract tests
  -> content / registry validation
  -> type / Astro check
  -> Astro production build
  -> Pagefind Extended index build
  -> static output validation
  -> representative frontend / accessibility / bundle checks
```

exact command nameはroot/workspace `package.json`をmachine SoTとする。

### Network policy

normal deterministic PR gateは:

- live AI providerを呼ばない
- public/protected R2へwriteしない
- Cloudflare APIを呼ばない
- R2 masterをdownloadしない
- external web sourceを再fetchしない

fixture / frozen artifact / generated local test dataを使用する。

## Workspace boundary validation

- `apps/site` -> `article-pipeline`禁止
- `apps/site` -> `example-verifier`禁止
- `apps/site` -> AI provider SDK禁止
- `example-verifier` -> Astro runtime禁止
- `media-ingest` -> Astro runtime禁止
- provider SDKを`content-contracts`へ入れない
- root packageはorchestrationだけ

package graph / import lint / architecture testでenforceする。

## Generated schema validation

`packages/content-contracts`のZod modelをmachine-readable SoTとする。

CI:

1. schema generation
2. generated outputとの差分確認
3. stale generated schemaならfail

## Content identity validation

- every content has lowercase canonical UUID v4 ContentId
- ContentId globally unique
- route/slug unique
- Media Registry / Provenance / Interactive binding ContentId valid
- route rename with same ContentId has redirect mapping

## Frontmatter / taxonomy validation

- collection-specific schema
- date/status/featured rules
- taxonomy ID active/valid
- Project stack -> technology tags only
- alias ambiguity禁止
- retired term new content使用禁止
- unknown term silent create禁止

migration fixtureではcurrent 44 Blog entriesがinitial `software 31 / infrastructure 12 / robotics 1`へexactly once分類されることも検証する。

## MDX validation

- approved content module only
- arbitrary runtime component import禁止
- raw legacy HTMLのnew introduction禁止
- direct site-owned R2 URL / `r2:/`禁止
- `media:<asset-id>` resolve
- Demo module ID resolve
- broken internal link / route ref検出

## Source / evidence / citation tests

- typed SourceLocator
- immutable GitHub source pin
- private locator publication rejection
- SourceRef record-hash binding
- freshness gate
- citation marker resolution
- noneligible source citation rejection
- deterministic footnote compilation
- fabricated Source ID rejection

normal site buildはprivate evidence bundleを必要とせず、published MDX + provenance integrityだけを確認する。

## Technical example verifier validation

- extractor fixture
- syntax/parser adapter fixture
- disposable sandbox
- timeout / output cap
- network default deny
- credential/env filtering
- system/external mutation rejection
- content hash change -> result stale
- observed output requires execution/evidence

arbitrary repository article commandをPR CIで無制限実行しない。

## Article Job contract / state tests

minimum:

- ArticleJobSpec fingerprint
- create/update ContentId semantics
- invalid transition rejection
- semantic response private until import success
- Skill/response schema binding
- evidence/citation/example/audit target hashes
- visual optionality by collection
- Blog missing hero blocked
- human approval cannot be AI response
- approval stale after candidate change
- pre-approval public R2 publication rejection
- media publication idempotence
- `MEDIA_PUBLISHED -> MEDIA_PROTECTED` requires valid protection receipt fixture
- protection failure blocks repository export
- publication/protection object-set mismatch rejection
- repository export requires approval + MediaPublicationManifest + MediaProtectionReceipt

live AI/R2/Cloudflareをunit gateに必要としない。

## Media ingest validation

safe synthetic fixtureで:

- input type probe
- HEIC capability contract where available
- orientation / color profile
- private metadata strip
- output dimension/hash
- no Git write
- no public upload

private real camera photosをCI fixtureへ入れない。

## Git media guard

repository validator:

- `.heic` / `.heif`禁止
- camera photo / screenshot / raster article/project media禁止
- photographic/raster site hero/background禁止
- AI-generated raster禁止
- oversized binary guard
- generated Pagefind/dist/private Article artifacts禁止

allowed candidate:

- small deterministic SVG
- favicon/logo/icon
- tiny design-system texture
- synthetic fixture

size threshold未満を理由にphotographic rasterをGitへ入れるescape hatchにしない。

## Media Registry / rights validation

- per-content registry schema
- asset IDs unique
- object key content-addressed
- expected SHA/size/dimensions
- active/retired refs valid
- Blog hero/social card exactly one
- AI asset provenance + visual audit
- publication rights ref valid / authorized
- no provider account/bucket ID

**deterministic gateではR2 objectをfetchしない。**

## Publication Provenance validation

- published Article Job content has provenance
- MDX/frontmatter hashes match current tree
- candidate/approval/source/evidence/citation/example/audit refs valid
- MediaPublicationManifest hash required
- MediaProtectionReceipt hash required
- publication/protection candidate + approval chain一致
- no private path / credential / prompt/private reasoning
- manual edit drift detected

## Discovery validation

archive/pagination:

- item counts match catalog
- no empty page / duplicate page1
- taxonomy scope valid
- next/prev links resolve

RSS:

- valid feed
- public Blog only
- ContentId-stable GUID
- canonical URLs

related:

- no self/draft/noindex
- deterministic order

Pagefind:

- post-build index success
- draft/noindex excluded
- Japanese/mixed query fixtures
- result URLs exist
- `/search/` noindex
- normal article no Pagefind client JS

## Static output / SEO validation

- canonical/title/description
- OG / structured data
- sitemap public canonical only
- robots/search noindex
- 404
- redirect artifact consistency
- no duplicate route

## Frontend / accessibility / performance

representative route classes:

- Blog content-only
- Notes content-only
- Project
- Tool React island
- Search

checks:

- content-only React hydration 0 target
- Tool runtime route-local
- Pagefind localized to Search
- global JS leakage
- bundle diff
- console smoke
- semantic/a11y automated checks

manual when material UI changes:

- keyboard/focus
- Tool/search behavior
- reduced motion
- zoom/narrow viewport
- heading/landmark semantics

exact performance budgetsはbaseline measurement後machine profileへ固定する。

---

# External Integration Gate

## R2 published object verification

changed/selected registry object:

- public object reachable
- size/content type expected
- content-addressed key valid
- bounded exact hash verification where configured
- immutable/cache requirement
- representative transform response

全buildで全media bytesをdownloadしない。

## Published media protection validation

Article Job export/release candidateについて:

- MediaProtectionReceipt exists
- receipt candidate/approval/publication manifest hashes一致
- protected object set equals published object set
- protection class/policy fingerprint accepted
- protection freshness satisfies infra policy

site repoへprotected bucket/resource IDをduplicateしない。

## Recovery validation

scheduled / migration / DR drillで:

- representative protected objectをprivate stagingへrestore
- expected SHA/size一致
- public object欠損を仮定したrepublication procedure成立
- expected credential boundaryでprotected delete/overwriteが拒否されることをinfra側で確認

routine Article Jobごとのfull restoreは不要。

## Cloudflare delivery validation

- canonical domain status
- representative routes
- 404
- redirect behavior
- R2 custom-domain media
- cache/compression/security headers
- CSP violations
- sitemap/RSS/search assets

## Redirect external validation

- site-owned path redirects
- infrastructure-owned WordPress query/domain redirects

legacy inventory required redirectがunverifiedならcutover blocker。

## Production smoke

- home
- Blog article + media
- Tool interactive route
- Search query
- RSS
- 404
- representative legacy redirect

## Validation ownership

反復可能なinvariantはAGENTS/Skillだけでなくvalidator/schema/CIへ昇格する。

external/provider exact stateはsite buildのSoTと混同しない。
