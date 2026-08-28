---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - deployment ownership boundary
  - site/infrastructure media responsibility split
---

# Deployment Boundary

## Lifecycle

This is the vNext **target** deployment boundary. Current Design=`PRE_FREEZE_REVIEW` and implementation/provider mutation are BLOCKED。

Provider counterpart status is only `../architecture/infrastructure-handoff.md`。At current pinned revision, infra ADR-0024 is Proposed and website provider mutation is blocked。

No statement below authorizes current Cloudflare/R2/DNS mutation before lifecycle gates and explicit authorization open。

## Site repository owns

`xpotato-site` target ownership:

- site source/content
- ContentId/routes
- static build/deploy artifact contract
- application-local Wrangler config
- GitHub Actions site CI/deploy workflow
- path redirects/404
- semantic media asset identity
- canonical source hash/profile semantics
- public content-addressed delivery object semantics
- source/public/protection receipt contracts
- durable material-claim/media-recovery provenance semantics
- media delivery/cache requirements
- search/discovery semantics
- site-side validation/recovery acceptance requirements

## Infrastructure repository owns

`Xpotato-Server` target ownership after its provider design is accepted:

- Cloudflare account/zone/DNS facts
- Worker public-domain binding
- actual private canonical source-media resource
- actual public delivery resource/custom domain
- actual protected recovery resource/lock
- provider config desired values
- provider redirects/rules
- credentials/trust boundaries
- protectedObjectRef resolution / restore/drift implementation

Site does not duplicate provider IDs/names/credentials as current SoT。

## Production target after implementation activation

Static deploy artifact -> Cloudflare Workers Static Assets。

CI/CD authority target=GitHub Actions, deploy adapter=Wrangler。

Workers Builds/Pages dashboard build config is not a second production authority。

## Worker deploy versus hostname binding

```text
xpotato-site:
  exact reviewed revision -> GitHub Actions -> build -> Wrangler -> Worker service

Xpotato-Server:
  accepted provider desired state -> zone/DNS/custom-domain -> Worker service
```

Application Wrangler config does not own production DNS/provider binding。

## Media planes

### 1. Private canonical source

Purpose: future deterministic re-encoding。

Site owns SHA/profile/storage-class/receipt semantics。Infra owns actual provider resource/credential/adapter after acceptance。

Target requirements:

- private/no public route
- raw camera original not stored
- privacy-normalized canonical source only
- content-addressed immutable writes
- normal credential no Delete/config admin
- no automatic expiration initially

### 2. Public delivery

Approved public master/variants。

Target:

- content-addressed immutable keys
- public custom-domain/CDN
- immutable Cache-Control metadata
- normal publisher no Delete/config admin

### 3. Protected exact-byte recovery

Exact required public object set。

Target:

- separate private provider plane
- indefinite protection target
- no automatic expiration
- writer no Delete/config/lock mutation

Actual R2 names/settings are infra SoT only after infra acceptance。

## Normal Article persistence sequence

```text
candidate/preview
 -> human approval
 -> canonical source store/reuse + receipt
 -> public delivery publish/reuse + manifest
 -> protected exact-byte copy/reuse + full receipt
 -> durable CompactMediaRecoveryBinding
 -> repository export
 -> later site deploy
```

Git export also requires durable material claim -> evidence/source bindings, not just bundle hashes。

## Credential classes

Target conceptual capabilities:

- Worker deploy
- source-media object read/write
- public media publisher
- protected media writer
- infra read/plan
- accepted normal infra mutation
- R2 configuration admin (operator ephemeral only)

Rules:

- normal site build/Article preview no provider credentials
- data-plane credentials no bucket configuration authority
- public publisher cannot access source/protected planes
- normal Article operation has no Delete/GC authority
- R2 config admin not persisted on CP/site CI

Exact provider permission names are implementation-time infra SoT。

## Configuration admin / Dashboard

Target normal provider config is Git-driven. Security-sensitive R2 configuration mutation uses operator-authorized ephemeral admin capability + read-back validation according to accepted infra design。

Dashboard target scope:

- bootstrap/subscription
- billing
- account/MFA recovery
- break-glass
- true no-programmatic-surface exception

Emergency manual state must be reconciled/reverted before closure。

## Recovery / reprocessing

Future reprofile:

```text
Git canonical source SHA/profile
 -> infra source adapter
 -> exact canonical source retrieval/SHA verify
 -> new variants
 -> new candidate/approval/persistence chain
```

Public object recovery after full Article Job cleanup:

```text
Git Media Registry expected SHA/key
 + Git Publication Provenance mediaRecovery.protectedObjectRef
 -> infra protected-object resolver
 -> restore staging
 -> SHA verify
 -> public key republish
```

Old Article Job workspace/past chat is not normal recovery dependency。

## Garbage collection

Normal Article Job/site deploy deletes no source/public/protected object。

Future GC is a separate privileged ADR/policy and must consider retained Git refs and recovery semantics。Site orphan inference cannot unlock/delete protected bytes itself。

## Redirect boundary

- application path redirect -> site artifact
- query/domain/provider redirect -> infra owner after accepted provider state

Legacy metadata is requirement evidence, not active provider configuration。

## Build versus external validation

Normal deterministic build:

- no Cloudflare credential
- no remote media bytes
- no provider API

External validation after lifecycle permits it:

- exact infra handoff/current accepted state
- source/public/protected object planes
- cache/security headers
- provider redirects/drift
- durable recovery drill

## Activation gate

Before any vNext provider/deployment mutation:

1. site design frozen/implementation gate open as defined by `architecture/design-status.md`
2. infra counterpart exact SHA updated to an accepted/mutation-permitted revision
3. provider exact desired values present in infra machine SoT
4. required plan/read-back evidence available
5. explicit action authorization satisfied

A proposed site or infra ADR alone is not deployment authorization。
