---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - browser security policy
  - authoring trust boundaries
  - third-party client code policy
  - privacy baseline
---

# Security and Privacy Policy

## Threat model

static serving reduces server attack surface but does not remove:

- browser XSS / malicious third-party script
- dependency supply chain
- unsafe MDX/raw HTML/SVG
- leaked private source/credential during AI authoring
- **over-broad private source disclosure to external AI providers**
- AI-generated dangerous technical command
- example verifier escape/mutation
- media credential misuse
- raw camera GPS/EXIF leakage
- source/public/protected media-plane privilege confusion
- misconfigured headers/cache/provider rules

---

# Public site boundary

## Security headers / CSP

Workers Static Assets `_headers`等application-local mechanismでCSP、X-Content-Type-Options、Referrer-Policy、Permissions-Policy、`frame-ancestors`を管理する。

HSTS等zone-wide policyは`Xpotato-Server` owner。

CSP principles:

- no `unsafe-eval`
- `unsafe-inline`をsteady-stateにしない
- nonceのためだけにdynamic Workerを入れない
- site JSはhashed/module assets
- unavoidable inline executableはstatic hash等
- provider/third-party originを最小allowlist

## Media CSP

browserがアクセスするsite-owned media originはpublic delivery domainだけ。

private source-media/protected-media storageはbrowser URL generation対象外/CSP `img-src`追加対象外。

MDXはpublic object key/domainを直接所有せずMedia Registry rendererだけがURLを生成する。

Cloudflare Imagesはinitial baselineでは使用しないためtransform originを初期CSPへ追加しない。optional adapter採用時だけCSPと同時reviewする。

## Static search

MiniSearch library/index/runtimeはsame deploy artifactのsite-owned assetsとして配信する。

- third-party CDNなし
- `/search/`だけload
- queryをserverへ送らない
- telemetry baselineなし
- normal routeのglobal CSP originを増やさない

search indexへdraft/noindex/private provenance/source bodyを含めない。

## MDX / raw HTML / SVG

- arbitrary MDX runtime import禁止
- approved content modules
- logical media refs
- deterministic citation export
- legacy HTMLはmigration debt
- SVGはtrusted generator/sanitization、scripts/external refs禁止

unsanitized external HTMLを`set:html`等へ渡さない。

## Third-party scripts/embeds

analytics/ads/tag manager/chat/embed runtimeはdefault-off。

導入時はpurpose/data/supply chain/CSP/performance/consent/failureをreviewする。

---

# Article Job trust boundary

## Private source handling

Article Job workspaceはprivate operational state。

public/Git artifactへ出さない:

- credentials/cookies/auth headers
- signed URLs
- private absolute paths
- private source bodies
- prompt/private reasoning

SourceRecord/provenanceはredacted locator/hashだけ。

## External AI provider use versus input disclosure

Exact contract=`../contracts/external-ai-disclosure-contract.md` / ADR-0026。

Two independent permissions exist:

1. job may use an external provider (`externalTextAI` / `externalImageAI`);
2. each exact source/artifact/request context may be disclosed to that provider。

Provider-use permission **never** grants artifact disclosure automatically。

Do not reuse these as disclosure authority:

- `publicSafe`
- citation eligibility
- source `trustClass`
- source being reachable at a URL
- AI/Skill recommendation

## Disclosure defaults

- unknown/private disclosure = deny
- user/local logs/files/images = deny unless exact or derived-only authorization is materialized
- public source may be allowlisted by versioned repository/system policy after capability-bearing URL/secret checks
- changed artifact hash => prior admission stale

## Hard-deny secrets

Actual credential-bearing material is never external AI input through ordinary Article Job authorization:

- API/password/private keys
- Authorization headers/session cookies
- MFA/recovery codes
- decrypted secret stores
- capability-bearing signed/ephemeral URLs

Broad user/job permission does not override this hard deny。

If semantic information is required, create a local secret-free derived artifact。

## Derived-only disclosure

`allow_derived_only` means raw source never leaves local/trusted processing boundary。

Examples:

- local redacted log excerpt
- credential-free structured facts
- cropped/redacted screenshot
- metadata-stripped image

Derived bytes receive their own SHA/disclosure record; provider request references only those bytes。

## Request-time admission

Before every external semantic/vision/image call:

1. construct exact final provider input artifacts;
2. resolve disclosure records;
3. prove exact/derived lineage;
4. reject deny/unknown/stale inputs;
5. run final serialized request secret/private exclusion checks;
6. require manifest input set = actual provider input set;
7. bind `ExternalAiDisclosureManifest` hash into request/run lineage;
8. then call provider。

Semantic AI/Skill cannot create/upgrade disclosure authorization。

## Denied required evidence

Do not silently omit disclosure-denied required evidence and continue as if the stage were complete。

