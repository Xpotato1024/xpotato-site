---
status: proposed
owner: architecture
last_verified: 2026-08-26
---

# ADR-0018: Protect R2 media before repository export

## Context

ADR-0014 makes photographic/raster content media R2-first so Git history does not scale with media bytes.

ADR-0015 delays public media upload until the exact candidate has human approval.

This creates a new failure mode: after public R2 upload, a Git revision could reference an immutable object whose **only recoverable copy** is the public delivery bucket.

Content-addressed keys prevent destructive overwrite, but they do not protect against object deletion, credential compromise, account/operator error, or provider-side loss.

`Xpotato-Server` already uses a destruction-resistant protected-copy / Bucket Lock pattern for backup recovery, providing an infrastructure precedent without requiring the site repository to own Cloudflare bucket/credential state.

## Decision

For Article Job publication, successful public R2 upload is not sufficient for repository export.

Required path:

```text
HUMAN_APPROVED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

`MEDIA_PROTECTED` requires a validated protection receipt covering the exact object set in the MediaPublicationManifest.

Initial vNext protection level is a **destruction-resistant protected copy inside the Cloudflare infrastructure boundary**.

Provider-independent media copy is not a launch hard requirement; it remains an infrastructure-wide disaster-recovery evolution rather than a site-level dependency.

## Ownership

`xpotato-site` owns:

- object SHA / key / size identity
- protection requirement
- typed protection request / receipt
- Article Job state gate
- repository validator that verifies publication/protection lineage

`Xpotato-Server` owns:

- protected bucket/prefix
- Bucket Lock / lifecycle / retention values
- object-copy implementation
- credentials / permission separation
- restore procedure and drills

Provider IDs or backup credentials are not duplicated into site SoT.

## Failure semantics

If public R2 publication succeeds but protection fails:

- do not export Git content/registry referencing the new object
- leave the Article Job at `MEDIA_PUBLISHED`
- keep candidate and human approval immutable
- retry protection idempotently against the same content-addressed object

Unreferenced public objects may temporarily exist, but they are not published site content until repository export/deploy references them.

## Migration

Legacy media migration may use a migration-operator authorization rather than per-article human approval, but the same protection requirement applies before old Git/raster copies are removed.

Migration cutover requires a representative restore from the protected copy with SHA-256 equality.

## Consequences

Positive:

- Git can safely stop carrying photographic/raster media bytes.
- public delivery R2 is not the only recovery copy.
- failed protection cannot silently create an unrecoverable Git revision.
- protection implementation stays in the infrastructure repo.

Costs:

- publication gains one external infrastructure step.
- media publication can succeed while Git export remains blocked.
- infra must add website-media protection desired state and validation.

These costs are accepted because R2-first storage without recovery protection would trade Git scalability for a weaker durability model.
