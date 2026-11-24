---
status: proposed
owner: engineering
last_verified: 2026-11-24
canonical_for:
  - CMS brand geometry and icon asset roles
---

# Xpotato CMS のロゴ・アイコン

2026-11-24に利用者が採用したB-refined（分離型）を基準とする。本文は意匠と配布アセットの仕様であり、PRのmerge・配信・実iPhoneでの受入れを表さない。

## 正本と不変条件

意匠の正本は [通常透過SVG](../../apps/editor/public/xpotato-cms.svg)（512×512）である。サイトロゴは [既存XPロゴ](../../apps/site/public/xpotato-logo.svg) を維持し、CMS固有のペン先と分離表現によって識別する。Xpotato CMSの文字は図柄へ焼き込まず、ヘッダーやOSの名称表示で扱う。

- Xの2本の帯は同色 `#745399`、等幅で、前面の左上→右下の帯が背面の左下→右上の帯を覆う。接触部分のみ暗色 `#5B4177`。ぼかし・光沢・グラデーションは使用しない。
- ペン先は `#13C9BC`。中心線は背面帯の中心線と一致し、先端はXの上辺と背面帯の軸線の交点。Xの右端を超えない。紫の背面帯は交差後も幅を維持し、ペン先との間には実際の透明な隙間を置く。
- ペン先の外周は左右対称の曲線と鋭い先端。元のB-refinedの座標・外形・位置・間隔・色・4つのpath ID・描画順を変更しない。
- PNGの背景は不透明な純白。角丸の焼き込みは行わず、OSに任せる。ヘッダーと通常SVGは背景透明。

採用前の白背景B-refined-app.svgのSHA-256: `6fde5bb5347684c41a10c2686c4a7418110d85729c087a18a7ea4f2e85c571e7`。
通常SVGのSHA-256: `7d636961cba1ddc4f7f46c7d3888d43a31c5b032e569a5df726d8f719f8936fb`。
サイトロゴのXの公称傾斜は atan(375/310) ≒ 50.420595°。CMSのXは元のXを等比変換した比率（405:375、水平端の帯幅比95:405）を保つ。サイトロゴのP部分はCMSでは使用しない。

## 配布と参照

| 用途 | /editor/ 配下のファイル |
|---|---|
| ヘッダー共通 | xpotato-cms.svg |
| 通常PWA（purpose any） | xpotato-cms-192.png, xpotato-cms-512.png |
| Android等のマスク（purpose maskable） | xpotato-cms-maskable-512.png |
| マスク用SVG原本 | xpotato-cms-maskable.svg |
| iOS Apple Touch Icon | xpotato-cms-180.png |
| favicon | xpotato-cms-small.svg, xpotato-cms-16.png, xpotato-cms-32.png, xpotato-cms-48.png |

通常SVGから独立した小サイズ版の差分は内部の穴（直径21→30）とスリット（約5.3→8）のみ。接触影は保持する。maskableは背景以外を中心(256,256)に対し等比縮小する。縮小係数0.816637225、縮小前の最大半径249.8049239、縮小後の幾何学的最大半径204.0px。安全円の半径204.8px。背景は全面の白であり、安全円の制約対象外。

PNGは承認済みSVGから既存のSharp toolchainを用い、`node ops/build/assets/generate-editor-icons.mjs` で再生成できる。初回組み込み時の配布PNGはこのrendererで再生成した固定bytesであり、以前のCairoSVG生成PNGとbyte一致を要求しない。SVG3種は承認済みbytesを維持する。Gitに保持するPNGは限定されたCMS制御アイコン7点のみ。一般の画像・R2媒体の例外は追加しない。配布ハッシュの変更は再生成・検査と同じPRでレビューする。

## 意匠最適化の受入れ記録（2026-11-24）

B-refined-app.svgの穴・スリットを121頂点の折れ線から単一の円弧+直線の閉パスへ置換。白背景込みで3641→1333 bytes（63.4%削減）、透過原本1283 bytes。変更はペン先内部と背景のみ。元と最適化後を同一renderer・512px・白背景で比較した記録はCairoSVGで257画素（0.0980%）、最大チャンネル差19/255、Inkscapeで87画素（0.0332%）、最大差14/255。Xと陰影の差分なし。完全な画素一致ではない。

元の検証用maskable PNGでは非白画素の四隅の最大半径204.502px（204.8px未満）。小サイズは白背景・暗色背景で48pxの穴とペン先、32pxのXと青緑の先端を識別できる。16pxでは色・大まかな方向は判別できるが万年筆の穴・スリット・分離の詳細は難しい。配色や外形を変更して改善した扱いにはしない。実OSのマスクおよびPWAの更新/インストールは別の実機受入れとする。

## 保守

通常版の幾何形状を変更する判断は別の明示的な意匠レビューを必要とする。用途別派生は本仕様の範囲に限る。公開サイトのXPロゴ、Primeのアイコン、テーマ色、PWA ID/scope/start_url、Access、CSP、GitHub/R2権限をこの意匠変更で変更しない。
