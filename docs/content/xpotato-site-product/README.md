# Xpotato-Site プロダクト記事の説明図

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

4枚すべてで、既存の `ops/media/visuals/svg.mjs` の `staticSvg` 検査、サイト書体の欠字検査、18px以上のラベルと各領域の文字幅検査を実施した。表示用SVGから生成したPNGを360px幅で並べて目視し、重なり・欠け・矢印と文字の衝突がないことを確認した。完成ページ上の390px表示と200%文字サイズでの確認は、記事側のpreview検証で扱う。

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

本文は `content/projects/xpotato-site.mdx`、編集由来は `content/registry/editorial/provenance.json`。同じContentId・公開URL・元公開日を維持している。正式媒体が未保存のため、今回の改稿ブランチでは `draft:true`。この状態のままmainへmergeすると公開ページが除外されるため、レビュー用Draft PRとして扱い、媒体の正規保存・公開準備と合わせて `draft:false` に戻す。

本文はAIによる改稿。固定版の公開コード・設計資料を照合し、独立の内容レビューで実装と未確認の実運用を区別した。採用済みのCMS/Siteロゴを変更せず、GitHubとAstroは公式配布素材を識別目的に使う。公開用の媒体receiptや本人承認を作成していない。
