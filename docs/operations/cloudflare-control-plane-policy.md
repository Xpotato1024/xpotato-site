---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - Cloudflare dashboard usage boundary
  - Cloudflare infrastructure automation policy
  - GitHub Actions deployment ownership
---

# Cloudflare Control Plane Policy

## Goal

通常のsite運用・deploy・media publication・infrastructure変更でCloudflare Dashboardを操作しない。

**Dashboardはbootstrap / billing / account recovery / break-glass専用。normal desired stateはGitに置き、CLI/API/IaCからreconcileする。**

同時に、Cloudflare-specific configuration自体も最小化する。provider settingを追加しなくてもstandard Web/CDN semanticsで達成できるものはapplication/object metadata側で解決する。

「Git管理」と「高権限credentialを常設すること」は別。`Xpotato-Server` ADR-0020のR2 configuration trust boundaryを維持する。

## Initial Cloudflare-specific desired surface

vNext launchでCloudflare側へ明示的に必要なstateを原則次へ限定する。

1. `xpotato.net` -> Worker service `xpotato-site` custom-domain binding
2. public website media R2 bucket + `assets.xpotato.net` custom domain
3. separate private protected-media R2 bucket
4. protected-media indefinite Bucket Lock
5. current required WordPress query/domain legacy redirects
6. provider account/zone/DNS resource state already owned by `Xpotato-Server`

**initially requiredにしない:**

- Cloudflare Workers Builds/Pages Git integration
- Cloudflare Images Transformations
- custom R2 CORS rule for normal `<img>/<picture>` delivery
- custom Cache Rule solely for immutable image TTL
- custom Compression Rule without measured need
- request-time media Worker

Cache/Compression/CORS等はactual requirementが発生してからGit desired stateへ追加する。

## Why no initial media Cache Rule

public R2 media objectsはpublication時にHTTP metadataとして:

```text
Cache-Control: public, max-age=31536000, immutable
```

を持つ。

Cloudflare default cache behaviorはorigin `Cache-Control: public` + positive `max-age`をcacheableと扱う。一般的image typesはdefault cache対象。

したがってcontent-addressed image master/variantの初期correctness/performanceにzone Cache Ruleを必須にしない。

将来:

- non-default file type
- edge/browser TTL分離
- Tiered Cache
- measured miss/origin-operation reduction

が必要ならruleを追加する。

## Why no initial R2 CORS

normal site mediaはcross-origin `<img>`, `<picture>`, OGP等として読むだけで、browser JavaScript `fetch()`/canvas pixel accessを要求しない。

そのためinitial public media bucketにCORS policyを追加しない。

将来Tool/DemoがR2 mediaをbrowser fetch/canvas利用する場合にだけ、exact origin/method/headerをnarrowly追加する。

## Control-plane classes

```text
A. site application deploy
   GitHub Actions -> Wrangler

B. durable normal Cloudflare infrastructure
   Xpotato-Server desired state -> OpenTofu where provider support is adequate
                                   -> official API adapter where provider gap exists

C. security-sensitive R2 bucket configuration
   Xpotato-Server desired values
      -> operator-authorized CLI/API reconcile
      -> ephemeral R2/Cloudflare admin credential
      -> read-back validation
   admin credential is not persisted on CP/site repo

D. object data plane
   Article Job / migration -> bucket-scoped/object-scoped credential
```

DashboardをA-Dのnormal stageへ入れない。

## Repository ownership

### `xpotato-site`

owns:

- Astro/static build
- Worker service application identity
- application-local Wrangler config
- GitHub Actions site CI/deploy workflow
- media object/variant/publication/protection request semantics
- public media HTTP metadata requirements
- provider-neutral validation requirements

normal deploy:

```text
Git revision
 -> GitHub Actions
 -> validate/build
 -> wrangler deploy
 -> smoke
```

Cloudflare Workers Builds / Pages dashboard settingsをproduction SoTにしない。

### `Xpotato-Server`

owns:

- Cloudflare account/zone inventory
- DNS / Worker custom-domain desired state
- R2 public/protected bucket desired values
- R2 custom-domain / lock / lifecycle / CORS if introduced
- Cache / Compression / provider redirect desired state if introduced
- credential capability design
- media protection implementation
- provider adapter/version choice

provider resource IDs / credentialsをsite repoへduplicateしない。

## Worker deploy versus hostname binding

`xpotato-site` deploy:

```text
wrangler deploy -> Worker service xpotato-site
```

infra binding:

```text
xpotato.net -> Worker service xpotato-site
```

Worker custom domainはcurrent Cloudflare provider/APIから管理可能なのでhostname/DNSをWrangler deployへ混ぜない。

`apps/site/wrangler.jsonc`はapplication/static-assets configだけを持つ。

## OpenTofu versus official API adapter

OpenTofuをexternal desired-state managementの第一選択とするが、**provider resourceが未対応だからDashboardへ戻る**ことはしない。

selection order:

1. current Cloudflare OpenTofu/Terraform resource
2. current Wrangler/official REST API
3. version-controlled narrow reconcile adapter in `Xpotato-Server`
4. API/CLI surface自体が存在しない場合だけDashboard exception

Rulesets等でprovider coverageが不足する場合はofficial Rulesets API adapterを使う。

adapter required properties:

- Git desired input
- read current
- diff/plan表示
- explicit mutation authorization
- read-after-write validation
- idempotence

provider dashboard click sequenceをコードとして模倣しない。

## R2 configuration trust boundary

Current `Xpotato-Server` ADR-0020ではR2 bucket configuration admin authorityをCP/OpenTofu persistent trust domainから外している。

