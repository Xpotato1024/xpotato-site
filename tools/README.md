# 作業コードの入口と所有

日常の操作はrootから既存のnpmコマンドを使う。[4つの編集経路](../docs/operations/content-workflows.md)が利用手順の正本。このdirectoryはworkspaceでも公開runtimeでもなく、ローカル/CIで実行する保守対象コードを置く。

| 所有 | 維持する入口 | 実行範囲 |
|---|---|---|
| `authoring/` | `site`、`content`、`browser-tools:author`、`browser-tools:install`、`social-card:preview` | private記事Job、下書きページ、独立tool source、固定artifactのローカル導入。記事のcanonicalを直接生成する別経路は作らない |
| `build/` | `build`、`publication:generate/check` | Astroのhome画像integrationと公開manifest/CSP。生成元・固定sourceを検証する |
| `qa/` | `content:smoke`、各`*:isolation:*`、`release:interaction`、`performance:*`、`quality:lighthouse` | 合成/private出力、実dist、有限のローカルブラウザ検証。公開操作の代わりではない |
| `publication/` | 既存の手動`publish-article-media.yml` | 承認済みpackageのR2保存・照合・export。CLIを移動してもowner/main/manual/Environment条件は変えない |
| `migration/` | 既存の`migration:*`、`phase8:*` | 凍結baselineの再生成・再現・明示的writer。日常編集と分離し、既存の上書き拒否を維持 |
| `review/` | 過去の画面・SNS・具体入力の比較CLI | synthetic/privateの設計・再現用。定常CI受入れはqa。実画面・外部GETの実行は対象と認可を別途確認 |
| `assets/` | favicon/font/一時写真の明示生成 | 固定toolchainを使う素材補助。通常buildへ自動実行しない |

`browser-tools`は固定artifactの低レベル検査/採用/選択。通常のサイト掲載は配置・lock・wrapperまで扱う`browser-tools:install`を使う。両者は別の保存対象を持つので、無条件なalias統合はしない。

## 実装と検証の分離

- 下書きページwriter、独立tool generator、導入/更新/旧手動Prime移管writerは`authoring/`。同名の旧script forwarding実装は残さない。
- schema、tool source/artifact検査、導入状態の読取り検査は`packages/site-validators/`。導入writerは同じ検査/生成projectionを利用し、別の検査をコピーしない。既存adoption層のimmutable artifact保管は導入writerが引き続き利用する。
- HTTP header解釈は`packages/site-validators/src/static-headers.mjs`を共有。build/配信/QAで別のparserを作らない。
- synthetic tool作成harnessは`tests/fixtures/browser-tools.ts`。fixtureであることと実sourceレビューを区別する。
- 移動したTypeScriptは`tools/tsconfig.json`と通常Vitestで検査する。候補の鮮度はauthoring/build/publicationの実装変更も検知する。
- 移行の8つのcanonical writerを`migration/writers.ts`へ分離し、shared builderとread-only checkはvalidatorsに維持する。Phase6 local encodingと診断出力はIO orchestrationとしてmigration側に置く。
- release package組立も`build/release-package-cli.ts`。旧CSP単独writerは廃止し、`security:check`は同じpublication compilerの検査へ統一する。

## 今回移動・削除しないもの

| 場所 | 残す理由・削除条件 |
|---|---|
| `scripts/release/`、CI scope/graph | 配布/配信/監視の独立した既存境界。任意の開発CLIと混ぜない。新たなdeploy入口は作らない |
| `scripts/article-concrete-*`、`article-preview-state.mjs`、`article-existing-reference.ts` | `packages/article-pipeline/src/existing-render-context.ts`が描画来歴へ固定する使用中コード。fixtureでも未使用扱いしない |
| root `src/`、`public/`、旧Astro/Tailwind/Wrangler設定 | 現行siteではない。固定tagから復元可能だが、Phase10のcutover/rollback条件と旧rasterの真正なprotected restore条件は未成立。[正確な保持・解除条件](../docs/operations/repository-ownership.md)を参照 |
| `vendor/browser-tools/`の過去6版 | 通常検証が全7pinの実bytesを照合し、v0.1.0/0.1.5/0.2.0は旧版回帰入力にも使用。[全版保持契約と除去条件](../vendor/README.md)を参照 |

旧operator/sessionの説明と日付付き準備記録は`docs/history/`へ分離し、元URLには案内だけを残す。現行保存方式は[公開CI](../docs/operations/article-media-publication-ci.md)。旧writer/session APIの存在を本番で利用可能な経路と解釈しない。

未分類のroot手動scriptは残さない。固定来歴7本とCI分類・配信だけを[scripts所有表](../scripts/README.md)へ限定し、比較用はreview、素材補助はassetsへ移した。旧WordPress importer/status-only curl確認の廃止と固定Gitの読取り先も同表に記録する。歴史的な受入記録内の旧pathを現在pathへ書き換えない。

## 変更時の確認

import、`new URL`/repository root、npm script、workflowの呼出し、candidate freshness、export/registry対象、Vitest/typecheckを同時に確認する。通常CIは実artifact結合検査まで行う。公開URL/本文/Registry/vendor/public資産の移動はこの整理に含めない。旧pathを含む署名済み・hash固定の過去証跡を、現在のpathへ書き換えない。

ローカルの全体検証では[一時出力先の設定](../docs/operations/content-workflows.md#共通の確認と公開境界)が必要。`XPOTATO_PHASE8_TEMP_ROOT`未設定の失敗を、配信成功や検査不要と扱わない。GitHub Actionsはこの設定を既存workflowから渡す。
