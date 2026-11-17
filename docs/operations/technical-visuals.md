---
status: proposed
owner: content
last_verified: 2026-11-15
---

# 数式・構成図・データ図を制作する

記事・ツールの図版をローカルで作る実装候補。公開用 JavaScript、iframe、新しい承認・保存状態は増やさない。図は [Figure/Gallery](../content/figure-standard.md) と semantic media に渡す。単純なカテゴリ比較は、文字・数値を直接読める既存の BarChart を優先する。回路・CAD・simulation は[実データによる素材制作](engineering-visuals.md)の範囲であり、模式図で実行結果を代用しない。

## 数式

既存の KaTeX 0.19.0 による build-time MathML を使う。client renderer、MathJax、数式用フォントファイルは追加しない。数学の字形へ本文フォントを強制しない。本文では記号の意味を定義する。

````md
```math label="分数の加算"
\frac{1}{2}+\frac{1}{3}=\frac{5}{6}
```

```math label="行列"
\begin{pmatrix}1&2\\3&4\end{pmatrix}
```

```math label="式の変形" print="source"
\begin{aligned}2x+4&=10\\2x&=6\\x&=3\end{aligned}
```
````

label は必須。長い式・`print="source"` は既存の印刷用 TeX 原文に切り替わる。画面ではラベルのある領域を Tab で選び、矢印キーで横に読める。式 4096 文字、展開 100 回、サイズ 8 の既存上限を維持し、invalid TeX・URL・HTML・任意色/style・macro 定義を拒否する。

`$...$` / `$$...$$` は今回追加していない。portable MDX の式・波括弧構文と通貨を安全に区別する専用 tokenizer が必要になるため、既存の fence を正規構文とする。`$5`、`$10`、inline code 内の `$x$` を変換しない。label/print の旧構文は維持する。

## 共通 CLI

Node/npm は repository pin を使い、依存は root lockfile から導入する。出力先の親 `.local` が存在する状態で、**まだ存在しない絶対 directory** を指定する。既存出力・symlink/junction/hardlink・親外への逃走を拒否する。以下の `<repo>` はこの checkout の絶対パスに置き換える。

```sh
npm run content:visual -- mermaid --input templates/technical-visuals/flow.mmd --output <repo>/.local/flow-review
npm run content:visual -- chart --input templates/technical-visuals/line.json --output <repo>/.local/line-review
npm run content:visual -- chart --input templates/technical-visuals/scatter.json --output <repo>/.local/scatter-review
npm run content:visual -- chart --input templates/technical-visuals/bar.json --output <repo>/.local/bar-review
```

Mermaid はインストール済み Chrome/Chromium を使う（WindowsではEdgeも既定候補）。必要なら `CHROME_PATH` に Chromium 系ブラウザーの絶対 executable を指定する。専用 profile を出力 directory 内の runtime に作り、CDPのBrowser.close後に終了を確認して削除する。期限内に終了しない場合は、その専用child handleが生存していることを確かめて所有process treeだけを終了し、graceful/forcedと終了確認をreceiptへ記録する。終了未確認なら成功にしない。個人の profile は使わない。ブラウザーの security/sandbox を無効にする引数は付けない。Vega は Node 内で静的 SVG を生成し、既存のSiteフォント検証・アウトライン化helperで文字をpathへ変換してからSharpでPNGを作る。Mermaidは描画前にSiteの使用字形に対応するローカルfont subsetを専用browserへ読み込む。両方ともフォントの実hashと欠字を確認し、フォントファイルは出力しない。

共通出力は元 source、`figure.svg`、`poster.png`、`description.txt`、`receipt.json`。chart は `data.json`（正確な値）・`data.csv`（表計算の formula escape あり）・`data.md`（読むための表）、Mermaid は `structure.json`（節点と関係）も出す。receipt は入力/output hash、実 tool 版、CSS に由来する theme/hash、寸法・予算・検証範囲だけを記録する。**事実検証・権利・独立監査・本人承認・公開の証拠ではない**。成功 receipt は worker と browser の終了後に最後に書き、失敗時は所有する新規出力を除去する。

入力 64 KiB、40 nodes / 80 edges、500 rows、SVG 2 MiB / 12000 nodes、最大辺 4096 / 面積 12 Mi pixels、worker heap 384 MiB、全体 45 秒を上限とする。Mermaid の browser は通信 offline・service worker 禁止・全 request 拒否、bundle は固定 local npm bytes。図版入力を外部 AI/provider へ送らない。

## Mermaid の許可範囲

実 Mermaid 12.3.0 の flowchart のみ。先頭は `flowchart TB/TD/LR/RL/BT`、`accTitle:`（4–120文字）・有用な `accDescr:`（16–1000文字）、宣言済み node の `ID["ラベル"]`、`ID --> ID` / `ID -->|関係| ID` を各行に書く。node label 48文字、edge label 32文字まで。コメント・frontmatter/config directive・HTML label・click/action・class/style・外部 image/font/link・未知 graph type は受け付けない。sequence/class/architecture-beta 等を対応済みとは呼ばない。

配色と本文の type role は `global.css` / `design-roles.json` から共通 adapter が解決する。図中に記事見出しと重なる装飾タイトルを置かず、タイトルと説明は SVG のアクセシビリティ情報と Figure に分担する。

