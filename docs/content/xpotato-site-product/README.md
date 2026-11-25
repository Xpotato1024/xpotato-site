# Xpotato-Site プロダクト記事の改稿候補と説明図

対象ContentIdは `325e1e0e-acd3-469f-a27d-476cf84b48fc`、構成の参照版は `dd133023c5e7f051b94a6f9e81b63a5157095e82`。

## 図と表示

- `architecture-editor`: CMS、編集API、GitHub、下書き画像の保存先。
- `architecture-delivery`: 検証したサイト成果物と、別工程で保存した媒体の配信。
- `authoring-flow`: 人とAIの入口、共通原稿、確認と改稿、本人確認、正式出力、別判断の本番配信。
- `media-lifecycle`: 下書き領域と、正規化済み原本・公開データ・公開画像の保護。

設計幅360px。通常ラベル18px以上で、280pxへの縮小時は14px以上。構成図の2枚は既存の `Gallery layout="diagrams"` でPC横並び・スマートフォン縦並びにする。残る図は `Figure width="compact"` で過拡大を避ける。完成ページの表示確認は、図単体の幅検査とは別に行う。

## 再生成

repository pinのNode/npmと依存を使い、repoのrootから以下を実行する。

```sh
node --import tsx docs/content/xpotato-site-product/generate.mjs .
```

生成元の配置を変更した場合はコマンドのpathを合わせる。第1引数はXpotato-Site repository root。出力先は `.local/product-article/visuals/`。第2引数で別のローカル制作directoryを指定できる。

`*.source.svg` は文字を持つ編集用SVG。`*.svg` はサイトのZen Kaku Gothic Newを欠字検査してアウトライン化した表示用。`*.png` は同じSVGの3倍解像度の出力。`manifest.json` に原本・出力・フォント・共通themeのhashを残す。原稿本文はsemantic asset IDで参照し、SVGを任意importする方式へ変更しない。

## 図単体の確認

4枚すべてで、既存の `ops/media/visuals/svg.mjs` の `staticSvg` 検査、サイト書体の欠字検査、18px以上のラベルと各領域の文字幅検査を実施した。表示用SVGから生成したPNGを360px幅で並べて目視し、重なり・欠け・矢印と文字の衝突がないことを確認した。完成ページの幅・文字サイズを変えた確認結果は後述する。

| 図                      | SVG設計サイズ | PNGサイズ   |
| ----------------------- | ------------- | ----------- |
| `architecture-editor`   | 360 × 544     | 1080 × 1632 |
| `architecture-delivery` | 360 × 662     | 1080 × 1986 |
| `authoring-flow`        | 360 × 746     | 1080 × 2238 |
| `media-lifecycle`       | 360 × 598     | 1080 × 1794 |

CMSとSiteのロゴは既存repository内の原本を読取り、外形・色・path順序を変えず等比配置する。Cloudflare製品は、正式名称と自作の機能記号を使う。会社ロゴの代用・模倣ではない。

## 外部素材

| 素材                    | 取得元                                               | 利用案内                                  |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------- |
| GitHub Invertocat Black | https://brand.github.com/GitHub_Logos.zip            | https://brand.github.com/foundations/logo |
| Astro Logo on light     | https://astro.build/assets/press/astro-logo-dark.svg | https://astro.build/press/                |

取得日: 2026-11-26（JST）。原本は `source-assets/`。GitHubは製品の統合先、Astroは静的HTMLを生成する技術の識別に用いる。SVG原本の形状・色を保持し、提携や推奨を表示しない。ロゴの商標は各権利者に帰属する。ライブラリのOSS licenseをロゴ利用条件として転用しない。

## 保存と状態

現時点は本人限定preview用で、媒体の正式保存・公開・本人承認・独立監査PASSを表さない。PNG、連絡用contact sheet、元ZIPは一般のcontent画像としてGitへ追加しない。PRに残す場合は生成元、必要な公式SVG原本、コンパクトな編集元SVG、最小の出典・説明を対象とし、公開Registry/R2への採用は正規手順で扱う。

## 記事とレビューの状態

改稿候補はこのdirectoryに保存する。既存の公開ページと内部リンクを維持するため、`content/projects/xpotato-site.mdx`、`content/registry/editorial/provenance.json`、`content/registry/editor-content-index.json` は固定main `dd133023c5e7f051b94a6f9e81b63a5157095e82` と同じbytesを保つ。

- [candidate.mdx](candidate.mdx): 同じContentId・公開URL・元公開日を引き継ぐ改稿候補。正式媒体の保存前なので候補自身は `draft:true`。
- [candidate.provenance.json](candidate.provenance.json): 候補に対応する編集来歴1件。`path` は将来の適用先を示し、現在の公開用Registryには未適用。
- [candidate.metadata.json](candidate.metadata.json): 適用先、候補hash、固定render元commit、公開適格性の状態。

