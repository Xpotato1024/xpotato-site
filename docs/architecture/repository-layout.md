---
status: canonical
owner: architecture
last_verified: 2026-11-18
---
# Repository layout

本文・登録データ、描画、編集、媒体処理、配信の所有者を分離する。現行機能に使わない移行実装や互換パスを、過去のテストを通すために残さない。

```text
xpotato-site/
├── apps/
│   ├── site/                 # 公開Astroサイト
│   │   ├── src/pages/        # URL入口
│   │   ├── src/features/     # 記事・検索・ホーム・ツール
│   │   ├── src/shared/       # shell・layout・本文部品・共通CSS
│   │   ├── public/           # 配信する固定素材・フォント
│   │   └── source-inputs/    # 現役素材の原本。非配信
│   ├── editor/               # Markdown/ブロック編集PWA
│   └── editor-api/           # 認証・Git・Private Draft R2（有効化は別）
├── content/                  # articles・notes・projects・tools・pages
│   └── registry/             # 分類・媒体・来歴・hold・URL対応
├── packages/                 # 共有契約、純粋処理、media/article pipeline
├── ops/                      # 制作・build・検証・配信の実行入口
├── config/                   # tool採用・予算・font・配信運用設定
├── templates/                # 現在の制作テンプレート
├── tests/fixtures/           # 現行処理に対する小さな合成入力
├── vendor/browser-tools/     # 選択済みimmutable release
├── schemas/release/          # 配布形式の手書き契約
├── docs/                     # 現行設計・操作・承認と設計理由
├── .agents/                  # AI制作スキル
└── .github/workflows/        # 現行CI・公開・レビュー・監視
```

## 正本

MDXは`content/`、分類語は`content/registry/taxonomy/terms.json`、公開保留は`content/registry/publication-holds.json`、公開URL履歴は`content/registry/article-url-history.json`。過去の移行台帳をこれらの生成元として再実行しない。固定ページ・ツール等の編集来歴は`content/registry/editorial/provenance.json`に保持し、現在の本文hashを検証する。

色・書体・font-faceは`packages/design-system/`。機能固有のCSSはfeatureの近くに置き、共通本文CSSだけをsharedに置く。部品propsはcontent-contracts、CMS入力UIとAstro描画は別のconsumer。

Zod契約から出力するJSON Schemaは`npm run schema:generate`で`.local/schemas/`へ生成する。生成物はGitの第二正本にしない。

## 依存方向

site/editorは共有契約・portable-content・design-systemを使う。content/registryはAstro/React/site実装をimportしない。renderer import対応表はsite側でinstallerから生成する。siteはarticle-pipeline、provider SDK、sandbox実行に依存しない。

opsはIOと実行の所有者。validatorsは現在のcatalog/registry/成果物を読み、過去のPhaseを再現しない。古いpathの再exportや旧operator実装は置かない。

詳細は[作業入口](../../ops/README.md)、[現行CI](../../ops/ci/README.md)、[過去版の復元](../operations/source-history.md)を参照。