狭幅の本文 280 px へ縮小したラベルが 14 px 未満になる横長図は失敗させる。短い label・TB への再配置、または意味のある段階に source を分けて別 Figure/縦 Gallery にする。分割図には前後の接続を文章で補う。単一の横長図を小さく潰して納品しない。ラベルと本文の名称をそろえ、構造の説明も本文へ残す。

## Vega-Lite の許可範囲

実 Vega-Lite 6.5.0 → Vega 6.4.0 の静的 SVG。入力は template の単一 view subset に限定する。top-level は `title, description, data, mark, encoding` のみ、`mark` は `line / point / bar`。`data.values` は inline のみ、各行は x/y の field だけ。

- x/y は `field, type, title` と任意の `scale.domain` だけ。unit を title の括弧内に明記する（カテゴリも `試料 (分類)`）。
- line/point の両軸、bar の y は quantitative。bar の x は nominal。line の x は厳密な昇順。line/bar の x/category 重複は事前に根拠を持って集計する。
- `scale.domain` は昇順の有限な2値。観測値を切る domain と bar の zero を外す domain は拒否する。renderer はlinear、軸・文字・色を所有する。barは0始点、明示domainはclipping検査後に保持し、未指定の場合だけzero/niceを補う。
- 欠測・非数・非有限値・絶対値 1e12 超・空データは拒否する。全 zero は正当な観測として保持し、指定domainがなければ0〜1の尺度を使う。正値を補作せず、意味は本文と基礎データで説明する。
- URL/data source、transform、任意 expression/JavaScript、random、params、link/image、layer/facet、theme/config override は非対応。任意の Vega-Lite spec が通る API ではない。

グラフの説明と underlying table を本文に含める。template は全件**合成データ**。実測図では対象・単位・条件・元データ・実行来歴を別途確認し、renderer receipt から測定済みと推測しない。

## draw.io と media への受渡し

手動 layout が必要なら draw.io の `.drawio` を非公開編集元として保持できる。Site viewer/runtime として追加しない。SVG export は外部 font/resource、HTML label/foreignObject、link/action、script、doctype、file path を含めない。標準 text/path と presentation attribute による self-contained SVG にする。検査例:

```sh
node ops/media/visuals/validate-svg.mjs .local/diagram.svg
```

検査は既存 `sanitizeSvg` と renderer 固有 allowlist・予算を通す。任意 CSS/style/要素を自動的に無害化したと称さず拒否し、安全な再 export を求める。global sanitizer/CSP は緩和しない。

現在の private candidate の媒体入力は raster が対象のため、通常は `poster.png` を正規の ingest/canonical source・Figure/semantic media 経路へ渡す。元 SVG・編集元・input hash と説明/表を保持する。CLI は Media Registry を勝手に編集せず、承認・保存・protection・publication を実行しない。フォントファイルを Git や review 配布 ZIP に入れない。

## 非公開表示検証

```sh
npm run test:technical-visuals
XPOTATO_TECHNICAL_VISUAL_BROWSER=1 npm run test:technical-visuals
node --import tsx ops/qa/review/articles/technical-visual-preview.ts
node ops/qa/review/articles/technical-visual-capture.mjs
```

通常CIの `test:release` からも呼ばれ、CIでは実Mermaid browser試験を省略しない。Windows では環境変数を PowerShell の `$env:XPOTATO_TECHNICAL_VISUAL_BROWSER='1'` で設定する。preview は fresh `.local/technical-visual-preview` にのみ作り、既存 `buildPrivateCandidateAstro` と実 ContentLayout/BaseLayout、Figure、BarChart、ArticleEndnote、MathML を使う。canonical article は編集しない。公開 build、feed、sitemap、search、publication manifest の入力へ追加しない。private marker / noindex / `productionEligible:false` を保持する。

capture は専用 browser で 1440 / 390 / 320 px、200%文字、キーボードによる式の局所 scroll、print、画像と table/alt、外部 request なし、公開 runtime の混入なしを検査し、`.local/technical-visual-preview/screenshots/` に evidence を残す。ブラウザー未実行・失敗は PASS にしない。preview のフォントはその表示にのみ使い、review download にまとめない。

実 API の根拠: [Mermaid API](https://mermaid.js.org/config/usage.html)、[strict 設定](https://mermaid.js.org/config/schema-docs/config.html)、[Vega-Lite single view](https://vega.github.io/vega-lite/docs/spec.html)、[Vega の static export/finalize](https://vega.github.io/vega/docs/api/view/)。本経路の許可 subset は上記の repository 実装が正本。

### Linuxのブラウザー一時領域

ChromeのUnix socketはTMPDIRの長さに制限があるため、Linuxではrepo内の深い出力pathをブラウザーの一時領域にしない。短い `/tmp/xp-tv-*` を一回ごとにmode 0700で作成し、profileとXDG config/cache/dataも隔離する。所有markerを照合し、ブラウザー/所有process groupの終了後だけ除去する。通常のOS sandboxと公開SiteのCSPは維持する。共有の起動待機処理でexitCodeだけでなくsignalCodeも検出し、早期異常終了を単なるtimeoutにしない。
