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

static public serving reduces server-side attack surface but does not remove:

- browser-side XSS / malicious third-party script
- dependency supply-chain risk
- unsafe MDX/raw HTML
- external media/embed risk
- leaked private source / credential during AI authoring
- AI-generated dangerous technical command
- example verifier host escape / network mutation
- R2 media publication credential misuse
- public media privacy/provenance leakage
- misconfigured CSP/headers/cache

security boundaryをpublic siteとauthoring toolchainの両方に持つ。

---

# Public site boundary

## Security headers

Workers Static Assets `_headers`等のapplication-local mechanismで少なくとも:

- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- `frame-ancestors`

を管理する。

HSTS等zone-wide policyは`Xpotato-Server` owner。

## CSP

strict CSPをtargetとする。

principles:

- `unsafe-eval`禁止
- `unsafe-inline`を恒久解決にしない
- request nonce発行のためだけにdynamic Workerを導入しない
- site-owned JSはhashed build asset/moduleへ分離
- unavoidable inline executable scriptはbuild-time hash等static-compatible mechanismを使用
- provider/third-party originはdirectiveごとに最小allowlist

CSP導入はreport-only / preview validationから始め、機能を壊した状態で強制しない。

## Media CSP

site-owned R2 mediaはcustom domain / transform domainのknown originへ限定する。

Media Registryからrendererが生成したURLだけをsite-owned content mediaとして扱う。

MDXが任意R2 key / transform directiveを直接注入しない。

preferred architectureではmedia custom domainをsame site trust boundaryに近い明示originとしてCSP `img-src`へallowする。

Cloudflare Images transform URLのexact originはimplementation時に固定し、CSPと同時変更する。

## Pagefind

Pagefind runtime/indexはsame deploy artifactから配信する。

searchのためにthird-party runtime CDNを要求しない。

`/search/`だけclient runtimeをloadするため、Pagefind採用でglobal CSP originを増やさない構成を優先する。

## MDX / raw HTML

new publishing pathでunsanitized external HTMLを`set:html`へ渡さない。

- arbitrary MDX component import禁止
- approved module registry
- logical media refs
- deterministic citation export
- build-time diagram output sanitization where SVG used

legacy HTMLはmigration debtとして隔離。

SVG content mediaはscript/external ref等を考慮し、trusted generatorまたはsanitization gateを要求する。

## External links / embeds

external linkにblanket `target=_blank`を要求しない。

iframe/embedはdefault-off。採用時:

- sandbox/referrer/allow policy
- CSP origin
- privacy/tracking
- performance
- fallback link

を設計する。

## Third-party JavaScript

analytics / ads / tag manager / chat / embed runtimeはdefault-off。

導入時:

- reader/business purpose
- data sent
- supply-chain execution privilege
- CSP expansion
- performance
- consent/disclosure
- failure behavior

を評価する。

static link / self-hosted / privacy-preserving alternativeを先に検討する。

## Privacy baseline

public siteはaccount/session/behavior profile/personal form submissionをbaseline requirementにしない。

tracking/analytics/ads導入時はcollection/retention/third party/consentを先に定義する。

unused browser capabilityをPermissions-Policyで制限する。

---

# Article Job trust boundary

## Private source handling

Article Job workspaceはprivate。

保存禁止/公開禁止:

- credential value
- Cookie / Authorization header
- signed/ephemeral URL
- unnecessary private absolute path
- private source body in Publication Provenance
- private reasoning

SourceRecordはtyped redacted locator / artifact hashを使う。

public citation exporterは`publicSafe && citation.eligible` sourceだけを外部表示する。

## External AI authorization

job permissionがexternal AI利用の上限。

`externalTextAI=false` / `externalImageAI=false`ならprovider adapterを呼ばない。

private/local sourceをexternal AIへ送る場合は、そのjobで明示的に許されたinput scopeだけをrequestへ含める。

provider call前にrequest bundleをdeterministicに作り、secret/private exclusion validationを行う。

AI responseはuntrusted proposalとしてstrict schema importする。

## Prompt / instruction injection

取得したweb content / repository document / user-supplied source内の命令文をArticle Job executor instructionとして扱わない。

source bodyはdata。

semantic Skill/system instructionとsource evidenceを物理的/論理的に分離する。

AIがsource内の「別URLへアクセス」「credentialを出力」「制約を無視」等を実行指示として採用しない。

## Human approval

AI/Skill/provider responseはHumanApprovalRecordを生成できない。

approval CLI/laneのみexact candidate hashへ承認を付与する。

convenience runnerがconfirmを自動設定しない。

---

# Technical example execution boundary

`packages/example-verifier`だけがarticle code/command実行能力を持つ。

rules:

- host direct arbitrary execution禁止
- disposable sandbox
- no production credential mount
- network default deny
- explicit runtime/tool version
- wall-clock/output/resource bounds
- canonical repository write禁止
- system/external mutation command auto-execution禁止

sandbox escape / container runtime securityはimplementation security review対象。

Article Job semantic AIからshell command execution APIへ直接routeしない。

---

# Media authoring / publication boundary

## Camera media

public derivative前に:

- GPS
- private/unnecessary EXIF
- authoring path metadata

をstripする。

raw HEIC/originalはprivate。

## AI-generated media

camera mediaと同じmetadata strip policyを無条件適用しない。

raw generated output/provenance signalをprivate artifactとして確認し、public derivativeがembedded metadataを失っても`origin=ai_generated` lineageを維持する。

AI-generated heroをfactual screenshot/benchmarkとして扱わない。

## R2 publication credentials

site build / Article previewはR2 write credential不要。

approved media publicationだけがscoped write credentialを使う。

normal media publisherに:

- account admin
- bucket config
- lifecycle/lock change
- backup delete
- broad object delete

権限を与えることを前提にしない。

exact provider permissionは`Xpotato-Server` owner。

credentialをArticle Job artifact / Git / CLI argument historyへ保存しない。

## Media recovery

public R2 objectを唯一のbackupにしない。

recovery backend credentialはnormal site media publisherと分離する。

GC/deleteはseparate privileged operation。

---

# Dependency supply chain

lockfile + `npm ci`。

workspace boundaryにより:

- provider SDK
- media native tool
- sandbox dependency

をpublic siteから分離する。

major dependency updateとsecurity advisory responseは別に扱える。

build/search tool packageもpinned dependencyとしてvalidationする。

---

# Validation

Deterministic:

- CSP/header artifact shape
- raw HTML/module boundary
- direct R2 URL禁止
- private locator/provenance redaction
- provider SDK workspace boundary
- example sandbox policy tests
- media metadata fixture
- no secrets in generated schemas/fixtures

External:

- production headers/CSP
- blocked resource/violation
- R2 custom domain / transformed media
- publisher credential scope where testable
- recovery protection/drill status
- third-party origin inventory

詳細は`operations/validation.md`。

## Sources

- Workers Static Assets headers: https://developers.cloudflare.com/workers/static-assets/headers/
- MDN CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP Third Party JavaScript: https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html
