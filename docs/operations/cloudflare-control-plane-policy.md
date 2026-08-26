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

**Cloudflare Dashboardはbootstrap / billing / account recovery / break-glass専用とし、normal control planeはGit + CI + CLI/API/IaCで構成する。**

Dashboardでしか実施できない操作を増やさず、provider UIの手順を日常runbookの正本にしない。

## Normal control plane

```text
GitHub
  |
  +-- xpotato-site
  |     PR -> deterministic CI
  |     main -> GitHub Actions -> wrangler deploy
  |
  +-- Xpotato-Server
        PR -> OpenTofu plan
        approved main/change -> OpenTofu apply / official Cloudflare API

Cloudflare
  <- Worker deploy
  <- DNS / domain / Rules desired state
  <- R2 bucket / custom domain / CORS / lifecycle / lock desired state
  <- media object publication / protection operations
```

Cloudflare Dashboardをこのflowの通常stageへ入れない。

## Repository ownership

### `xpotato-site`

owns:

- Astro/static build
- Worker service identity used by deploy
- application-local Wrangler configuration
- static asset deploy artifact
- application `_headers` / path redirects / 404 semantics
- GitHub Actions site CI/deploy workflow
- provider-neutral external validation expectations

normal production deploy:

```text
Git commit
 -> GitHub Actions
 -> npm ci / validation / build
 -> wrangler deploy
 -> production smoke
```

Cloudflare Workers Builds / Pages dashboard build settingsをproduction SoTにしない。

### `Xpotato-Server`

owns:

- account / zone inventory
- DNS desired state
- Worker custom-domain binding
- R2 bucket resources
- R2 custom domains
- R2 CORS / lifecycle / Bucket Lock
- Cache Rules / Compression Rules
- provider-level redirect rules
- media protection resources / policy
- Cloudflare API-token permission requirements
- OpenTofu/provider version

resource identifier / provider configを`xpotato-site`へduplicateしない。

## Worker deployment versus domain binding

Worker code/static asset deploymentとpublic hostname bindingを分離する。

`xpotato-site`:

```text
wrangler deploy -> service `xpotato-site`
```

`Xpotato-Server`:

```text
xpotato.net -> Worker service `xpotato-site`
```

Worker custom domainはCloudflare Terraform provider / APIで管理可能なので、Wranglerからcustom domainを作ることをnormal pathにしない。

これによりDNS / hostname / TLS ownershipをinfra repoへ集約する。

`wrangler.jsonc`はproduction hostnameをsecond SoTとして持たず、Worker/static assets application configへ限定する。

## R2 configuration

2026-08時点のCloudflare API / Terraform providerで少なくとも次をprogrammaticに管理可能:

- R2 bucket
- R2 custom domain
- CORS
- object lifecycle
- Bucket Lock

したがってこれらのDashboard手動設定をnormal operationにしない。

provider resourceが一時的に不足/buggyな場合:

1. official Cloudflare REST API / Wrangler capabilityを確認
2. `Xpotato-Server`にversioned desired-state adapter/scriptを置く
3. read-after-write / drift validationを持つ
4. API/CLIでも不可能な場合のみDashboard exceptionを検討

Dashboardをprovider schema gapの最初のfallbackにしない。

## Cache / compression / redirects

zone-level:

- Cache Rules
- Compression Rules
- query/domain redirect Rules

はRulesets API / Terraformで管理する。

manual dashboard ruleを作成しない。

application path redirectはsite repoのstatic redirect artifactを優先し、provider-level ruleを不必要に増やさない。

## Media object operations

normal Article Job media flowはDashboard uploadを使用しない。

```text
approved candidate
 -> scoped API/S3/CLI object write
 -> verify public object
 -> protected-copy operation
 -> verify protection receipt
```

bulk migrationも同じくCLI/APIを使う。

R2 browser object managerはread-only inspection / emergency useに限定する。

## Responsive media portability

Cloudflare Images Transformationsをbaseline dependencyにしない。

baseline:

```text
private normalized master
 -> deterministic responsive variant generation
 -> immutable R2 master + AVIF/WebP/fallback variants
 -> normal CDN/cache delivery
```

Cloudflare Images Transformationsはoptional delivery adapter。

理由:

