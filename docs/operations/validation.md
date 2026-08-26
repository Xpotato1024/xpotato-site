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
2. **External integration gate** — R2 / Cloudflare / production URL / recovery protection等、外部stateを確認する。

正常なsite buildをexternal service availabilityへ依存させない。

## Deterministic PR gate

implementation後、root machine-readable scriptsから少なくとも次を実行する。

logical order:

```text
npm ci
  -> workspace boundary / lockfile validation
  -> generated schema freshness check
  -> unit / contract tests
  -> content / registry validation
  -> type / Astro check
  -> Astro production build
  -> Pagefind Extended index build
  -> static output validation
  -> representative frontend / accessibility / bundle checks
```

exact command nameはroot/workspace `package.json`をSoTとし、この文書へduplicated shell command listを固定しない。

### Network policy

normal deterministic PR gateは:

- live AI providerを呼ばない
- public R2へwriteしない
- Cloudflare APIを呼ばない
- R2 masterをdownloadしない
- external web sourceを再fetchしない

fixture / frozen artifact / generated local test dataを使用する。

package install自体のregistry accessはCI setup concernであり、test behaviorのexternal dependencyとは区別する。

## Workspace boundary validation

`repository-layout-vnext.md`のdependency directionを機械検査する。

minimum:

- `apps/site` -> `article-pipeline`禁止
- `apps/site` -> `example-verifier`禁止
- `apps/site` -> AI provider SDK禁止
- `example-verifier` -> Astro runtime禁止
- `media-ingest` -> Astro runtime禁止
- provider SDKを`content-contracts`へ入れない
- root packageはorchestrationだけ

package graph / import lint / architecture testのいずれかでenforceする。

## Generated schema validation

`packages/content-contracts`のZod modelをmachine-readable SoTとする。

AI exchange等のJSON Schemaはgenerated artifact。

CI:

1. schema generation
2. working tree/generated outputとの差分確認
3. stale generated schemaがあればfail

hand-written duplicate JSON Schemaを正本にしない。

## Content identity validation

- every content has lowercase canonical UUID v4 ContentId
- ContentId globally unique across collections
- route/slug unique
- Media Registry ContentId resolves exactly one content
- Publication Provenance ContentId resolves exactly one content
- Interactive Tool binding ContentId valid
- route rename with same ContentId has required redirect mapping

## Frontmatter / collection validation

- collection-specific schema
- date consistency
- Project status / featured rules
- Project stack -> technology tags only
- Tool category valid
- Note subject valid
- draft/publication semantics
- exception SEO fields valid

## Taxonomy validation

- ID / slug unique per namespace
- alias ambiguity禁止
- retired term new contentで使用禁止
- unknown term silent create禁止
- archive/indexable combination valid
- content registry refs active termへresolve

## MDX validation

- approved content module only
- arbitrary runtime component import禁止
- direct Tailwind/layout escape patternを必要に応じてlint
- raw legacy HTMLのnew introduction禁止
- direct site-owned R2 URL禁止
- `media:<asset-id>` resolve
- Demo module ID resolve
- broken internal link / route ref検出

## Source / evidence / citation contract tests

Article pipeline fixturesで:

- typed SourceLocator validation
- GitHub source commit SHA required
- private locator publication rejection
- SourceRef exact record hash binding
- freshness gate
- evidence atomicity structural rules
- citation logical marker resolution
- noneligible/private source public citation rejection
- deterministic footnote compilation
- fabricated/unknown Source ID rejection

を検査する。

normal site content buildはArticle Job private evidence bundleを必要としない。published MDX + provenanceのintegrityだけを確認する。

## Technical example verifier validation

`packages/example-verifier`:

- extractor fixture
- syntax/parser adapter fixture
- disposable sandbox launcher fixture
- timeout
- stdout/stderr cap
- network default deny
- credential/env filtering
- system/external mutation classification rejection
- content hash change -> previous result stale
- observed output requires actual execution/evidence

PR CIでuntrusted arbitrary repository article commandを無制限実行しない。

execution fixtureはsynthetic / allowlisted verifier test caseに限定する。

## Article Job contract / state-machine tests

minimum:

- ArticleJobSpec canonical serialization / fingerprint
- create -> new ContentId
- update -> existing exact ContentId
- invalid state transition rejection
- semantic response stays private until import success
- Skill snapshot binding
- response schema binding
- evidence / citation / example / audit target hashes
- revision staleness
- visual optionality by collection
- Blog missing hero blocked
- candidate exact-hash construction
- human approval cannot be semantic response
- approval stale after candidate change
- pre-approval R2 publication rejection
- media publication idempotent fixture
- repository export requires valid approval + publication manifest

live AI APIをunit/PR gateに必要としない。provider adapterはrecorded/synthetic fixtureでcontract testする。

## Media ingest validation

synthetic / safe fixtureで:

