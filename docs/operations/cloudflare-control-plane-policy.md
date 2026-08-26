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

ただし「Git管理」と「高権限credentialを常設すること」を混同しない。`Xpotato-Server` ADR-0020のR2 configuration trust boundaryを維持する。

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
   Article Job / migration -> bucket-scoped object credential
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
- R2 bucket/config desired values
- R2 custom-domain / lock / lifecycle / CORS desired values
- Cache / Compression / provider redirect desired state
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

1. current Cloudflare Terraform/OpenTofu provider resource
2. current Wrangler/official REST API
3. version-controlled narrow reconcile adapter in `Xpotato-Server`
4. API/CLI surface自体が存在しない場合だけDashboard exception

Rulesets等でTerraform provider coverageが不足する場合、official Rulesets API adapterを使う。

adapterは:

- Git desired input
- read current
- diff/plan表示
- explicit mutation authorization
- read-after-write validation
- idempotence

を持つ。provider dashboard click sequenceをコードとして模倣しない。

## R2 configuration trust boundary

Current `Xpotato-Server` ADR-0020ではR2 bucket configuration admin authorityをCP/OpenTofu persistent trust domainから外している。

vNext website mediaでもこのprincipleを維持する。

### Desired state

Git (`Xpotato-Server` inventory/architecture) owns:

- public website media bucket identity
- custom domain requirement
- protected-copy prefix/bucket decision
- Bucket Lock / lifecycle values
- CORS if needed

### Mutation capability

bucket create/delete/custom-domain/config/lock/lifecycle等のadmin operationは:

- operator-authorized
- ephemeral admin token/session
- normal CP durable credentialへ付与しない
- Git/SOPS/site Article Jobへadmin secretを保存しない

とする。

実行toolはOpenTofu resourceをpersistent ownershipに使う必要はない。ADR-0020に反しない範囲でWrangler/REST API reconcileを使用する。

したがって**Dashboard manual editを減らすことと、R2 admin authorityを常設しないことを両立できる。**

## R2 object data plane

Article Jobはbucket configuration adminを必要としない。

```text
human-approved candidate
 -> bucket-scoped object operations
 -> public master/variants upload/reuse
 -> verification
 -> protected-copy operation
 -> protection receipt
```

R2 S3/API credentialは必要bucketへscopeする。

current R2 temporary credentialsはshort-livedかつpath/action scoped delegationを提供するため、implementation時にはleast-privilege upload/protection credentialとして評価する。ただしcredential-minting parent secretのtrust boundaryも同時に評価し、単にtoken layerを増やしただけで安全とみなさない。

## Media protection implementation constraint

site contractはprotected destinationがbucketかprefixかを固定しない。

infra implementationはADR-0020 patternを再利用できる。

minimum:

- public delivery objectだけを唯一のcopyにしない
- normal article publisherがBucket Lock等のconfigurationを変更できない
- protected copyへrequired retention ruleがprovider側でenforceされる
- receiptはsecret-free
- restore drill可能

exact protected bucket/prefix / retention daysは`Xpotato-Server` machine-readable desired stateで決める。

## Cache / compression / redirects

- application path redirect -> site static artifact where possible
- query/domain/provider redirect -> infra desired state
- Cache/Compression/Rulesets -> OpenTofu resource where supported, otherwise official API adapter

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

Cloudflare-specific featureを停止してもMDX/Media Registry/normal image renderingを維持する。

## GitHub Actions as site CI/CD

site repo:

```text
PR -> deterministic CI/build
main/approved deploy -> exact artifact -> wrangler deploy -> smoke
```

Cloudflare Workers Builds dashboard build commandを第二deploy authorityとして維持しない。

infra deployment/reconcileは`Xpotato-Server` deployment authorityに従い、site workflowからCloudflare zone/R2 adminまで操作しない。

## Credential bootstrap

完全なDashboard-zeroは目的にしない。

Dashboard may be required for:

- initial account/zone/R2 subscription onboarding
- first/root bootstrap credential
- billing
- MFA/account ownership/recovery

bootstrap後はAPIでadditional scoped token/R2 credentialを作成できる。

normal credential classes:

- Worker deploy
- public media object operation
- infra read/plan
- infra mutation
- R2 bucket configuration admin (ephemeral/operator-held only)

を混ぜない。

## Dashboard allowed operations

1. initial account/zone/service subscription bootstrap
2. billing/plan
3. first credential bootstrap when no API credential yet exists
4. MFA/SSO/account ownership/recovery
5. break-glass incident response
6. official API/CLI surfaceが存在しないprovider feature

6はexception record + reconciliation required。

Dashboardはread-only visual inspectionには使ってよいがdesired-state authorityにしない。

## Break-glass reconciliation

Dashboardで緊急変更した場合:

1. exact manual change記録
2. service recovery確認
3. Git desired stateとの差分取得
4. Git/API/IaCへsame intentをcanonicalize、またはmanual changeをrevert
5. drift check clean
6. temporary privilege/tokenをrevoke/restrict

までcloseしない。

## Provider portability

provider-neutralに維持:

- content / MDX
- ContentId / route semantics
- media master/variant identity
- publication/protection receipt schema
- redirect/cache requirement semantics
- static deploy artifact

Cloudflare-specific adapter:

- Workers deploy
- zone/domain/rules
- R2 resource/data operations

## Validation

- deploy workflow is Git-controlled
- no Workers Builds dashboard dependency
- Cloudflare infra has no unexplained manual drift
- provider-supported OpenTofu/API path exists for normal configuration
- R2 admin credential not stored in site repo/CP durable credential boundary
- R2 public/protected policy read-back matches desired values
- Worker custom domain resolves expected service
- Ruleset state matches Git desired state
- no content depends on Cloudflare Images-only URL
- break-glass changes have reconciliation evidence

## Current official references

- Workers GitHub Actions deployment: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- Worker custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- R2 API: https://developers.cloudflare.com/r2/api/
- R2 auth/tokens: https://developers.cloudflare.com/r2/api/tokens/
- R2 temporary credentials: https://developers.cloudflare.com/r2/api/s3/temporary-credentials/
- R2 bucket locks: https://developers.cloudflare.com/r2/buckets/bucket-locks/
- Cache Rules: https://developers.cloudflare.com/cache/how-to/cache-rules/
- Compression Rules API: https://developers.cloudflare.com/rules/compression-rules/create-api/
