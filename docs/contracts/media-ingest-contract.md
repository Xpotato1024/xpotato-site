---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - media ingest request / result contract
  - private canonical raster normalization
---

# Media Ingest Contract

## Purpose

iPhone HEIC / HEIF、JPEG、PNG等のauthor sourceを、privacy-safeな**private canonical media master**へdeterministicに変換する。

このcanonical masterはresponsive/public derivativeのencode sourceであり、Git/public R2へpublishしない。

public delivery master/variantsは後段`media-variant-generation-contract.md`が生成する。

## IngestRequest

```ts
interface MediaIngestRequest {
  schemaVersion: 1;
  sourcePath: string;
  target: {
    contentId: string;
    semanticAssetId: string;
  };
  kind: "photo" | "screenshot" | "diagram";
  profileId: string;
  overwrite: false;
}
```

`sourcePath`はjob/local inputでありpublic manifestへabsolute pathを出さない。

## Supported source classes

initial raster:

- HEIC / HEIF
- JPEG
- PNG
- WebP
- AI-generated raster bytes passed through trusted Article Job artifact boundary

SVGは別trust boundary。trusted/sanitized diagram sourceとしてactive content/script/external ref validation後にvector canonical sourceを維持できる。

animated GIF / videoはinitial scope外。

## IngestProfile

```ts
interface MediaIngestProfile {
  id: string;
  kind: "raster" | "diagram_svg";

  raster?: {
    outputFormat: "webp";
    lossless: true;
    maxLongEdge: number;
    colorSpace: "srgb";
    bitDepth: 8;
    autoOrient: true;
    stripPrivateMetadata: true;
  };

  svg?: {
    sanitize: true;
    allowScript: false;
    allowExternalReferences: false;
  };
}
```

initial raster profile values are defined in `../operations/media-processing-profiles.md`:

```text
canonical-raster-srgb8-lossless-webp-v1
max long edge = 8192
```

## Raster semantics

### photo / camera

- decode source exactly enough for web-normalization pipeline
- apply EXIF/orientation to pixels
- convert to sRGB 8-bit
- strip GPS/EXIF/XMP/IPTC/private comments
- preserve alpha only if source has meaningful alpha
- resize only if long edge > profile limit
- encode private canonical master as lossless WebP

### screenshot / UI raster

same private canonical raster profileを使用する。

Screenshot public encoding policy differs later; ingest stageでphoto-like lossy encodingへ落とさない。

### AI-generated raster

AI raw output has separate generation/provenance record, then can use same canonical pixel normalization.

embedded provenance signal inspection is performed before/around normalization as defined by synthetic-media policy; canonical raster output does not become factual evidence。

## Diagram SVG semantics

sanitized SVG can bypass raster canonicalization when:

- source is trusted/owned or publication rights valid
- no script
- no external reference
- no active event handler
- valid viewBox/dimensions

unsafe/unknown SVG does not get published merely by extension allowlist。

## IngestResult

```ts
interface MediaIngestResult {
  schemaVersion: 1;
  semanticAssetId: string;

  source: {
    detectedFormat: string;
    sourceSha256: string;
    width?: number;
    height?: number;
    orientationMetadataPresent?: boolean;
  };

  canonicalMaster: {
    privateRelativePath: string;
    sha256: string;
    format: "webp" | "svg";
    width?: number;
    height?: number;
    sizeBytes: number;
  };

  processing: {
    profileId: string;
    profileSha256: string;
    toolchainId: string;
    toolchainSha256: string;
    metadataStripped: boolean;
    orientationApplied: boolean;
    resized: boolean;
    colorSpace?: "srgb";
    bitDepth?: 8;
  };

  warnings: string[];
}
```

## Output location

Article Job:

```text
.local/article-jobs/<job-id>/media/canonical/<sha256>/<asset-id>.webp
```

manual ingest:

```text
.local/media-ingest/<run-id>/canonical/<sha256>/<asset-id>.webp
```

path is storage convenience, not identity. SHA-256 is artifact identity。

## Privacy gate

canonical camera/screenshot raster must not retain:

- GPS
- camera/device EXIF not required for rendering
- XMP/IPTC comments
- private filesystem/user metadata

public derivative inherits pixels from privacy-normalized canonical master, not directly from raw source。

## HEIC decoder

HEIC decodeはimplicit host capabilityに依存させない。

`packages/media-ingest` owns pinned container/toolchain with explicit HEIF/HEIC capability self-test。

## Raw source retention

raw source bytes are **not** part of this canonical ingest output and are not automatically uploaded to R2。

Long-term raw retention policy is separate from publication correctness. v1 site pipeline may clean raw job input after export; published exact Web bytes remain protected independently。

## No Git / public mutation

media ingest:

- no Git write
- no public R2 upload
- no protected R2 write
- no Cloudflare API

Article Job / migration downstream stages own variant generation, approval, publication, and protection。