- HEIC capability detection where test environment supports pinned toolchain fixture
- input type probe
- orientation
- color space profile
- private metadata strip
- output dimension / hash
- no Git write
- no public upload

actual private iPhone photosをCI fixtureへ入れない。

## Git media guard

repository-level validator:

- `.heic` / `.heif` content binary禁止
- article photo / screenshot / AI hero binary path禁止
- oversized binary threshold
- known media extension outside approved small-site-asset / fixture pathsを検査
- Pagefind index / dist / Article Job private artifact commit禁止

small favicon/logo/UI SVG等はapproved path/policyで許可する。

## Media Registry validation

- per-content registry schema
- asset IDs unique within ContentId
- object key matches content-addressed policy
- expected SHA / size / dimensions present
- active/retired references valid
- published Blog hero exactly one
- published Blog social card exactly one
- AI asset -> provenance + visual audit refs
- no provider account/bucket ID

**このdeterministic gateではR2 objectをfetchしない。**

## Publication Provenance validation

- published Article Job content has provenance
- MDX/frontmatter hash matches current tree
- Article Job origin has candidate/approval/source/evidence/citation/example/audit/media hashes
- no private absolute path / credential / prompt/private reasoning
- manual edit drift detected
- legacy migration provenance allowed without fabricated source history

## Discovery validation

### archive/pagination

- generated item counts match discovery catalog
- no empty page
- no duplicate `/page/1/`
- taxonomy scope valid
- all next/prev links resolve

### RSS

- valid XML/feed format
- only public Blog items
- GUID unique and ContentId-stable
- canonical URLs valid
- full feed mode, if enabled, contains no client-only script/runtime

### Related content

- no self
- no draft/noindex
- deterministic score/order
- taxonomy references valid

### Pagefind

Astro build後にPagefind Extended indexを生成する。

- index build success
- no draft/noindex fixture indexed
- representative Japanese query top-k fixture passes
- mixed Japanese/English query fixture passes
- result URLs exist
- `/search/` route exists and noindex
- normal article output does not load Pagefind client JS

Pagefind indexはGit diff対象ではなくdeploy artifact。

## Static output / SEO validation

built `dist`に対して:

- canonical unique / correct origin
- title / description
- OG metadata
- structured data parse/required fields
- sitemap public canonical entries only
- robots
- search page noindex
- 404 artifact/semantics
- redirect artifact consistency
- no unintended duplicate route

## Frontend bundle validation

representative route classes:

- Blog content-only
- Notes content-only
- Project
- Tool with React island
- Search

checks:

- content-only -> React hydration 0 target
- Tool -> only required module/runtime chunk
- Search -> Pagefind runtime localized
- global script leakage
- JS/CSS diff artifact
- console error smoke

exact budgetsはopen decision / performance profileで確定後gate化する。

## Accessibility validation

Automated:

- semantic HTML checks where reliable
- representative automated audit
- alt/accessibility contract validation

Manual review gate where material UI changed:

- keyboard navigation
- visible focus
- interactive Tool behavior
- search keyboard behavior
- reduced motion
- zoom / narrow viewport
- heading / landmark semantics

scanner passだけでWCAG 2.2 AA conformanceと主張しない。

## Performance validation

foundation phaseでlegacy/vNext baseline取得後、route-class budgetをmachine profileへ固定する。

budgetはabsolute + diffで管理し、regressionごとにthresholdを黙って引き上げない。

lab CI != field Core Web Vitals。field dataが得られる場合は別monitoring signal。

---

# External Integration Gate

credential / network / provider stateを必要とするvalidation。

normal PRの必須unit gateと分離する。

## R2 published object verification

changed/selected Media Registryについて:

- public object reachable
- size/content type expected
- content-addressed key valid
- exact hash検証を実施するprofileではbytesをbounded downloadしてverify
- immutable/cache header requirement
- transformation URL representative response

全site buildごとに全media bytesをdownloadしない。

incremental changed-object check + periodic full inventory checkを分離できる。

## R2 recovery protection validation

infra-side source of truthから:

- protection freshness within policy
- representative object restore drill result
- expected credential cannot delete protected copy where applicable

を確認する。

site repoへbackup resource IDをduplicateしない。

exact hard release gateはO14確定後にmachine workflowへ落とす。

## Cloudflare delivery validation

- canonical domain status
- representative routes
- 404
- redirect behavior
- R2 custom-domain media
- cache/compression/security headers
- CSP violations
- sitemap/rss/search assets

## Redirect external validation

- site-owned path redirects
- infrastructure-owned WordPress query/domain redirects

を両方確認し、legacy inventoryのrequired redirectがunverifiedならcutover blocker。

## Production smoke

production deployment後:

- home
- Blog article + media
- Tool interactive route
- Search query smoke
- RSS
- 404
- representative old redirect

を確認する。

## Validation ownership

反復可能なinvariantは自然言語AGENTS/Skillだけに置かず、validator / schema / CIへ昇格する。

external/provider exact stateはsite buildのSoTと混同しない。
