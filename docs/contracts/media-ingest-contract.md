---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - media ingest request / result contract
  - normalized Web master profiles
---

# Media Ingest Contract

## Purpose

iPhone HEIC / HEIF、JPEG、PNG等のauthor sourceを、privacy-safeな**private candidate Web master**へdeterministicに変換する。

media ingest自体はGit writeもpublic R2 uploadも行わない。

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

`sourcePath`はlocal-only inputであり、public manifestへabsolute pathを出さない。

## Supported source classes

initial:

- HEIC / HEIF photo
- JPEG
- PNG
- WebP

SVGは別trust boundary。diagram sourceとして扱う場合、active content / script / external referenceを考慮したsanitization policyを適用する。

animated GIF / videoはinitial image ingest scope外。

## IngestProfile

```ts
interface MediaIngestProfile {
  id: string;
  kind: "photo" | "screenshot" | "diagram";
  outputFormat: "jpeg" | "png" | "svg";
  maxWidth?: number;
  maxHeight?: number;
  qualityProfileId?: string;
  colorSpace: "srgb";
  autoOrient: true;
  stripPrivateMetadata: true;
}
```

exact pixel / qualityはversion-controlled profileをSoTとし、articleごとに手入力しない。

## Default semantics

### photo

- auto orientation
- sRGB
- private metadata strip
- high-quality JPEG masterを基本候補
- huge camera resolutionをprofile上限へ縮小

### screenshot

- PNG masterを基本
- text / pixel boundaryを維持
- source metadata strip

### diagram

- trusted / sanitized SVGならvectorを維持可能
- raster sourceならPNG等

## IngestResult

```ts
interface MediaIngestResult {
  schemaVersion: 1;
  semanticAssetId: string;
  source: {
    detectedFormat: string;
    sourceSha256: string;
    width: number;
    height: number;
  };
  output: {
    privateRelativePath: string;
    sha256: string;
    format: string;
    width: number;
    height: number;
    sizeBytes: number;
  };
  processing: {
    profileId: string;
    profileSha256: string;
    toolchainId: string;
    metadataStripped: boolean;
    orientationApplied: boolean;
    colorSpace: "srgb";
  };
  warnings: string[];
}
```

## Output location

standard outputはGit working treeではなくprivate workspace。

Article Job:

```text
.local/article-jobs/<job-id>/media/normalized/<sha256>/<name>.<ext>
```

manual ingest:

```text
.local/media-ingest/<run-id>/normalized/<sha256>/<name>.<ext>
```

pathはidentityではない。SHA-256をidentityとする。

## Privacy gate

camera / screenshot public candidateへ次を残さない。

- GPS
- unnecessary device metadata
- private user comments / metadata

AI-generated imageは別provenance policyを持つため、このcontractだけで処理しない。

## HEIC decoder

HEIC decodeはimplicit host capabilityに依存させない。

`packages/media-ingest`がversioned toolchain / containerを所有し、capability testを提供する。

## No Git write

ingest resultを`apps/site/src/assets`等へ直接copyしない。

Article Job candidate / manual publication workflowが後段でsemantic media registryとpublic publicationを扱う。

## No external upload

R2 uploadは`public-media-publication-contract.md`の別operation / permission。

human approval前のArticle Jobからpublic uploadしない。
