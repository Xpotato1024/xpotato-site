---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - media ingest pipeline
  - media storage plane semantics
  - responsive image delivery
---

# Media Pipeline

## Purpose

Convert media into privacy-safe, reprocessable, responsive, recoverable Web assets without turning Git into binary archive or making old Article Job workspace a recovery dependency。

Current Git already contains ≈4.54MB known raster/photo subset; vNext does not continue media-count-proportional repository growth。

## Layers

```text
raw job/user source
  HEIC/JPEG/PNG/AI raw
      |
      | deterministic ingest
      v
private canonical master
  privacy-normalized lossless WebP / sanitized SVG
      |
      | semantic visual audit
      v
private delivery set
  deterministic AVIF/WebP/fallback
      |
      | candidate + human approval
      v
private canonical source store       public delivery store
future re-encode authority            approved master/variants
                                             |
                                             v
                                  private protected exact copy
                                             |
                                             v
                                  compact mediaRecovery binding
                                             |
                                             v
                                      Git provenance/registry
```

Raw input, canonical source, public delivery, protected exact recovery, and cleanup-safe Git recovery binding are different semantics。

## Placement boundary

Object-storage/off-Git standard:

- camera photo
- screenshot
- raster Blog/Note/Project/Tool visual
- photographic/raster site hero/background
- AI raster
- gallery

Git candidates:

- small deterministic SVG
- logo/favicon/icon
- tiny reviewable design texture/graphic
- synthetic fixture

## Raw source

HEIC/JPEG/PNG/WebP/original screenshot/AI provider raw output。

- no Git commit
- no direct public R2
- no automatic raw-camera copy to private source-media plane
- GPS/device/private metadata is not accumulated as site long-term state
- full job/raw retention follows Article Job retention policy

## Private canonical master

Contract/profile authority:

- `media-ingest-contract.md`
- `operations/media-processing-profiles.md`

Initial raster:

- lossless WebP
- sRGB8
- orientation normalized
- private metadata stripped
- max long edge8192
- no upscale

Purpose: semantic visual audit target, deterministic delivery source, future reprofile source。

## Visual audit then variants

Independent semantic visual audit occurs **before** expensive delivery variants。

Only clean canonical visual/source produces deterministic delivery set:

- finite widths
- AVIF/WebP/fallback or lossless screenshot profile
- no upscale
- profile/toolchain/hash manifest
- no network/provider transform dependency

Cloudflare Images API is not baseline generation path。

## Candidate / approval

Candidate binds:

- canonical source SHA/profile
- delivery set SHA/profile
- rights/provenance
- visual audit
- planned source/public/protection semantics

No persistent source/public/protected object mutation before exact human approval。

## Private canonical source persistence

After approval, if required:

- content-addressed approved canonical source only
- raw camera/provider original prohibited
- private/no public domain target
- no automatic expiration initially
- normal writer no Delete/config-admin target
- CanonicalSourceStorageReceipt

This is future re-encoding authority, not exact current public-byte recovery authority。

## Public delivery persistence

After valid source-storage stage:

- exact approved delivery master/required variants
- content-addressed immutable keys
- same key/different bytes prohibited
- target `Cache-Control: public, max-age=31536000, immutable`
- MediaPublicationManifest

Media Registry maps semantic asset ID to provider-neutral object identities/profile lineage。

## Protected exact-byte persistence

Exact required public object set is copied/reused into separate private protected recovery plane。

Target initial semantics:

- private/no public domain
- indefinite protection
- no automatic expiration
- writer no Delete/config/lock mutation
- full MediaProtectionReceipt

`MEDIA_PROTECTED` means the full receipt is valid, but it is not yet cleanup-safe by itself if receipt-only restore data lives only in the job workspace。

## Cleanup-safe media recovery binding

Before `EXPORTED`, deterministic exporter derives `CompactMediaRecoveryBinding` from:

- exact MediaPublicationManifest
- exact valid MediaProtectionReceipt

Durable Git provenance stores for each required object:

- SHA
- public content-addressed key
- verified size
- protection class/policy fingerprint
- secret-free opaque `protectedObjectRef`

Object set must exactly equal full publication/protection sets。

**Receipt hash alone is not sufficient if full receipt will be deleted with Article Job cleanup.**

After cleanup, normal recovery begins from Git Media Registry + Publication Provenance `mediaRecovery`, then infra adapter resolves `protectedObjectRef` to actual protected bytes。

## Logical MDX reference

```md
![メモリスロット](media:nas-memory-slot)
```

MDX never owns bucket/domain/object key।Renderer resolves Media Registry to responsive HTML。

## iPhone / HEIC flow

```text
HEIC probe/decode
 -> orientation/sRGB/private metadata normalization
 -> lossless canonical WebP
 -> visual audit
 -> deterministic variants
 -> human approval
 -> canonical source persistence
 -> public delivery persistence
 -> protected exact copy/full receipt
 -> compact mediaRecovery
 -> Git export
```

Author is not forced to JPEG capture mode。

## AI-generated media

Raw provider output is private operational artifact during generation/audit。Durable lineage retains provider/model/request/raw hash/origin; approved canonical source goes through same privacy-normalized/persistence path。

AI raw bytes are not launch-required permanent archive and AI visual is not factual evidence。

## Rights

Web-discoverable does not mean republishable。Unknown-rights external media is linked/replaced rather than silently copied into public media plane。

## Delivery adapter

Baseline:

```text
immutable prebuilt public variants
 -> CDN/custom delivery domain
 -> <picture>/<srcset>
```

Cloudflare Images is optional performance adapter and cannot become sole published/recovery identity without new material decision。

## Provider lifecycle

Actual source/public/protected provider resources are infra-owned and currently follow `architecture/infrastructure-handoff.md` lifecycle。This proposed site pipeline does not authorize provider mutation while counterpart sub-gate is blocked。

## Lifecycle / GC

- normal Article Job deletes no source/public/protected object
- protected target initially indefinite
- source/public/protected future GC is separate privileged decision
- full job workspace cleanup only after durable Git claim/recovery lineage + persistence chain validates

## Validation

Deterministic:

- no HEIC/raster content binary in Git
- no direct site-owned provider URL/`r2:/` authoring
- canonical/variant profile and hashes valid
- logical refs/rights/provenance valid
- durable mediaRecovery exactly matches publication/protection lineage

External after provider activation:

- canonical source exact SHA/private status/reprocess fixture
- public delivery exact identity/cache metadata
- protected exact object-set/policy
- recovery starting from durable Git binding restores same SHA without old job workspace