website mediaでもこのprincipleを維持する。

### Desired state

Git (`Xpotato-Server`) owns:

- public website media bucket identity
- public media custom-domain requirement
- separate private protected-media bucket identity
- protected Bucket Lock = indefinite
- automatic protected-media lifecycle expiration = none
- CORS if future requirement exists

### Mutation capability

bucket create/delete/custom-domain/config/lock/lifecycle等のadmin operation:

- operator-authorized
- ephemeral admin token/session
- normal CP durable credentialへ付与しない
- site deploy/media-publish credentialへ付与しない
- Git/SOPS/site Article Jobへadmin secretを保存しない

とする。

ADR-0020に反するR2 primitiveをOpenTofu persistent ownershipへ無理に取り込まない。Wrangler/REST API reconcileでもdesired state/read-backを維持できる。

## R2 object data plane

Article Jobはbucket config adminを必要としない。

```text
human-approved candidate
 -> public master/variants upload/reuse
 -> exact identity verification
 -> private protected-media copy
 -> protection receipt
```

public publisherとprotected writerをseparate capabilityとする。

current R2 temporary credentialsはsingle-bucket + optional path/action scopeを持てるためimplementation candidate。ただしparent secretのtrust boundaryも評価する。

normal publication capabilityからDeleteObjectを除外することをtargetとし、GCはseparate privileged operation。

## Media protection implementation

initial protection class:

- public `xpotato-assets`とは別private bucket
- no public custom domain
- indefinite Bucket Lock
- no automatic expiry lifecycle
- normal public publisher has no protected-bucket access
- protection writer has no delete/config/lock privilege

exact bucket name / object layout / invocationは`Xpotato-Server` machine-readable SoT。

cross-bucket CopyObjectをhard dependencyにせず、verified copyまたはbounded GET->PUTでexact bytesを保護できる。

## Cache / compression / redirects

initial:

- application path redirect -> site static artifact
- current WordPress query/domain redirects -> infra provider rule
- media cache -> object `Cache-Control` metadata + default CDN cache behavior
- compression -> Cloudflare/default static asset delivery; custom Compression Ruleなし

future ruleを追加する場合:

- measured requirement
- Git desired state
- OpenTofu/API reconciliation

を要求する。

manual Dashboard ruleをnormal stateにしない。

## Responsive media portability

Cloudflare Images Transformationsをbaseline dependencyにしない。

```text
normalized master
 -> deterministic AVIF/WebP/fallback variants
 -> immutable R2 objects
 -> normal CDN/cache delivery
```

Cloudflare Imagesはoptional optimization adapter。

## GitHub Actions as site CI/CD

```text
PR -> deterministic CI/build
approved deploy -> exact artifact -> wrangler deploy -> smoke
```

Cloudflare Workers Buildsを第二deploy authorityとして維持しない。

site workflowからzone/R2 adminまで操作しない。

## Credential bootstrap

完全Dashboard-zeroは目的にしない。

Dashboard may be required for:

- initial account/zone/R2 subscription onboarding
- first/root bootstrap credential
- billing
- MFA/account ownership/recovery

initial token後はadditional scoped API tokenをAPIでprovision可能。

capability classes:

- Worker deploy
- public media object operation
- protected media object operation
- infra read/plan
- durable normal infra mutation
- R2 bucket configuration admin (ephemeral/operator-held only)

を混ぜない。

## Dashboard allowed operations

1. initial account/zone/service subscription bootstrap
2. billing/plan
3. first credential bootstrap when no API credential exists
4. MFA/SSO/account ownership/recovery
5. break-glass incident response
6. official API/CLI surfaceが存在しないprovider feature

6はexception record + reconciliation required。

Dashboard read-only inspectionは許容するがdesired-state authorityにしない。

## Break-glass reconciliation

Dashboardで緊急変更した場合:

1. exact manual change記録
2. service recovery確認
3. Git desired stateとの差分取得
4. Git/API/IaCへsame intentをcanonicalize、またはmanual changeをrevert
5. drift check clean
6. temporary privilege/token revoke/restrict

までcloseしない。

## Provider portability

provider-neutral:

- content / MDX
- ContentId / route semantics
- media master/variant identity
- HTTP cache requirement semantics
- publication/protection receipt schema
- redirect requirement semantics
- static deploy artifact

Cloudflare-specific adapter:

- Workers deploy
- zone/domain/rules
- R2 resource/data operations

## Validation

- deploy workflow is Git-controlled
- no Workers Builds dashboard dependency
- only expected initial Cloudflare config exists
- no unexplained manual drift
- provider-supported OpenTofu/API path exists
- R2 admin credential not persisted in site/CP durable trust boundary
- public custom domain + protected private bucket/lock state read-back
- public object `Cache-Control` metadata correct
- initial CORS absent unless approved requirement
- initial custom Cache/Compression Rules absent unless approved evidence
- Worker custom domain resolves expected service
- no content depends on Cloudflare Images-only URL
- break-glass changes have reconciliation evidence

## Current official references

- Workers GitHub Actions deployment: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- Worker custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- R2 API/auth: https://developers.cloudflare.com/r2/api/
- R2 temporary credentials: https://developers.cloudflare.com/r2/api/s3/temporary-credentials/
- R2 bucket locks: https://developers.cloudflare.com/r2/buckets/bucket-locks/
- R2 custom-domain caching: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
- Cloudflare default cache behavior: https://developers.cloudflare.com/cache/concepts/default-cache-behavior/
- Cache Rules: https://developers.cloudflare.com/cache/how-to/cache-rules/
