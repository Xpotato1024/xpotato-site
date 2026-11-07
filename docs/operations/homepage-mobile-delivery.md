# ホーム冒頭のモバイル画像候補

この文書は `home-workshop-mobile-v1` の実装候補と検証方法を記録する。本番採用・配備の承認ではない。

## 変更範囲

- 既存の凍結済み工作台写真と2400×1350の正規化済みマスターを保持する。
- 430 CSS px以下だけ、幅1600・高さ1350・左464・上0の切り出しを使う。左位置は `(2400 - 1600) × 0.58`。現在のCSSの `object-position: 58% center` と合わせ、表示範囲の構図を保つ。
- 431px以上は既存の写真・srcset・sizesをそのまま使う。CSS、色、フィルター、文字、ボタン、フォントには変更を加えない。
- 新しい幅640/960/1280は高さ540/810/1080。従来の幅960/1440/1920と縦方向の画素数を一致させる。sizesも従来960pxの2/3である640pxとし、高DPR向けの画素を単純な100vw指定で減らさない。
- AVIF品質55・WebP品質82・JPEG品質86を保持する。新しい生成profileは `apps/site/src/lib/home/home-workshop-mobile.ts`。既存の `photo-hero-v1` は変更しない。

## 来歴と配備境界

通常のローカルbuildで、既存の凍結済みマスターから9個のcontent-addressed配信用派生物を作る。新しい写真・正規化マスター・外部画像を取り込まない。ネットワーク、R2、Cloudflare、保護ストレージへの操作はない。

既存の候補fingerprint、検証済みbuild binding、ソースマスターhash、Sharp toolchain hashに、新profile hashと9個の正確なobject hash/寸法/byte数を結ぶ。`reviewed-recipe.json` とreleaseの正確な許可表も同期する。元の13個は不変、合計22個すべてを必須とする。任意のraster、別のパス、同じkeyの異なるbytesを許可しない。Gitには派生画像bytesを追加しない。

## 検証

- 高DPRで選ばれるAVIFは177,423 bytesから135,167 bytesへ、23.8%減。両方とも縦1080px。
- その他のモバイルAVIFは640wが41,397 bytes、960wが83,073 bytes。
- 320/390/412/430px・DPR2.625でhero部分を前後撮影し、構図・文字・寸法を比較する。431/760pxとdesktopでは同一画素を確認する。
- DPR2/2.625/3、430/431px境界、760/761px境界、200%文字、画像失敗時の背景・レイアウト・メニュー、キーボード移動と戻る操作を検査する。
- Lighthouseは同じローカルサーバー、圧縮、ブラウザー、viewport、throttlingとキャッシュ条件で前後を複数回比較する。実サイトのPSI値と直接差し引かない。スコアやfield Core Web Vitalsの改善を保証しない。

カルーセルはgroup/slideの意味と操作を維持したまま、track/slideの要素をdivにする。axeの `aria-allowed-role` はWCAGタグだけでは実行されないため、既存WCAGルールに明示追加し、意図的なli/groupの不適合fixtureで検出を確認する。
