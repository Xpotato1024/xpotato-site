# 作業コードの入口と所有

日常の操作はrootから既存のnpmコマンドを使う。[4つの編集経路](../docs/operations/content-workflows.md)が利用手順の正本。このdirectoryはworkspaceでも公開runtimeでもなく、ローカル/CIで実行する保守対象コードを置く。

| 所有 | 維持する入口 | 実行範囲 |
|---|---|---|
| `authoring/` | `site`、`content`、`browser-tools:author`、`browser-tools:install`、`social-card:preview` | private記事Job、下書きページ、独立tool source、固定artifactのローカル導入。記事のcanonicalを直接生成する別経路は作らない |
| `build/` | `build`、`publication:generate/check` | Astroのhome画像integrationと公開manifest/CSP。生成元・固定sourceを検証する |
| `qa/` | `content:smoke`、各`*:isolation:*`、`release:interaction`、`performance:*`、`quality:lighthouse` | 合成/private出力、実dist、有限のローカルブラウザ検証。公開操作の代わりではない |
| `publication/` | 既存の手動`publish-article-media.yml` | 承認済みpackageのR2保存・照合・export。CLIを移動してもowner/main/manual/Environment条件は変えない |

`browser-tools`は固定artifactの低レベル検査/採用/選択。通常のサイト掲載は配置・lock・wrapperまで扱う`browser-tools:install`を使う。両者は別の保存対象を持つので、無条件なalias統合はしない。

## 実装と検証の分離

- 下書きページwriter、独立tool generator、導入/更新/旧手動Prime移管writerは`authoring/`。同名の旧script forwarding実装は残さない。
- schema、tool source/artifact検査、導入状態の読取り検査は`packages/site-validators/`。導入writerは同じ検査/生成projectionを利用し、別の検査をコピーしない。既存adoption層のimmutable artifact保管は導入writerが引き続き利用する。
- HTTP header解釈は`packages/portable-content/src/static-headers.mjs`を共有。build/配信/QAで別のparserを作らない。
- synthetic tool作成harnessは`tests/fixtures/browser-tools.ts`。fixtureであることと実sourceレビューを区別する。
- 移動したTypeScriptは`tools/tsconfig.json`と通常Vitestで検査する。候補の鮮度はauthoring/build/publicationの実装変更も検知する。

## 今回移動・削除しないもの

| 場所 | 残す理由・削除条件 |
|---|---|
| `scripts/release/`、CI scope/graph | 配布/配信/監視の独立した既存境界。任意の開発CLIと混ぜない。新たなdeploy入口は作らない |
| `scripts/article-concrete-*`、`article-preview-state.mjs`、`article-existing-reference.ts` | `packages/article-pipeline/src/existing-render-context.ts`が描画来歴へ固定する使用中コード。fixtureでも未使用扱いしない |
| `scripts/article-readability-*`、`social-card-design.mjs`、`blog-social-card-qa.ts` | 既存fixture/設計レビューの明示的な再現入口。定常QAと履歴的な比較用出力は区別する |
| その他の未参照に見える手動画面/画像/font補助 | npm/import参照がないだけでは未使用を証明できない。過去の受入記録と入出力を調べてから個別に廃止する。日常の標準入口へ追加しない |
| root `src/`、`public/`、旧Astro/Tailwind/Wrangler設定 | 現行siteではない。inventoryは固定tag、home画像も固定Git blobから取得するが、legacy cutover/rollback/旧画像削除条件は未閉鎖。古いファイルを現行の編集先にしない。受入記録と全利用参照を確認する別の除去作業が必要 |
| `vendor/browser-tools/`の過去版 | immutable pin、license、旧版再現/rollbackの参照がある。最新版以外を一括削除しない |

旧operator/sessionの説明と日付付き準備記録は`docs/history/`へ分離し、元URLには案内だけを残す。現行保存方式は[公開CI](../docs/operations/article-media-publication-ci.md)。旧writer/session APIの存在を本番で利用可能な経路と解釈しない。

## 変更時の確認

import、`new URL`/repository root、npm script、workflowの呼出し、candidate freshness、export/registry対象、Vitest/typecheckを同時に確認する。通常CIは実artifact結合検査まで行う。公開URL/本文/Registry/vendor/public資産の移動はこの整理に含めない。旧pathを含む署名済み・hash固定の過去証跡を、現在のpathへ書き換えない。
