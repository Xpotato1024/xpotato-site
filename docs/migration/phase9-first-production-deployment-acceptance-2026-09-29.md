---
status: canonical
owner: architecture
accepted_at: 2026-09-29
canonical_for:
  - Phase 9 first production deployment acceptance
  - first live vNext Worker operation result
---

# Phase 9 First Production Deployment Acceptance — 2026-09-29

## Decision

The first production deployment of the vNext Site is **ACCEPTED / COMPLETE**.

This record adopts the already completed operation result; it does not grant standing permission for any future deploy or provider mutation.

## Exact release identity

```text
site_revision: b9554ed43d5b743dfe99efc80ad5474535ad72cd
server_website_authority: c54a06ee377cae365af623b598ed852c4b577e1f
github_workflow: vNext CI
run: 36444062181
attempt: 1
artifact_id: 10979514770
artifact_digest: sha256:409169600d7124fe54f927e4145a0a95d3270d5bfb79c267dbe479b251f306ca
wrangler: 4.136.1
```

The Build-once artifact was consumed without rebuilding or rewriting the staged package.

## Accepted live result

```text
deployment_id: 27ff84b7-e591-4607-a0e6-33439facb75f
version_id: 52d1f165-e6a7-47b0-9965-30286fbaa2c0
traffic: 100%
bindings: 0
r2_bindings: 0
workers_dev: false
preview_urls: false
routes: 0
custom_domain: xpotato.net (unchanged)
```

Seven required public HTTP samples returned 200 and matched the verified staging bytes by SHA-256. The workers.dev endpoint and the actual version preview endpoint both returned 404 without Site content.

This is sampled acceptance at the operation observation time, not a permanent claim about all future provider state.

## Credential and containment result

One operation-specific Cloudflare account token was created under the accepted Decision B JIT contract. Secret-free policy read-back confirmed the exact `xpotato-site` Individual Workers Editor selector and no additional policy/permission groups.

After deployment and post-deploy read-back, the same token ID was revoked successfully. Provider inventory returned zero operation tokens and exact detail read-back returned 404. No persistent production deploy credential remains.

Independent containment capability was confirmed before deployment. Because endpoint suppression succeeded, containment POST count was zero.

## Audit

Focused independent outcome audit:

```text
P0=0
P1=0
P2=0
```

The audit covered release identity, version attribution, single production deployment, traffic, bindings, endpoint suppression, unchanged domain/routes, sampled public bytes, and same-ID token revocation.

## Authorization boundary

The one-time production authorization used for this operation is **consumed and closed**.

Current future state remains:

```text
future_production_deploy_authorized: false
persistent_production_deploy_credential_authorized: false
normal_github_actions_deploy: BLOCKED
publication_hold: ACTIVE
rollback_authorized: false
```

A future deployment requires a new explicit operation authorization and fresh provider preflight.

## Decision B status

The 2026-09-29 operation satisfies the Decision B retirement condition requiring at least one accepted real production operation with artifact validation, provider read-back, endpoint suppression and credential lifecycle verification.

Decision B is **not retired**. The normal GitHub Actions production path remains hard-blocked and has not completed its separate design/activation/real-operation acceptance. Retirement still requires those conditions plus a separate reviewed removal.

## Still pending

This acceptance does not close:

- provider query redirect realization for `?p=34`, `?p=693`, `?p=811`;
- private canonical-source A bucket realization;
- protected C bucket realization or Indefinite Lock;
- public media publication / recovery binding completion;
- publication hold release;
- rollback acceptance;
- legacy cutover or old implementation deletion;
- normal GitHub Actions production deployment activation;
- production Article Job external-provider activation.

Phase 9 and migration/cutover therefore remain open.

## Operational evidence

The operation evidence was fixed under the operator evidence directory:

```text
website-phase9-buildonce-production-readiness-20260929/production-operation/
```

Primary evidence files included `report.md`, `acceptance.json`, `audit.md`, provider post-deploy state, deployed version evidence, and public post-deploy sampling.

Repository files were not changed by the production operation itself.