候補MDXのSHA-256は `0cd8db75a5a94cc5692142ae3d7bf13a37131d53360b97a1755f987a0e6b9a98`。このdirectoryは公開ページのcontent collectionに含まれない。候補を保存したDraft PRのCIと、候補本文を描画するprivate reviewは、それぞれの対象revisionで結果を確認する。

本文はAIによる改稿。固定版の公開コード・設計資料を照合し、独立の内容レビューで実装と未確認の実運用を区別した。採用済みのCMS/Siteロゴを変更せず、GitHubとAstroは公式配布素材を識別目的に使う。公開用の媒体receiptや本人承認を作成していない。

候補と編集来歴の保存は、正規MDXへの採用、媒体のA/B/C保存、本人承認、merge、本番配信を表さない。採用時は必要な媒体の正規保存・公開準備を完了し、本人が確認した候補を元のcontent pathへ反映する。その内容に合わせて `draft:false`、編集来歴、CMS索引を更新し、同じPR headの通常検証を通す。本番配信には別途、本人の明示的な操作と配信条件が必要になる。

## 固定版からのAstroレビュー再現

render元は [e72453b26d8b25963a5fd46ede47bd00a21416a2](https://github.com/Xpotato1024/xpotato-site/commit/e72453b26d8b25963a5fd46ede47bd00a21416a2)。この固定版の `content/projects/xpotato-site.mdx` が候補と同じbytesを持つ。検証に用いたローカルcommit `38b974610006e8d52fb2dbfa88b91707d6d5b35d` とGitHub上の固定版は、ともにtree `2131117371c729f9d549b5a9140d16d6d441f1ac`。

`editor:review` は `content/{articles,notes,projects,tools,pages}/<slug>.md[x]` のみを受け付け、指定checkoutの `HEAD` から原稿を読む。`--source docs/content/.../candidate.mdx` や未commitの作業ファイルは入力にならない。公開用checkoutを編集せず、固定版の独立したworktreeで再現する。repositoryで固定されたNode/npmを使う。

```sh
git worktree add --detach ../xpotato-site-product-review-e72453b e72453b26d8b25963a5fd46ede47bd00a21416a2
cd ../xpotato-site-product-review-e72453b
npm ci --prefer-offline --no-audit --no-fund
npm run editor:review -- --source content/projects/xpotato-site.mdx --commit e72453b26d8b25963a5fd46ede47bd00a21416a2 --output .local/editor-review/xpotato-site-product
node --import tsx docs/content/xpotato-site-product/generate.mjs .
```

固定commitをまだ取得していない場合は、そのcommitを含むPRの履歴を取得してから実行する。出力済みのreview directoryは上書きされないため、再実行時には新しい `.local` 配下の出力先を指定する。

`review.json` にはAstroの実コンポーネントから得たHTML、分離したCSS、媒体ID、原稿hashが入る。本文がsemantic asset IDで参照する図の画像bytesは含まない。完成ページの確認には、上記で生成した4枚のPNGを同じasset IDで対応させ、hashと画像サイズを検証して既存のreview rendererへ渡す。実装入口は `apps/editor/src/data/astro-review.ts` の `renderAstroReview`。HTMLだけを取り出してCSSや画像を省略した表示を、完成ページの確認結果として扱わない。

候補をさらに変更する場合は、制作専用worktreeで正規content pathに候補を適用し、ローカルcommitを作ってから同じreview入口を使う。候補とrender元のhash・commitを更新し、公開用checkoutの3ファイルは採用まで維持する。tracked treeがcleanであること、`productionEligible:false` とprivate review markerを保つことが必要。

## 完成ページの表示確認

上記SHA-256の最終候補を対象に、Astroの正規HTML/CSSと4枚のPNGをsandboxed `srcdoc` に読み込み、CUA Chromiumで実表示した。幅1440px、390px、320pxに加え、390pxで本文の基準文字サイズを16pxから32pxへ変更した条件を確認した。

すべての条件で `scrollWidth == clientWidth`、4枚のPNGが読込済みだった。構成図のGalleryは1440pxで2列、390pxと320pxで1列となり、4図に欠け・重なり・矢印と文字の衝突がないことを目視した。200%の文字サイズで細くなる本文の3表は説明リストに改め、320pxと200%の条件で再確認した。この修正は候補bytesに含まれる。

観測値はローカル制作出力 `.local/product-article/browser-qa.json` にある。これはChromium上で幅と文字サイズを変えた静的表示の確認であり、iPhone等の実機、CMSの操作、本番の公開フローはこの確認に含めない。
