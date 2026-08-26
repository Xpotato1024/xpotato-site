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

browserがアクセスするsite-owned media originは**public delivery domainだけ**。

private source-media/protected-media bucketは:

- public custom domainなし
- browser URL generation対象外
- CSP `img-src`追加対象外

MDXはpublic R2 key/domainを直接所有せずMedia Registry rendererだけがURLを生成する。

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

## External AI

job permissionがexternal AI上限。

provider request bundleをdeterministicに作りsecret/private exclusionを検証する。

web/repo/user source内の命令文はdataでありexecutor instructionとして扱わない。

AI responseはuntrusted proposalとしてstrict import。

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

raw HEIC/JPEG/PNG/original screenshot may contain:

- GPS
- device/model metadata
- timestamps
- comments/XMP/IPTC
- authoring path metadata

initial site policy:

- raw sourceはjob/local input
- Gitへcommitしない
- public R2へ置かない
- private canonical source-media R2へ**raw originalをそのまま保存しない**
- full Article Job長期archiveへ自動保存しない

## Privacy-normalized canonical source

private source-mediaへpersist可能なのはapproved canonical sourceだけ。

raster:

- orientation normalized
- sRGB8
- private metadata stripped
- lossless WebP
- bounded dimensions

vectorはsanitized SVG。

source bucketはprivate/no custom domain。

このplaneはfuture re-encoding用で、browser/public servingではない。

## Public delivery media

approved delivery master/variantsのみ。

- content-addressed immutable keys
- no unnecessary metadata
- public custom domain/CDN
- normal publisher no Delete/config admin

## Protected recovery media

exact public delivery bytesをseparate private bucketへcopyする。

initial:

- indefinite Bucket Lock
- no public domain
- no automatic expiration
- normal protection writer no Delete/config/lock modification

## Credential separation

conceptually:

- site Worker deploy
- canonical source-media object writer/reader
- public media publisher
- protected media writer
- infra read/plan
- normal infra mutation
- R2 configuration admin (operator ephemeral only)

を別capabilityとする。

public publisherがsource/protected bucketへアクセスできる前提にしない。

source/protection writerへbucket config adminを与えない。

credential bytesをGit/job artifact/CLI historyへ保存しない。

## AI-generated images

raw provider outputはgeneration/audit中job-private。

provider/model/request/raw hash等のcompact lineageを残し、approved privacy-normalized canonical sourceをprivate source-mediaへ保存する。

raw provider bytesの永久保存はinitial requirementではない。

AI heroをfactual screenshot/benchmarkとしてmisrepresentしない。

## Cleanup

full Article Job workspace cleanupは`../operations/article-job-retention-policy.md`。

- time-only auto deleteなし
- durable Git ref + source/public/protected receipt chainをverifyしてexplicit cleanup
- cleanupはR2/Git objectをdeleteしない

---

# Cloudflare/provider control plane

normal configurationはGit-driven。

- site deploy: GitHub Actions + Wrangler
- provider desired state: `Xpotato-Server`
- OpenTofu where compatible, official API adapter for gaps
- R2 configuration adminをCP/site CIへ常設しない
- Dashboard=bootstrap/billing/account recovery/break-glass/true API gap

break-glass manual changesはGitへreconcileする。

---

# Dependency supply chain

root lockfile + `npm ci`。

workspace boundariesでAI SDK/native media/example runtimesをpublic siteから分離する。

MiniSearch/native media/example runtimes/model profilesはexact version/profile identityでvalidationする。

---

# Validation

Deterministic:

- CSP/header artifacts
- raw HTML/module/SVG boundary
- direct R2 URL禁止
- private locator/provenance redaction
- raw camera->canonical metadata strip fixture
- source/public/protected registry/receipt semantics
- sandbox policy tests
- search draft/private exclusion
- secret scan for generated fixtures/schemas

External:

- production CSP/headers
- public media custom domain
- source/protected buckets are private/no custom domain
- normal public publisher cannot access source/protected planes where testable
- source/protected writers cannot Delete/configure
- protected lock read-back
- source reprocessing fixture
- protected restore drill
- provider control-plane drift

## Sources

- Workers Static Assets headers: https://developers.cloudflare.com/workers/static-assets/headers/
- MDN CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP Third Party JavaScript: https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html
