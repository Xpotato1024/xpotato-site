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

iPhone HEIC / HEIF、JPEG、PNG等のauthor sourceを、privacy-safeでbuild最適化可能なWeb masterへdeterministicに変換する。

## IngestRequest

```ts
interface MediaIngestRequest {
  schemaVersion: 1;
  sourcePath: string;
  target: {
    collection: string;
    contentId: string;
    semanticName: string;
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

SVGはcamera ingestと別trust boundary。diagram sourceとして扱う場合、active content / script / external referenceを考慮したsanitization policyを別途適用する。

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
- Web masterはhigh-quality JPEGを基本候補
- huge camera resolutionをprofile上限へ縮小

### screenshot

- PNG masterを基本
- text / pixel boundaryを維持
- 不要な再圧縮を避ける
- source metadata strip

### diagram

- trusted SVGならvectorを維持可能
- raster sourceならPNG等

## IngestResult

```ts
interface MediaIngestResult {
  schemaVersion: 1;
  assetId: string;
  source: {
    detectedFormat: string;
    sourceSha256: string;
    width: number;
    height: number;
  };
  output: {
    relativePath: string;
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

## Privacy gate

public derivativeへ次を残さないことを検査する。

- GPS
- camera serial等の不要なdevice metadata
- user comment等のprivate metadata

AI-generated imageはcamera sourceと異なるprovenance policyを持つため、このprivacy strip contractだけでlineageを表現しない。

## Output path

logical target:

```text
apps/site/src/assets/content/<collection>/<content-id>/<semantic-name>.<ext>
```

exact app rootはrepository layout SoTから取得する。

## HEIC decoder

HEIC decodeはimplicit host capabilityに依存させない。

media-ingest workspaceがversioned toolchain / containerを所有し、capability testを提供する。

## No external upload

media ingestはlocal normalized derivative generationまで。

R2 uploadは別operation / permission。