- build/publication resultをprovider feature activationから切り離す
- image quality/width/profileをversion-controlできる
- Cloudflare plan/pricing変更でarticle delivery contractを壊さない
- R2/S3-compatible storage migration時にmedia artifact modelを維持できる

optional adapter導入時もMDX / Media Registry semantic identityを変更しない。

## GitHub Actions as canonical CI/CD

Cloudflare Workers Builds dashboard連携をproduction deploy authorityにしない。

GitHub Actionsをcanonical pipelineとする。

site workflow target:

```text
PR:
  validate / test / build

main:
  validate / build
  deploy exact artifact with Wrangler
  smoke
```

infra workflow target:

```text
PR:
  tofu fmt/validate/plan

approved apply path:
  tofu apply
  external state validation
```

exact trigger / environment approvalはimplementation workflowで固定する。

## Credential bootstrap

### Dashboard-required initial bootstrap

Cloudflare公式仕様上、最初のCloudflare API tokenはDashboardで作成する必要がある。

またaccount creation、billing/plan/R2 subscription等もprovider administrationとしてDashboardを必要とし得る。

これらをnormal configuration operationと混同しない。

### After bootstrap

初期tokenからCloudflare APIを用いて追加のscoped account/user API tokenを生成できる。

R2 S3-compatible access tokenもAPIで生成可能。

したがって通常のtoken provisioning / rotationでDashboardを必須にしない設計をtargetとする。

credential capabilityは少なくとも分離する:

- site Worker deploy
- infra plan/read
- infra apply
- public media publish
- protected media operation

secret valueをGitへcommitしない。

GitHub Actions secret/environmentまたはapproved secret storeへ注入する。

## Dashboard allowed operations

Dashboardを使ってよいnormal exceptions:

1. initial account / zone onboarding
2. billing / plan / R2 subscription checkout
3. first bootstrap API token creation
4. MFA / SSO / account ownership / recovery
5. break-glass incident response when automation path is unavailable
6. API/CLI/IaC supportが本当に存在しないprovider feature

6の場合はmaterial exceptionとしてADR / runbookへ理由・manual state・reconciliation手順を残す。

## Dashboard read-only usage

status確認・visual inspectionとしてDashboardを見ることは禁止しない。

ただしDashboard表示をdesired stateの唯一の記録にしない。

手動変更を発見した場合:

- Git desired stateへimport/encodeする
- あるいはmanual driftをrevertする

までincident/changeをcloseしない。

## Break-glass reconciliation

emergencyでDashboard変更した場合:

1. exact変更を記録
2. production回復を確認
3. Git/infra desired stateとの差分を取得
4. same intentをcode/configへ反映するかmanual changeをrevert
5. plan/drift checkをcleanに戻す
6. credential exposure / privilegeを再確認

**manual stateを恒久仕様として放置しない。**

## Provider portability boundary

Cloudflare固有でよいもの:

- Workers Static Assets deployment adapter
- Cloudflare zone/rules resources
- R2 resource adapter

provider-neutralに維持するもの:

- content / MDX
- ContentId / route semantics
- media object identity / variant manifest
- R2-compatible object hierarchy
- publication/protection receipts
- cache requirement semantics
- redirect requirement semantics
- build artifact

provider-specific identifiersをarticle/content contractへ入れない。

## Validation

CI / external validationで少なくとも:

- site deploy workflow definition is in Git
- Workers Builds dashboard config is not required for deploy
- infra desired-state plan has no unexplained drift
- Worker custom domain resolves expected service
- R2 custom domain/CORS/lifecycle/lock match desired state
- Cache/Compression/redirect rules match desired state
- no active content relies on Cloudflare Images-only URL without fallback
- emergency manual change has reconciliation record

を確認する。

## Current official capability references

- Workers GitHub Actions deployment: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- Wrangler/static assets: https://developers.cloudflare.com/workers/static-assets/
- Worker Custom Domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- R2 API: https://developers.cloudflare.com/r2/api/
- R2 custom-domain API: https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/domains/
- R2 Terraform resources: https://developers.cloudflare.com/api/terraform/resources/r2/
- R2 Bucket Locks: https://developers.cloudflare.com/r2/buckets/bucket-locks/
- Cache Rules: https://developers.cloudflare.com/cache/how-to/cache-rules/
- Compression Rules API: https://developers.cloudflare.com/rules/compression-rules/create-api/
- Cloudflare API token bootstrap: https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/
