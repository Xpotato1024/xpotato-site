---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - media ingest pipeline
  - article image ownership
  - responsive image delivery
---

# Media Pipeline

## 目的

撮影・取得した source media の形式を author に意識させすぎず、公開時には privacy-safe、responsive、cacheable な Web media へ変換する。

特に iPhone 由来 HEIC / HEIF を通常 input として扱う。

## Media states

画像を 3 層に分ける。

```text
raw source
  | ingest
  v
web master
  | build / edge transform
  v
delivery variants
```

### Raw source

撮影・export した元ファイル。

- HEIC / HEIF
- JPEG
- PNG
- WebP 等

raw source は public site repository の正本にしない。必要なら private storage / backup で別管理する。

位置情報を含む EXIF 等が残る可能性があるため、そのまま public R2 / `public/` へ置かない。

### Web master

公開用 derivative を生成するための正規化済み source。

- orientation 済み
- sRGB を基本とする
- GPS / EXIF / XMP / IPTC 等の不要 metadata を除去
- Web 用として過剰な pixel size を抑制
- semantic filename

写真は高品質 JPEG、pixel-perfect screenshot / transparency が必要な画像は PNG、vector graphic は SVG を基本候補とする。exact quality / max dimension は machine-readable ingest profile で管理し、この文書に数値を第二の SoT として固定しない。

### Delivery variants

browser に配信する最終形式。

通常は width ごとの responsive variant と AVIF / WebP / fallback image を自動生成する。author が手作業で複数形式を保存しない。

## iPhone / HEIC policy

Apple の High Efficiency 撮影で生成される HEIF / HEIC を入力として許可する。

author に iPhone camera setting を Most Compatible / JPEG へ変更させることを標準手順にしない。

ただし Astro が通常利用する Sharp の prebuilt image stack だけで HEIC decode が常に利用できるとは仮定しない。media ingest は build image とは責務を分け、HEIC decode capability を明示的に持つ tool / container を使用する。

implementation candidate:

1. dedicated ingest container で HEIC / HEIF を decode する。
2. auto orientation を適用する。
3. sRGB web master へ変換する。
4. metadata を strip する。
5. master size profile を適用する。
6. clean filename で target content directory へ出力する。
7. output path / dimensions / file size / Markdown snippet を表示する。

Sharp を post-process に使う場合、metadata strip / sRGB / resize の behavior を test する。HEIC decode capability は暗黙の optional native dependency に依存させない。

## File naming

公開用 asset は ASCII kebab-case を基本とする。

`IMG_1234.HEIC` のような camera filename を public identity にしない。

例:

```text
src/assets/content/blog/nas-memory-upgrade/
  nas-board-overview.jpg
  sodimm-slot-closeup.jpg
```

filename rename は content semantics を表すが、alt text の代替ではない。

## Default local image path

通常の article photo / screenshot は `src/assets/content/<collection>/<slug>/` に web master を置く。

ordinary inline image は Markdown image syntax を使えることを優先する。

Astro の responsive image behavior を global に設定し、local image の Markdown `![]()` でも `srcset` / `sizes` / dimensions を生成できる構成を target とする。

`public/` は build-time image optimization を受けないため、通常の記事画像の標準配置先にしない。

## Content modules

普通の画像は Markdown を使う。

次の場合だけ module を使う。

- caption / credit: `Figure`
- multiple image layout: `Gallery` / `MediaGrid`
- before / after: `Comparison`
- full-bleed / hero treatment: dedicated semantic variant
- interactive media: page-local Demo / island

alt text は article context に依存するため image file metadata ではなく MDX 側で管理する。

## R2 media mode

次は R2 を候補とする。

- gallery 等で image count が多い
- repository / Git history を大きくする asset
- downloadable original / large binary
- article source と独立して長期配信する media

R2 に置く場合も raw camera source ではなく、原則として privacy-safe web master / distributable asset を置く。

path は versioned / immutable とし、同じ URL の破壊的上書きで過去 Git revision の見え方を変えない。

### Edge image transformation

R2 / remote master へ Cloudflare Images Transformations を適用できる場合、responsive width と `format=auto` を edge で生成する方式を選べる。

この機能を baseline requirement にはしない。plan / cost / provider setting を確認し、enabled の場合だけ `R2Picture` 等の module から利用する。

Cloudflare Images は HEIC input を扱えるが、public raw HEIC に metadata を残す設計を正当化する理由にはしない。

## Loading policy

- LCP candidate / first-view hero: lazy load しない。実測に基づき `fetchpriority=high` 等を検討する。
- below-the-fold image: lazy loading を基本とする。
- image は width / height または aspect ratio を持ち、CLS を防ぐ。
- decorative image は empty alt、content-bearing image は meaningful alt を持つ。

## Ingest command contract

将来の deterministic entrypoint は例えば次の責務を持つ。

```text
media ingest <source> --collection blog --slug <slug> --name <name> --kind photo
```

exact CLI は implementation SoT で定義する。

重要なのは:

- HEIC / HEIF を含む input detection
- overwrite 防止
- metadata strip
- orientation
- color space
- dimension / size report
- deterministic output path
- no public upload by default

である。

## Validation

CI / ingest test で少なくとも次を検査する。

- repository に raw `.heic` / `.heif` が新規追加されていない
- article image が `public/` へ無秩序に追加されていない
- image dimension / reference が取得できる
- missing alt がない
- broken local image path がない
- output metadata に GPS / EXIF が残っていない
- responsive output が representative route で生成される

## Sources

- Apple HEIF / HEVC: https://support.apple.com/ja-jp/116944
- Astro images: https://docs.astro.build/en/guides/images/
- Sharp metadata behavior: https://sharp.pixelplumbing.com/api-output/
- Sharp installation / prebuilt formats: https://sharp.pixelplumbing.com/install/
- Cloudflare Images formats: https://developers.cloudflare.com/images/get-started/limits/
