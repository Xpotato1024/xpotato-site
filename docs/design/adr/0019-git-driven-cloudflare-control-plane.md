---
status: proposed
owner: architecture
last_verified: 2026-08-26
---

# ADR-0019: Git-driven Cloudflare control plane with off-persistent R2 admin

## Context

Cloudflare Dashboard上のbuild setting、DNS、R2 config、Rulesをmanual SoTにするとdesired state、review、rollback、drift detection、recoveryが弱くなる。

しかしDashboardを減らすためにCloudflare/R2高権限credentialをCPやsite CIへ常設すると、`Xpotato-Server`のR2 root-of-trust boundaryを壊す。

したがって「desired stateをGitへ置くこと」と「mutation capabilityをpersistent automationへ与えること」を分離する必要がある。

## Decision

Normal control plane:

```text
site application deploy
  GitHub Actions -> Wrangler

provider desired state
  Xpotato-Server Git
    -> OpenTofu where trust/provider coverage permits
    -> official Cloudflare API adapter where needed

security-sensitive R2 config
  Git-described decision/desired values
    -> operator-authorized reconcile
    -> ephemeral R2/Cloudflare admin capability
    -> read-back validation
```

### Site ownership

- deterministic CI/build/deploy workflow in GitHub Actions
- Worker service application-local Wrangler config
- static deploy artifact

Cloudflare Workers Builds/Pages dashboard build settingsをproduction authorityにしない。

### Infra ownership

- zone/DNS/Worker public-domain binding
- provider redirects/rules
- R2 actual resource/config
- provider credential design

`architecture/infrastructure-handoff.md`のexact counterpart revisionをdesign evidenceとする。Mutable branch headをauthorityにしない。

### OpenTofu versus official API

OpenTofuをprovider-supported durable resourceの第一候補にするが、provider gapをDashboard manual operationで補わない。

If provider resource is missing/inappropriate:

1. official REST API/Wrangler capability
2. narrow version-controlled reconcile adapter
3. only if no official programmatic surface exists, Dashboard exception

### R2 configuration admin

R2 bucket create/delete/custom-domain/lock/lifecycle/configuration authorityは:

- CP durable normal OpenTofu credentialへ含めない
- site deploy credentialへ含めない
- Article Job source/public/protection data-plane credentialへ含めない
- Git/SOPS/CPへlong-lived admin secretとして保存しない

Mutation is operator-authorized with ephemeral admin capability and read-after-write validation。

This means R2 exact desired values can be machine-readable after infra acceptance without making a persistent R2 admin trust domain。

## Dashboard allowed scope

- initial account/zone/service onboarding
- billing/plan
- first credential bootstrap when no API credential exists
- MFA/account ownership/recovery
- break-glass incident response
- feature with no official API/CLI/IaC surface

Read-only inspection is allowed. Emergency manual mutation must be reconciled to Git or reverted before closure。

## Responsive media consequence

Cloudflare Images is not required. Baseline media delivery uses deterministic prebuilt variants + immutable object metadata. Custom Cache/Compression/CORS rules are added only for measured requirements。

## Alternatives

### Dashboard as normal SoT

Reviewability/rebuildability/driftが弱いため不採用。

### Cloudflare Workers Builds as second deploy authority

GitHub Actions CI/CDと二重authorityになりやすいため不採用。

### Persistent R2 config-admin token on CP/site CI

Dashboard-freeにはなるがcredential compromise blast radiusを拡大しexisting infra trust boundaryに反するため不採用。

### Cloudflare Images required baseline

Provider-specific enablement/pricingをmedia correctnessへ入れるため不採用。

## Consequences

Positive:

- normal operation is Git-driven/reviewable
- Dashboard UI changes have low operational impact
- site CI does not own zone/R2 admin
- R2 config privilege remains off persistent site/CP automation

Costs:

- security-sensitive R2 config changes require explicit operator-authorized reconcile
- provider/API adapters/version checks require maintenance
- initial bootstrap cannot be fully Dashboard-zero

## Cross-repository status

The current infra counterpart is still **Proposed / provider mutation blocked**. See `architecture/infrastructure-handoff.md` for exact SHA/status. This ADR does not authorize provider mutation before both design gates are accepted。
