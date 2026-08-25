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

撮影・取得・生成した source media の形式を author に意識させすぎず、公開時には privacy-safe、traceable、responsive、cacheable な Web media へ変換する。

特に iPhone 由来 HEIC / HEIF を通常 input として扱い、AI-generated hero では provenance を失わないよう camera media と異なる metadata policy を適用する。

## Media states

画像を 3 層に分ける。

```text
raw source / generated raw
  | ingest / normalize
  v
web master
  | build / edge transform
  v
delivery variants
```

### Raw source

撮影・export・生成された元ファイル。

- HEIC / HEIF
- JPEG
- PNG
- WebP
- generated provider output 等

raw source は public site repository の正本にしない。

camera source は位置情報等の privacy metadata を含む可能性がある。AI-generated source は逆に C2PA 等の provenance metadata を含む可能性があるため、同じ strip policy を無条件適用しない。

### Web master

公開用 derivative を生成するための正規化済み source。

camera / screenshot:

- orientation 済み
- sRGB を基本とする
- GPS / EXIF / XMP / IPTC 等の不要 / private metadata を除去
- Web 用として過剰な pixel size を抑制
- semantic filename

AI-generated:

- decoded / normalized dimensions and color space
- selected crop / safe-area treatment
- public deliveryに不要な metadata は整理できる
- ただし normalization 前に provider provenance signal を検査・記録し、generation manifest を別SoTとして保持する

public derivative から embedded provenance metadata が失われても、origin を `human_camera` と誤分類しない。

写真は高品質 JPEG、pixel-perfect screenshot / transparency が必要な画像は PNG、vector graphic は SVG を基本候補とする。exact quality / max dimension は machine-readable ingest profile で管理し、この文書に数値を第二の SoT として固定しない。

### Delivery variants

browser に配信する最終形式。

通常は width ごとの responsive variant と AVIF / WebP / fallback image を自動生成する。author が手作業で複数形式を保存しない。

## Media origin classes

machine-readable origin を少なくとも区別する。

- `camera`
- `screenshot`
- `generated`
- `deterministic_graphic`
- `external_source`

origin に応じて privacy、provenance、alt / disclosure、factual-evidence eligibility を変える。

`generated` visual は `synthetic-media-policy.md` に従い、factual evidence ref として扱わない。

## iPhone / HEIC policy

Apple の High Efficiency 撮影で生成される HEIF / HEIC を入力として許可する。

author に iPhone camera setting を Most Compatible / JPEG へ変更させることを標準手順にしない。

ただし Astro が通常利用する Sharp の prebuilt image stack だけで HEIC decode が常に利用できるとは仮定しない。media ingest は build image とは責務を分け、HEIC decode capability を明示的に持つ tool / container を使用する。

implementation candidate:

1. dedicated ingest container で HEIC / HEIF を decode する。
2. auto orientation を適用する。
3. sRGB web master へ変換する。
4. privacy metadata を strip する。
5. master size profile を適用する。
6. clean filename で target content directory へ出力する。
7. output path / dimensions / file size / Markdown snippet を表示する。

Sharp を post-process に使う場合、metadata strip / sRGB / resize の behavior を test する。HEIC decode capability は暗黙の optional native dependency に依存させない。

## AI-generated media provenance

AI image provider の raw output は immutable artifact として private Article Job workspace に保持する。

normalization 前に可能な範囲で:

- provider / model identity
- request / prompt hash
- raw bytes hash
- embedded C2PA / watermark verification result

を generation record へ固定する。

C2PA 等の metadata は resize / format conversion / platform upload で失われることがあるため、embedded metadata 自体を唯一の provenance SoT にしない。

selected public derivative は raw artifact hash と generation record へ lineage を持つ。

詳細は `synthetic-media-policy.md` と `article-artifact-model.md` を正とする。

## File naming

公開用 asset は ASCII kebab-case を基本とする。

