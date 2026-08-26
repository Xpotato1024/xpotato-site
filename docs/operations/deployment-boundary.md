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
- build definition / `dist` contract
- application-local Wrangler/static asset config
- site-local route / 404 / path redirect
- logical media asset identity
- content-addressed public media object-key semantics
- MediaPublicationManifest contract
- media delivery/cache requirements
- site-side broken-media detection
- media recovery requirement
- public smoke / validation contract

## Infrastructure repository owns

`Xpotato1024/Xpotato-Server` owns:

- Cloudflare account / zone inventory
- DNS desired state
- R2 bucket resource lifecycle
- custom domain/provider configuration
- zone-level Cache / Compression Rules
- provider-level redirect/rules
- infrastructure credentials / secret handling
- R2 backup/protection backend
- lock/retention/lifecycle for recovery copies
- recovery operation / drills

account ID / zone ID / backup bucket name / credentialをsite repoへcanonical duplicateしない。

## Production target

vNext public site = Cloudflare Workers Static Assetsへstatic site artifactをdeploy。

Cloudflare Pages / VPS static hostingをcurrent targetとして併記しない。

## Public content media

active content mediaはR2-first。

current infrastructure inventory上のwebsite public binary bucket resourceはinfra SoT。siteはlogical object contractだけを知る。

normal Article Job publication:

```text
candidate
 -> preview
 -> human approval
 -> public media publish/reuse
 -> object verification
 -> MediaPublicationManifest
 -> repository export
 -> later site deployment
```

Git revisionが存在しないR2 objectを指さないよう、repository export前にrequired objectをverifyする。

## Public media mutation credential

Article Job preview / buildはR2 write credential不要。

`article media publish`だけがscoped object-write capabilityを必要とする。

credential design requirements:

- bucket/account admin権限を通常publisherへ与えない
- normal publishでbucket configurationを変更できない
- credential bytesをGit / Article Job artifactへ保存しない
- delete/lifecycle/lock operationをnormal article publisherの責務にしない
- credential provisioning/revocationはinfra owner

providerで実現可能なexact permission粒度はimplementation時に`Xpotato-Server`で確定する。

## Media recovery boundary

site owns expected object SHA/key/size and recovery requirement。

infra owns protected recovery copy / restore mechanism。

`contracts/media-recovery-contract.md`をcross-repo semantic boundaryとする。

public `xpotato-assets` objectが唯一のrecovery copyにならないことをtargetとする。

## R2 garbage collection

normal Article Job / site deployはpublished objectをdeleteしない。

GCはseparate privileged operation。

GC planner must consider:

- current Media Registries
- retained legacy/release Git refs as policy requires
- active publication manifests
- recovery protection status
- grace period

exact implementationはinfra + site inventory boundaryを設計してから有効化する。

## Redirect boundary

Static Assets `_redirects`等で表現可能なapplication path redirectはsite repo。

WordPress `/?p=...`等のquery/domain/provider-level redirectはinfra owner。

content metadataはlegacy identityを保持できるがprovider configのsecond SoTにはしない。

## Build versus external validation

site buildは:

- Cloudflare credential不要
- R2 master download不要
- provider API不要

remote R2 availability / production header / redirect verificationはseparate external validationとして実行する。

## Deployment credentials

site deployment credential、media publisher credential、infra admin credentialを同一credential前提にしない。

permission scope / rotation / storageはinfra SoT。
