---
status: proposed
owner: architecture
last_verified: 2026-08-26
---

# ADR-0019: Git-driven Cloudflare control plane

## Context

xpotato-siteはCloudflare + GitHubで完結するstatic publishing platformをtargetとしている。

Cloudflare Dashboard上のbuild setting、DNS、R2設定、cache rule等を手作業で維持すると:

- desired stateがGitに残らない
- review / rollback / drift detectionが弱い
- account UI変更へrunbookが依存する
- disaster recovery時に再構築しにくい
- site repo / infra repoとのSoT境界が崩れる

一方、2026-08時点ではCloudflareの主要resourceはWrangler、REST API、Terraform providerから管理可能である。

## Decision

**Cloudflare Dashboardはbootstrap / billing / recovery / break-glass専用とし、通常control planeはGit + GitHub Actions + Wrangler + OpenTofu/Cloudflare APIで管理する。**

具体的には:

- site CI/CD: GitHub Actions
- static Worker deploy: Wrangler
- Cloudflare Workers Builds dashboard pipeline: production SoTにしない
- DNS / Worker custom-domain binding / zone Rules: `Xpotato-Server` OpenTofu
- R2 bucket / custom domain / CORS / lifecycle / Bucket Lock: `Xpotato-Server` OpenTofu/API
- R2 media object operation: scoped API/S3/CLI
- dashboard manual config: normal workflowから除外

Worker service deploymentとhostname bindingを分離し、`xpotato-site`はWorker artifactをdeploy、`Xpotato-Server`は`xpotato.net`等のprovider bindingを所有する。

## Responsive image consequence

Cloudflare Images Transformationsをbaseline requirementにしない。

responsive mediaはdeterministicにpre-generateしてimmutable objectとしてR2へpublishする。

Cloudflare Imagesはoptional adapterとし、provider featureがなくても同等content semanticsとresponsive deliveryを維持できるようにする。

## Dashboard exceptions

許容するDashboard operation:

- initial account/zone onboarding
- billing / subscription
- first bootstrap API token
- account/MFA/recovery
- emergency break-glass
- stable API/CLI/IaC surfaceが存在しないfeature

最後のケースはexception recordとGit reconciliationを必須にする。

## Consequences

### Positive

- normal operationがreviewable/reproducibleになる
- Cloudflare UI変更による手順driftを減らせる
- infra driftをplanで検出できる
- provider-specific stateをcontent contractから隔離できる
- future provider migrationが容易になる

### Negative

- GitHub Actions / OpenTofu / credential bootstrapの設計が必要
- provider version upgradeを管理する必要がある
- emergency manual change後にreconciliation作業が必要
- initial API token / billing等の完全dashboard-zeroは実現できない

## Alternatives rejected

### Cloudflare Dashboardを通常運用の正本にする

再現性、reviewability、drift detectionが弱いため不採用。

### Cloudflare Workers Buildsへdeploy controlを寄せる

build configurationがCloudflare account UI stateへ依存し、GitHub側のCI/CD SoTと二重化しやすいためbaselineにはしない。

### Cloudflare Imagesを必須responsive pipelineにする

provider-specific feature activation/pricingへmedia deliveryが依存するため不採用。optional enhancementとしては許容する。

## References

- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/api/terraform/resources/workers/subresources/domains/
- https://developers.cloudflare.com/api/terraform/resources/r2/
- https://developers.cloudflare.com/r2/buckets/bucket-locks/
- https://developers.cloudflare.com/cache/how-to/cache-rules/
- https://developers.cloudflare.com/rules/compression-rules/create-api/
- https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/