`IMG_1234.HEIC` や provider の random output name を public identity にしない。

例:

```text
src/assets/content/blog/nas-memory-upgrade/
  nas-board-overview.jpg
  sodimm-slot-closeup.jpg
  hero-concept.jpg
```

filename rename は content semantics を表すが、alt text の代替ではない。

## Default local image path

通常の article photo / screenshot / normalized hero は `src/assets/content/<collection>/<slug>/` に web master を置く。

ordinary inline image は Markdown image syntax を使えることを優先する。

Astro の responsive image behavior を global に設定し、local image の Markdown `![]()` でも `srcset` / `sizes` / dimensions を生成できる構成を target とする。

`public/` は build-time image optimization を受けないため、通常の記事画像の標準配置先にしない。

## Content modules

普通の画像は Markdown を使う。

次の場合だけ module を使う。

- caption / credit / origin disclosure: `Figure`
- multiple image layout: `Gallery` / `MediaGrid`
- before / after: `Comparison`
- full-bleed / hero treatment: dedicated semantic variant
- interactive media: page-local Demo / island

alt text は article context に依存するため image file metadata ではなく MDX / content metadata 側で管理する。

## Hero / OGP derivative

hero visual と social card を分離する。

hero master は visual content、OGP は必要なら site-owned deterministic renderer が hero + real title/category/brand を合成する。

image generation model に article title の正確な raster text 描画を依存しない。

## R2 media mode

次は R2 を候補とする。

- gallery 等で image count が多い
- repository / Git history を大きくする asset
- downloadable original / large binary
- article source と独立して長期配信する media

R2 に置く場合も raw camera source を直接公開せず、原則として privacy-safe web master / distributable asset を置く。

AI-generated raw provenance artifact を private retention 用 R2 等へ保存する場合、public asset domain と storage policy を分離する。

public path は versioned / immutable とし、同じ URL の破壊的上書きで過去 Git revision の見え方を変えない。

### Edge image transformation

R2 / remote master へ Cloudflare Images Transformations を適用できる場合、responsive width と `format=auto` を edge で生成する方式を選べる。

この機能を baseline requirement にはしない。plan / cost / provider setting を確認し、enabled の場合だけ `R2Picture` 等の module から利用する。

Cloudflare Images は HEIC input を扱えるが、public raw HEIC に privacy metadata を残す設計を正当化する理由にはしない。

## Loading policy

- LCP candidate / first-view hero: lazy load しない。実測に基づき `fetchpriority=high` 等を検討する。
- below-the-fold image: lazy loading を基本とする。
- image は width / height または aspect ratio を持ち、CLS を防ぐ。
- decorative image は empty alt、content-bearing image は meaningful alt を持つ。
- generated hero は alt と origin/disclosure policy を `synthetic-media-policy.md` に従って解決する。

## Ingest command contract

将来の deterministic entrypoint は例えば次の責務を持つ。

```text
media ingest <source> --collection blog --slug <slug> --name <name> --kind photo
```

exact CLI は implementation SoT で定義する。

重要なのは:

- HEIC / HEIF を含む input detection
- origin classification
- overwrite 防止
- privacy metadata strip or provenance preservation according to origin
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
- camera derivative に GPS / private EXIF が残っていない
- AI-generated derivative が generation provenance ref を失っていない
- responsive output が representative route で生成される

## Sources

- Apple HEIF / HEVC: https://support.apple.com/ja-jp/116944
- Astro images: https://docs.astro.build/en/guides/images/
- Sharp metadata behavior: https://sharp.pixelplumbing.com/api-output/
- Sharp installation / prebuilt formats: https://sharp.pixelplumbing.com/install/
- Cloudflare Images formats: https://developers.cloudflare.com/images/get-started/limits/
- OpenAI provenance signals: https://help.openai.com/en/articles/8912793-c2pa-and-synthid-in-openai-generated-images
