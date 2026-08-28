---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - Cloudflare dashboard usage boundary
  - Cloudflare infrastructure automation target policy
  - GitHub Actions deployment ownership target
---

# Cloudflare Control Plane Policy

## Current lifecycle warning

This is a **vNext target policy**, not current provider authorization。

Current exact infra counterpart/status is only:

- `../architecture/infrastructure-handoff.md`

At the pinned revision, `Xpotato-Server` website ADR-0024 is **Proposed**, website sub-gate is **OPEN / provider mutation BLOCKED**, and proposed website exact resource values are not active production `inventory/desired` state。

Therefore this document must not be used to create/update R2/DNS/Worker/rules until both design lifecycles are accepted and explicit mutation authorization exists。

## Goal after acceptance

Normal site deploy/media operation/provider reconcile should not require Cloudflare Dashboard clicks。

**Dashboard = bootstrap / billing / account recovery / break-glass / true no-programmatic-surface exception.**

Normal desired state is Git-driven and reconciled through GitHub Actions/Wrangler/OpenTofu/official API/CLI according to ownership/trust boundaries。

Minimize Cloudflare-specific state: use standard object/HTTP/static semantics unless measured need justifies provider-specific rule。

## Target Cloudflare surface

After infra acceptance, minimum website vNext provider capabilities are expected to include:

1. `xpotato.net` -> site Worker custom-domain binding
2. private canonical source-media object plane
3. public website delivery media plane + public custom domain
4. separate private protected exact-byte recovery plane
5. protected-media indefinite lock target
6. required provider-level legacy query/domain redirects
7. existing account/zone/DNS state owned by infra repo

**Initially not required:**

- Workers Builds/Pages Git integration
- Cloudflare Images Transformations
- request-time media Worker
- custom media Cache Rule solely for immutable TTL
- custom Compression Rule without evidence
- CORS for normal `<img>/<picture>` use

Actual resource names/IDs are not site SoT and are not adopted while infra ADR-0024 remains Proposed。

## Why no initial custom media Cache Rule

Public content-addressed delivery objects carry target metadata:

```text
Cache-Control: public, max-age=31536000, immutable
```

Use normal CDN/origin cache semantics first。Add provider Cache Rule only for an actual measured/semantic requirement such as special file type, distinct edge/browser TTL, or deliberate tiered caching。

## Why no initial R2 CORS

Normal `<img>/<picture>` rendering does not require browser JS fetch/canvas access。If a later Tool/Demo needs fetch/canvas, add narrowly scoped origin/method/header policy as a reviewed provider change。

## Control-plane classes

```text
A. site application deploy
   xpotato-site GitHub Actions -> Wrangler

B. normal provider desired state
   Xpotato-Server Git -> OpenTofu where appropriate
                      -> official API adapter for gaps

C. security-sensitive R2 configuration
   accepted infra desired values
     -> operator-authorized reconcile
     -> ephemeral config-admin capability
     -> read-back validation

D. object data plane
   Article Job / migration -> source/public/protected scoped credentials
```

Dashboard is not a normal A-D stage。

## Repository ownership

### xpotato-site

Owns:

- static build/deploy artifact
- Worker application-local identity/config
- GitHub Actions site CI/deploy definition
- provider-neutral source/public/protection object semantics
- HTTP metadata requirements
- validation requirements

### Xpotato-Server

Owns after accepted provider design:

- Cloudflare account/zone/DNS facts
- Worker custom-domain binding
- actual source/public/protected media resources
- R2 custom-domain/lock/lifecycle/CORS if used
- provider redirects/rules
- credentials/trust boundary
- restore/drift/read-back implementation
- provider adapter/version

Site does not copy account/zone/bucket IDs or credentials。

## Worker deploy versus hostname binding

Target:

```text
xpotato-site:
  reviewed Git revision -> GitHub Actions -> wrangler deploy -> Worker service

Xpotato-Server:
  zone/DNS/custom-domain -> xpotato.net -> Worker service
```

Wrangler config owns application/static-assets settings only, not production DNS/provider resource ownership。

## OpenTofu versus official API adapter

Selection order:

