---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - deployment ownership boundary
  - site/infrastructure R2 responsibility split
---

# Deployment Boundary

## Site repository owns

`xpotato-site` owns:

- site source / content
- ContentId / route semantics
- build definition / deploy artifact contract
- application-local Wrangler/static asset config
- GitHub Actions site CI/deploy workflow
- site-local route / 404 / path redirect
- logical media asset identity
- content-addressed public media object-key semantics
- MediaPublicationManifest contract
- MediaProtectionRequest / Receipt contract verification
- media delivery/cache requirements
- site-side broken-media detection
- exact media recovery acceptance requirement
- public smoke / validation contract

## Infrastructure repository owns

`Xpotato1024/Xpotato-Server` owns:

- Cloudflare account / zone inventory
- DNS desired state
- Worker custom-domain binding
- public R2 bucket resource lifecycle
- protected-copy resource/prefix lifecycle
- R2 custom domain / CORS / lifecycle / Bucket Lock
- zone-level Cache / Compression Rules
- provider-level redirect/rules
- GitHub Actions infra plan/apply workflow
- infrastructure credentials / secret handling
- media protection copy implementation
- Bucket Lock / retention / lifecycle values
- restore operation / drills

account ID / zone ID / protected bucket/prefix name / credentialをsite repoへcanonical duplicateしない。

## Production target

vNext public site = Cloudflare Workers Static Assetsへstatic deploy artifactをpublish。

Cloudflare Pages / VPS static hostingをcurrent targetとして併記しない。

production CI/CD authorityはGitHub Actions。

Cloudflare Workers Builds / Pages dashboard build settingsをproduction SoTにしない。

exact control-plane policyは`cloudflare-control-plane-policy.md`。

## Worker deploy versus hostname binding

Worker service artifactとpublic hostnameを別ownerにする。

`xpotato-site`:

```text
GitHub Actions
 -> deterministic validation/build
 -> wrangler deploy
 -> Worker service `xpotato-site`
```

`Xpotato-Server`:

```text
Cloudflare zone
 -> Worker custom-domain desired state
 -> xpotato.net -> service `xpotato-site`
```

Worker custom domainはCloudflare provider/APIから管理可能なので、normal deployでWranglerにdomain/DNS ownershipまで持たせない。

`wrangler.jsonc`はWorker/static-assets application configへ限定し、production hostnameをsecond SoTとして持たない。

## Public content media

photographic/raster mediaはR2-first。

current infrastructure inventory上のwebsite public binary bucket resourceはinfra SoT。siteはlogical object contractだけを知る。

normal Article Job publication:

```text
candidate
 -> preview
 -> human approval
 -> public R2 publish/reuse
 -> MediaPublicationManifest
 -> protected recovery copy/reuse
 -> MediaProtectionReceipt
 -> repository export
 -> site deploy
```

Git revisionが新R2 objectを参照する前にpublication + protection chainをverifyする。

## Responsive media deployment

responsive variantsはbaselineでdeterministic pre-generationする。

```text
normalized master
 -> AVIF/WebP/fallback width variants
 -> immutable R2 objects
 -> CDN/cache delivery
```

Cloudflare Images Transformationsはoptional adapterであり、publication/deploy prerequisiteではない。

これによりCloudflare-specific image feature activationなしでもsite media contractを満たす。

## Public media mutation credential

Article Job preview/buildはR2 write credential不要。

public media publish operationだけがscoped public-object write capabilityを必要とする。

requirements:

- bucket/account admin権限をnormal publisherへ与えない
- bucket config / lock / lifecycleを変更できない
- credential bytesをGit / Article Job artifactへ保存しない
- delete / GCをnormal article publisherの責務にしない
- credential provisioning/revocationはinfra owner

## Protected-copy credential boundary

public media publisherとprotected-copy writer/adminを同一権限境界にしないことをtargetとする。

site Article Jobはprovider admin credentialを所有せず、typed protection operationへobject identityを渡し、secret-free receiptを受け取る。

normal site deploy credentialにもprotected-copy delete/unlock権限を要求しない。

exact Cloudflare permission shapeは`Xpotato-Server` machine SoTで確定する。

## Credential bootstrap

initial Cloudflare API token / billing等はDashboard bootstrapが必要になり得る。

bootstrap後はscoped API token / R2 tokenをAPIでprovisionできるため、通常rotation / automationでDashboardを必須にしないtargetとする。

credential classes:

- site Worker deploy
- infra plan/read
- infra apply
- public media publish
- protected media operation

をseparate capabilityとして扱う。

secret storage / rotationはinfra/CI security policyの責務。

## Media protection / recovery boundary

publication-time hard gate:

- site: `../contracts/published-media-protection-contract.md`
- infra: protected-copy actual implementation / policy

post-loss recovery semantics:

- site: `../contracts/media-recovery-contract.md`
- infra: actual restore operation / drill

public delivery objectを唯一のrecovery copyにしない。

## R2 garbage collection

normal Article Job / site deployはpublished objectをdeleteしない。

GCはseparate privileged operation。

GC planner must consider:

- current Media Registries
- retained Git refs/releases required by policy
- active publication manifests
- valid protection receipts
- grace period

protected-copy deletion/lifecycleもinfra policyに従い、site-side orphan判定だけで直接deleteしない。

## Redirect boundary

Static Assets `_redirects`等で表現可能なapplication path redirectはsite repo。

WordPress `/?p=...`等のquery/domain/provider-level redirectはinfra owner。

content metadataはlegacy identityを保持できるがprovider configのsecond SoTにはしない。

## Dashboard boundary

normal operationでDashboard設定を要求しない。

Dashboard useは:

- bootstrap
- billing/plan
- account/MFA/recovery
- break-glass
- API/CLI/IaC surfaceが存在しない例外

へ限定する。

emergency manual changeはGit desired stateへreconcileしてからcloseする。

## Build versus external validation

normal site buildは:

- Cloudflare credential不要
- R2 master download不要
- provider API不要

remote R2 availability / protection freshness / production header / redirect verificationはseparate external integration validation。

## Deployment credentials

少なくともconceptually:

- site deploy credential
- public media publisher credential
- protected media operation credential
- infra read/plan credential
- infra apply/admin credential

を別capabilityとして扱う。

permission scope / rotation / storageはinfra SoT。
