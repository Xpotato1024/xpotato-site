---
status: proposed
owner: content
last_verified: 2026-11-13
---

# 動きを含む記事図版

通常の Article Job に、GIF / animated WebP を読み込む明示的な処理 profile を追加する候補です。記事ごとの HTML 差し替えを行わず、静止画像と同じ原本保存・公開配信・保護コピー・実 bytes 照合を通します。この文書は merge、本人承認、外部送信、R2 保存、配信の許可を与えません。

## 原本と配信用画像

入力は `local_raster` に `animation: { posterAssetId: "motion-poster" }` を指定します。静止 poster も独立した通常の inline asset とし、原本、権利、根拠、画像監査を残します。本文の Figure は動き側の asset だけを指定し、poster はその参照からたどります。本文から参照されず poster にも使われない素材、循環参照、動く poster、hero の animation は拒否します。

`canonical-animation-srgb8-lossless-webp-v1` は全フレームを読み、sRGB / alpha を保った lossless WebP に正規化します。静止画 profile に動画を入力して先頭の一枚だけを残すことは認めません。

| 制限 | 値 |
| --- | --- |
| 一つの入力 / 保存 object | 24 MiB |
| 全フレーム合計画素数 | 64 Mi pixels |
| フレーム数 | 600 以下 |
| 一巡の表示時間 | 120 秒以下 |
| 各方向の画素数 | 8192 以下 |
| 記事の inline asset | poster を含め 24 以下 |

既存の publication package 全体 64 MiB、audit 入力 12 MiB / 64 artifacts、R2 の不変 key、権限、監査、main admission、protected Environment の条件は維持します。上限に収まらない候補は不足として報告し、内容を黙って削りません。

WebP encoder が連続する同じ画素の待ち時間を一つにまとめる場合があります。元と変換後のフレーム数・delay をそれぞれ記録し、**時間軸上の全区間で RGBA 画素、切り替わる時刻、一巡の長さ、loop が一致すること**を決定的に確認します。速度の変更、異なる画素の統合、合計時間だけが同じ変換は拒否します。検証した再生内容の hash は ingest 記録に残します。

`animation-inline-v1` は、元より拡大せず 480 / 768 / 1200 px の lossless animated WebP を生成します。原本がそれらより小さければ原寸の一つを使用し、public master の長辺は 2560 px 以下にします。縮小補間で lossless WebP が大容量になる場合は、その候補を manifest / srcset から除外します。public master と同一 bytes の full-width variant を必ず残し、どの画面幅でも master より大きいダウンロードを選ばせません。各 object の実際の frame / delay / loop を registry に保持します。CI でも原本に同じ縮小処理を行った全表示区間と比較し、別内容にすり替わっていないことを保存前に検証します。

## 画像監査

画像監査は正規の独立した reviewer が行います。animation 原本に加え、最大 12 枚の時系列 contact sheet を private な監査材料として渡します。contact sheet は canonical 動画から再生成し、SHA と frameIndices を照合します。各サンプルは拡大せず 320×240 px の枠内に置き、全体は 1,280×798 px 以下に収めます。サンプルであり「全フレームを目視した」という記録にはしません。全フレームのデコード・画素と時刻の同値検査と、内容の独立した視覚確認を区別します。

根拠に結び付いた screenshot / camera / diagram は、指定した source / evidence / claim と required facts を一致させて扱います。実画面を装飾画像に偽装しません。画像だけから未測定の性能や精度を推定することは禁止します。

## 記事での表示

`delivery.mode: "animated"` と `posterAssetId` を共通 renderer が解決します。記事本文に runtime import や独自 JSX は追加しません。

- 通常は自動再生し、画像の外、図題と同じ下段の右端に停止 / 再生の記号ボタンを一つ置きます。図題がない画像では画像直下の右端に配置し、画像内の文字や動作を隠しません。
- 停止すると独立して監査した poster に戻り、再生で先頭から再開します。
- reduced motion の初期状態と JavaScript 無効時は poster を表示します。
- 操作領域は 44 px 以上とし、aria-label、キーボード操作、focus 表示を持ちます。可視の動作説明や重複した速度の注記は追加しません。
- 動く図版がある記事だけが小さな共有 controller を読み込みます。静止画のみの記事には追加 script を付けません。

配信 master / variants と poster はいずれも従来の正規 object 集合に含まれます。GIF を別の public directory に置く経路、未保存 URL の registry 登録、偽の保存 receipt は用意しません。

固定した表示検査の observations は、実際の caption 文字サイズを `figureTypography` の `captionFontPx` に記録し、caption がない場合は `null` とします。画像に埋め込まれた文字は `embeddedText: "review_in_screenshot"` と明示して独立監査に委ねます。figure に継承された CSS の文字サイズを画像内ラベルの実測値として使いません。新形式では各 viewport で本文 Figure と exact set を取り、旧 `diagramLabelPx` は空にします。旧形式は従来の条件のまま読み込みます。