1. provider-supported OpenTofu/Terraform resource when compatible with trust boundary
2. official REST API/Wrangler
3. narrow version-controlled reconcile adapter
4. Dashboard only when no official programmatic surface exists

A reconcile adapter must have Git input, current read, diff/plan, explicit mutation authorization, read-after-write validation, idempotence。

## R2 configuration trust boundary

Git-driven does **not** mean persistent R2 configuration-admin credential。

Target security-sensitive bucket config operation:

- desired value is recorded only after infra decision acceptance
- operator explicitly authorizes reconcile
- ephemeral admin token/session injected
- read-back validation
- admin capability not persisted on CP/site CI/Git/SOPS normal stores

Data-plane Article Job credentials must not change bucket/custom-domain/lock/lifecycle config。

## Three media data planes

### Private canonical source

- privacy-normalized canonical master only, not raw camera original
- private/no public route
- content-addressed
- normal writer no Delete/config admin target
- future re-encode authority

### Public delivery

- approved delivery master + prebuilt variants
- public custom domain/CDN
- content-addressed immutable keys/cache metadata
- normal publisher no Delete/config admin target

### Protected exact-byte recovery

- exact public required object set
- separate private plane
- indefinite protection target
- no automatic expiry target
- writer no Delete/config/lock mutation

Exact provider resources are resolved only through accepted infra SoT, not this document。

## Normal Article Job object operations

After human approval:

```text
canonical source store/reuse
 -> public delivery publish/reuse
 -> exact protected copy/reuse
 -> durable recovery binding
 -> Git export
```

Article Job never receives R2 configuration-admin capability。

Potential provider temporary/path/action credentials are implementation candidates only; parent credential trust must also be reviewed。

## Cache / compression / redirects

Target initial policy:

- application path redirects -> site artifact where possible
- query/domain redirects -> infra provider rules
- media TTL -> immutable object metadata + standard cache behavior
- custom Cache/Compression/CORS only with approved measured/semantic requirement

No manual Dashboard rule as normal state。

## Responsive media portability

Baseline:

```text
canonical source
 -> deterministic prebuilt AVIF/WebP/fallback
 -> immutable public objects
 -> CDN/browser
```

Cloudflare Images is optional and cannot be sole correctness path。

## GitHub Actions as CI/CD target

Once implementation/provider gates open:

```text
PR -> deterministic CI/build
approved production deploy -> exact artifact -> Wrangler -> smoke
```

Do not keep Workers Builds as second authority. Site workflow does not mutate zone/R2 config。

## Credential bootstrap

Complete Dashboard-zero is not a goal. Dashboard may be required for account/service onboarding, billing, first bootstrap credential, MFA/ownership/recovery。

Target separated capabilities:

- Worker deploy
- source-media data plane
- public media publish
- protected media write
- infra read/plan
- accepted normal infra mutation
- R2 configuration admin (operator ephemeral only)

## Dashboard exceptions / break-glass

Allowed:

1. account/zone/service bootstrap
2. billing/plan
3. first credential bootstrap
4. MFA/account ownership/recovery
5. break-glass incident recovery
6. no official programmatic surface

Emergency manual mutation must be recorded, then reconciled into accepted Git state or reverted, followed by drift clean + temporary privilege cleanup。

## Validation

Before provider activation:

- exact infra handoff SHA/status matches
- infra sub-gate permits mutation
- accepted website exact values exist in infra machine SoT
- no mutable branch head used as authority

After activation:

- deploy workflow Git-controlled
- no Workers Builds dependency
- expected source/public/protected state only
- no unexplained manual drift
- R2 config admin absent from persistent site/CP credential boundary
- public custom domain/cache metadata correct
- protected policy/private status correct
- custom CORS/Cache/Compression absent unless explicitly adopted
- no content depends solely on Cloudflare Images

## Current supporting references

Provider capability facts are time-sensitive and reverified at acceptance/implementation. Examples:

- Workers external CI/CD
- Worker custom domains
- R2 API/auth/temporary credentials/bucket lock
- R2 custom-domain caching
- Cloudflare cache/rules APIs

Exact provider versions/permission names do not belong in this proposed architecture prose。