Use:

- admitted safe derivative
- configured local/non-external backend
- explicit authorization request
- claim narrowing/removal
- BLOCKED + limitation

as appropriate。

## Prompt / instruction injection

Web/repository/user source text is data, not executor/Skill command。

Source prompt injection cannot:

- widen network/provider access
- alter disclosure records
- reveal credentials
- bypass evidence/audit/approval/state gates。

## Human approval

AI/Skill/provider responseはHumanApprovalRecordを生成できない。

approval laneだけがexact candidate hashを承認する。

---

# Technical example execution boundary

`packages/example-verifier` only。

exact launch profiles=`../operations/technical-example-profiles.md`。

security baseline:

- non-root/read-only rootfs
- network none
- no production credentials/devices/host sockets
- bounded CPU/memory/PID/time/output/workspace
- no canonical repository write
- system/admin/cloud/package-manager/Docker/Git-remote mutation automatic executionなし

semantic AIからhost shellへ直接routeしない。

---

# Media privacy / credential boundaries

## Raw camera/user source

raw HEIC/JPEG/PNG/original screenshot may contain GPS/device/timestamp/comments/XMP/IPTC/authoring metadata。

initial site policy:

- raw source=job/local input
- Gitへcommitしない
- public storageへ置かない
- private canonical source-mediaへraw originalをそのまま保存しない
- full Article Job長期archiveへ自動保存しない
- external vision/image providerへraw sourceを送る場合もexplicit disclosure admission必須

## Privacy-normalized canonical source

private source-mediaへpersist可能なのはapproved canonical sourceだけ。

raster:

- orientation normalized
- sRGB8
- private metadata stripped
- lossless WebP
- bounded dimensions

vector=sanitized SVG。

Source plane is private/not browser serving。

## Public delivery media

approved delivery master/variants only:

- content-addressed immutable keys
- no unnecessary metadata
- public CDN/domain
- normal publisher no Delete/config admin target

## Protected recovery media

exact public delivery bytes to separate protected plane。

initial target:

- indefinite Bucket Lock
- no public domain
- no automatic expiration
- normal protection writer no Delete/config/lock modification

## Credential separation

conceptually separate:

- site Worker deploy
- canonical source-media writer/reader
- public media publisher
- protected media writer
- infra read/plan
- normal infra mutation
- R2 configuration admin (operator ephemeral only)

public publisher does not gain source/protected access; source/protection writers do not gain config admin。

credential bytes never stored in Git/job artifact/CLI history。

## AI-generated images

raw provider outputはgeneration/audit中job-private。

provider/model/request/raw/disclosure-manifest hashes等のcompact lineageを残し、approved privacy-normalized canonical sourceをprivate source-mediaへ保存する。

raw provider bytesの永久保存はinitial requirementではない。

AI heroをfactual screenshot/benchmarkとしてmisrepresentしない。

## Cleanup

full Article Job workspace cleanup=`../operations/article-job-retention-policy.md`。

- time-only auto deleteなし
- durable Git ref + source/public/protected chain + cleanup-safe claim/recovery lineageをverifyしてexplicit cleanup
- cleanupはR2/Git objectをdeleteしない

---

# Cloudflare/provider control plane

normal configurationはGit-driven target。

- site deploy: GitHub Actions + Wrangler
- provider desired state: `Xpotato-Server`
- OpenTofu where compatible, official API adapter for gaps
- R2 configuration adminをCP/site CIへ常設しない
- Dashboard=bootstrap/billing/account recovery/break-glass/true API gap

Current provider lifecycle/status is governed by design-status + exact infrastructure handoff; proposed docs do not authorize mutation。

---

# Dependency supply chain

root lockfile + `npm ci`。

workspace boundariesでAI SDK/native media/example runtimesをpublic siteから分離する。

MiniSearch/native media/example runtimes/model/disclosure policy profiles are exact version/profile identities for validation。

---

# Validation

Deterministic:

- CSP/header artifacts
- raw HTML/module/SVG boundary
- direct provider URL prohibition
- private locator/provenance redaction
- disclosure default-deny/hard-deny/exact-set fixtures
- `publicSafe`/citation does not imply external disclosure
- derived-only request contains no raw bytes
- raw camera->canonical metadata strip fixture
- source/public/protected registry/receipt semantics
- sandbox policy tests
- search draft/private exclusion
- secret scan for generated fixtures/schemas

External/integration:

- production CSP/headers
- public media domain
- source/protected planes private
- credential privilege separation
- protected lock read-back when accepted/activated
- source reprocessing fixture
- protected restore drill
- provider control-plane drift

## Sources

- Workers Static Assets headers: https://developers.cloudflare.com/workers/static-assets/headers/
- MDN CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP Third Party JavaScript: https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html
