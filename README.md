# xpotato-site

技術記事・学習ノート・制作物・ブラウザツールを公開する静的サイトです。現行実装は npm workspaces の `apps/site/`、共通契約・検証・非公開執筆処理は `packages/` にあります。

- [文書の入口と正本一覧](docs/README.md)
- [設計・移行・公開の現在の段階](docs/architecture/design-status.md)
- [開発と検証](docs/operations/development-workflow.md)
- [ビルドとartifact](docs/operations/build-artifact-pipeline.md)
- [現在の配信workflowと認可境界](docs/operations/current-deployment-status.md)
- [ビジュアルデザイン仕様](docs/design/visual-design-reference.md)

文書は `docs/` に統一します。現行仕様・運用、採用判断の履歴、移行証拠を混同しないよう、[役割と旧パスの対応](docs/legacy/README.md)を記載しています。旧root `src/`・`public/`・設定・importerは移行資料であり、通常の新規投稿先ではありません。

## ローカル検証

Node/npm は `.node-version` と `package.json` の固定版を使います。

```sh
npm ci
npm run ci
```

`ci:source -> build -> ci:final` が通常の検証経路です。ブラウザ検証の一時領域など、環境条件は[build artifact pipeline](docs/operations/build-artifact-pipeline.md)を参照してください。push/PRは検証と候補artifact作成までで、実記事公開・旧44記事hold解除・本番deployは別認可です。

旧setup・Pages運用・手動移植の説明は[legacy文書](docs/legacy/README.md)へ保全しました。
