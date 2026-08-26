---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - deployment ownership boundary
  - site/infrastructure media responsibility split
---

# Deployment Boundary

## Site repository owns

`xpotato-site` owns:

- site source/content
- ContentId/routes
- build/deploy artifact contract
- application-local Wrangler config
- GitHub Actions site CI/deploy workflow
- path redirects/404
- semantic media asset identity
- canonical source hash/profile semantics
- public content-addressed delivery object semantics
- CanonicalSourceStorageReceipt / MediaPublicationManifest / MediaProtectionReceipt contracts
- media delivery/cache requirements
- search/discovery semantics
- site-side validation/recovery acceptance requirements

## Infrastructure repository owns

`Xpotato-Server` owns:

- Cloudflare account/zone/DNS
- Worker custom-domain binding
- private canonical source-media R2 resource
- public delivery R2 resource/custom domain
- private protected-media R2 resource/lock
- R2/provider config desired values
- provider redirects/rules
- credentials/secret handling
- restore/drift verification implementation

account/zone/bucket IDs/credentialsをsite repoへcanonical duplicateしない。

## Production target

static deploy artifact -> Cloudflare Workers Static Assets。

CI/CD authority=GitHub Actions、deploy=Wrangler。

Workers Builds/Pages dashboard build settingsをproduction SoTにしない。

## Worker deploy versus hostname binding

site repo:

```text
GitHub Actions -> build -> wrangler deploy -> Worker service
```

infra repo:

```text
Cloudflare zone/DNS -> xpotato.net -> Worker service
```

`wrangler.jsonc`へproduction DNS/domain resource ownershipを重複させない。

## Website media planes

### 1. Private canonical source-media

purpose=future deterministic re-encoding source。

site owns canonical SHA/profile/storage receipt semantics。

infra owns private bucket/resource/credential/read-write adapter。

requirements:

- no public custom domain
- raw camera original禁止
- privacy-normalized canonical source only
- normal credential no Delete/config admin
- no automatic expiration initially

### 2. Public delivery media

public delivery master + prebuilt responsive variants。

- content-addressed immutable keys
- public custom domain/CDN
- immutable Cache-Control metadata
- normal publisher no Delete/config admin

### 3. Protected exact-byte recovery

exact public delivery object set。

- separate private bucket
- indefinite Bucket Lock initially
- no automatic expiration
- writer no Delete/config/lock modification

## Normal Article media sequence

```text
candidate
 -> preview
 -> human approval
 -> private canonical source store/reuse
 -> CanonicalSourceStorageReceipt
 -> public delivery publish/reuse
 -> MediaPublicationManifest
 -> protected exact-byte copy/reuse
 -> MediaProtectionReceipt
 -> repository export
 -> site deploy
```

Git revisionが新media identityを参照する前に3-stage durable chainをverifyする。

## Responsive media

canonical sourceからdeterministic prebuilt variantsを生成する。

Cloudflare Imagesはoptional adapterでありpublication/deploy prerequisiteではない。

## Credential classes

conceptually分離:

- Worker deploy
- source-media object read/write
- public media publisher
- protected media writer
- infra read/plan
- normal infra mutation
- R2 configuration admin (operator ephemeral only)

requirements:

- site build/preview has no R2 credential
- source/public/protected data-plane credentials have no bucket config authority
- public publisher cannot access source/protected planes
- no normal Article operation has Delete/GC authority
- R2 config admin secret not persisted on CP/site CI

exact provider permissions are infra implementation SoT。

## Configuration admin / Dashboard

security-sensitive R2 configuration desired values are Git-managed but mutation uses operator-authorized ephemeral admin credential + CLI/API read-back。

normal Dashboard configurationは禁止。

Dashboard scope:

- bootstrap/subscription
- billing
- account/MFA recovery
- break-glass
- true no-API feature exception

manual emergency stateはGitへreconcileする。

## Recovery / reprocessing

future media reprofile:

```text
Git canonicalSource SHA/profile
 -> infra private source-media fetch
 -> SHA verify
 -> new deterministic variants
 -> new candidate/approval/public/protection chain
```

public object loss:

```text
Git Media Registry expected SHA/key
 -> protected-media restore
 -> SHA verify
 -> public republish
```

source-media planeとprotected-media planeを同じrecovery purposeにしない。

## R2 garbage collection

normal Article Job/site deployはsource/public/protected objectをdeleteしない。

GCはfuture separate privileged policy。

initial protected indefinite lockをsite-side orphan判断だけで解除しない。

## Redirect boundary

- application path redirect -> site static artifact
- query/domain/provider redirect -> infra owner

legacy identity metadata != provider config SoT。

## Build versus external validation

normal build:

- no Cloudflare credential
- no source/public/protected R2 download
- no provider API

external validation:

- public object/headers
- source storage privacy/read-back
- protected lock/receipt/restore
- redirects/provider drift

## References

exact Cloudflare control-plane policy=`cloudflare-control-plane-policy.md`。
