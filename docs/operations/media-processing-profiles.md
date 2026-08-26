---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - initial media ingest profile values
  - initial responsive image width/format/quality profiles
---

# Media Processing Profiles v1

## Purpose

media architectureを実装可能な初期数値へ落とす。

architecture contractはprovider-independent、ここはvNext初期site-specific profile。

profile ID変更なしにquality/width/toolchain値をsilent変更しない。

## Core distinction

`master`を2種類に分ける。

### Private canonical raster master

media processingのpixel source。

- Git非管理
- public R2非公開
- Article Job/private media workspaceだけ
- responsive/public derivativeの唯一のencode source

### Public delivery master

公開media set中の最大・高品質fallback/reference object。

- human approval対象
- public R2へpublish
- protected mediaへexact copy
- normal `<picture>`では必要以上に直接配信しない

この分離によりHEIC/JPEG -> JPEG public master -> AVIF/WebPという二重lossy chainを避ける。

## Toolchain profile

initial ID:

```text
media-toolchain-v1
```

requirements:

- pinned container/image digest
- libvips + explicit HEIF/HEIC decode support
- pinned libwebp / AVIF/JPEG/PNG encoder stack
- capability self-test before processing
- encoder/tool version fingerprint in all manifests

exact package patch versionsはimplementation lock/toolchain manifestをmachine SoTにする。

## Private canonical raster profile

ID:

```text
canonical-raster-srgb8-lossless-webp-v1
```

input:

- HEIC/HEIF
- JPEG
- PNG
- WebP
- AI-generated raster

output:

```yaml
format: webp
lossless: true
lossless_compression_level: 6
max_long_edge: 8192
upscale: false
color_space: srgb
bit_depth: 8
alpha: preserve_if_present
orientation: normalize_pixels
private_metadata: strip
```

Rationale:

- lossless pixel intermediate avoids chained lossy encoding;
- WebP lossless supports exact pixel reconstruction and alpha;
- 8192 covers current high-resolution smartphone images while imposing a finite bound;
- WebP dimensional limit is well above 8192;
- sRGB/8-bit is the v1 Web output contract; HDR/wide-gamut preservation is not initial scope。

If source long edge >8192, resize once into canonical master. This is a material pixel transform and is recorded in ingest manifest。

## Photo inline profile

ID:

```text
photo-inline-v1
```

public delivery master:

```yaml
long_edge_max: 2560
format: jpeg
quality: 90
chroma_subsampling: 4:4:4_if_supported_else_encoder_high_quality_default
```

responsive widths:

```text
480, 768, 1200, 1800
```

per width formats:

```yaml
avif:
  quality: 50
webp:
  quality: 80
jpeg:
  quality: 85
```

Use case:

- article photos
- general photographic inline visual
- photographic project visual not treated as hero

The largest normal fallback variant is 1800px; 2560 JPEG public delivery master supports zoom/direct-open and future bounded fallback without exposing camera-native 8K source。

## Photo hero profile

ID:

```text
photo-hero-v1
```

public delivery master:

```yaml
long_edge_max: 2560
format: jpeg
quality: 90
```

responsive widths:

```text
640, 960, 1440, 1920, 2560
```

formats:

```yaml
avif:
  quality: 55
webp:
  quality: 82
jpeg:
  quality: 86
```

Use case:

- Blog hero
- photographic home/site hero
- AI-generated photographic/conceptual raster hero

No source upscaling. If canonical master width is smaller, omit larger widths。

## Gallery profile

ID:

```text
photo-gallery-v1
```

public delivery master:

```yaml
long_edge_max: 1920
format: jpeg
quality: 88
```

responsive widths:

```text
320, 640, 960, 1280
```

formats:

```yaml
avif:
  quality: 48
webp:
  quality: 78
jpeg:
  quality: 82
```

Gallery density favors transfer size slightly more than standalone hero/inline media。

## Project overview profile

ID:

```text
photo-overview-v1
```

public delivery master:

```yaml
long_edge_max: 2560
format: jpeg
quality: 90
```

responsive widths:

```text
640, 960, 1440, 1920
```

formats:

```yaml
avif:
  quality: 52
webp:
  quality: 80
jpeg:
  quality: 85
```

For photographic/raster project overview without screenshot/text-dominant classification。

## Screenshot profile

ID:

```text
screenshot-ui-v1
```

Screenshots are text/edge-dominant; initial profile does not use lossy AVIF/JPEG as primary responsive sources。

public delivery master:

```yaml
long_edge_max: 2560
format: png
lossless: true
```

responsive widths:

```text
480, 768, 1200, 1800, 2560
```

formats:

```yaml
webp:
  lossless: true
  compression_level: 6
png:
  lossless: true
  optimized: true
```

AVIF may be evaluated later for screenshot subclasses, but initial text/UI screenshots favor visual exactness and predictable edge quality。

If a screenshot is already <= one target width, do not upscale/generate larger variants。

## Diagram/vector profile

ID:

```text
diagram-svg-v1
```

trusted/sanitized SVG:

- fixed vector object
- no raster variants required
- script/external active content prohibited
- viewBox required where applicable

Rasterized diagram that cannot remain safe SVG uses `screenshot-ui-v1` or a dedicated later diagram-raster profile rather than photo compression by default。

## Social card profile

ID:

```text
social-card-v1
```

```yaml
width: 1200
height: 630
format: png
lossless: true
responsive_variants: none
```

Social card contains deterministic real title/category/branding text. PNG avoids text artifacts and maximizes social platform compatibility。

Hero visual may be composited/cropped into the social card, but article title is rendered by software, not image generation model。

## Profile selection

initial mapping:

```text
role=hero + raster/photo-like        -> photo-hero-v1
role=inline + photo-like              -> photo-inline-v1
role=gallery + photo-like             -> photo-gallery-v1
role=overview + photo-like            -> photo-overview-v1
screenshot/UI/text-heavy raster       -> screenshot-ui-v1
sanitized SVG                         -> diagram-svg-v1
role=social_card                      -> social-card-v1
```

AI-generated conceptual illustration is classified by pixel character, not origin alone. Text/UI-like synthetic images are still forbidden as factual visuals and do not become screenshots merely because they have sharp edges。

## Candidate/publication consequences

Candidate hash binds:

- canonical master SHA
- selected processing profile IDs/hashes
- public delivery master SHA
- variant manifest SHA
- toolchain fingerprint

Changing quality/width/profile invalidates existing approval。

Public R2 contains only public delivery master + required variants, not 8192px private canonical lossless master。

Protected-media bucket stores exact public delivery object set, not private canonical source master。

## Quality acceptance

Initial numeric values are design defaults, not claims of mathematical optimum。

implementation promotion requires representative fixture review:

- iPhone outdoor photo
- low-light photo
- fine-text screenshot
- dark UI screenshot
- generated hero illustration
- Project overview screenshot/photo

For each, record:

- canonical size
- each variant bytes
- visual diff at 1x/2x DPR
- text edge legibility where applicable
- LCP candidate transfer size

If defaults fail materially, create `v2` profile rather than silently changing `v1` artifacts。

## Current format evidence

WebP lossless reconstructs pixel values losslessly and supports alpha. Current WebP dimension limits exceed the 8192px v1 cap。

References:

- https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification
- https://developers.google.com/speed/webp/faq
