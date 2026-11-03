---
status: canonical
owner: development
last_verified: 2026-11-03
---

# 現在の配置と旧構成の処分条件

この表はPR141の開発配置。採用前のmain・本番へ適用済みとは扱わない。日常の操作は[4経路](content-workflows.md)、作業コードは[tools](../../tools/README.md)。

| 場所 | 所有する正本・入力 | 直接編集しないもの・旧資産 |
|---|---|---|
| `.agents/skills` | repo固有の手順・semantic contract | 公開権限や検証実装の代替ではない |
| `.github/workflows` | CIと手動保存・配信の実行条件 | 処理本体はtools/packages/scriptsに一実装 |
| `apps/site/src` | 現行本文、画面、CSS、route、Registry | 記事は正式export、tool wrapperはinstallerで更新 |
| `apps/site/public` | favicon、font、small static asset、license | 検索indexは生成物、写真/記事画像の正本はR2 |
| `apps/site`のAstro/Wrangler設定 | 現行build・唯一の配信設定 | rootの旧設定は使わない |
| `config` | tool採用/配置とtrusted-main admission | 秘密値・private原稿・資料本文を置かない |
| `packages` | 共有schema、記事/media処理、sandbox、read-only検証 | 明示的な移行writer/CLIはtools/migration |
| `tools` | 作成、build補助、QA、過去比較、素材生成、移行、保存入口 | 公開runtimeや新workspaceではない |
| `scripts` | 配信境界・CI分類・7本の固定描画来歴 | 残した具体的理由は[scripts所有表](../../scripts/README.md) |
| `templates` | 記事/page/toolの開始source | 正式記事、test fixture、vendorとは別 |
| `tests/fixtures` | 凍結・合成入力、receipt worker | test本体は実装横にも置く。公開データではない |
| `schemas/generated` | content-contractsから生成した82 JSON Schema | 生成元を直しschema:generate/checkを使う |
| `vendor` | 固定artifact・license補足 | 全7版の実参照と除去条件は[vendor所有表](../../vendor/README.md) |
| `docs` | 現行契約/手順 | `migration/audits/history/legacy`は日付・対象revision付き記録。旧記録を現況として使わない |
| `.local`・`dist`・`node_modules` | private Job、一時生成物、依存install | Git sourceではない。公開contentへコピーしない |

rootの`package.json`/lock、`tsconfig.base.json`/`tsconfig.json`、`vitest.config.ts`は現役workspace管理。アプリ設定との二重管理ではない。

## 旧rootと履歴コピーの撤去契約

再設計は[ADR-0066](../design/adr/0066-reproducible-repository-copy-retirement.md)。旧src113・3設定・SVG7とrobotsの正確な124 frozen UTF-8 blobを、公開cutoverから切り離して撤去できる。注釈付きtag927d1057の実object・baseline blob一致・同bytes復元・現行出力比較を要求し、未知pathは許可しない。現在は実削除の確認待ちでコピーはまだ存在する。

実公開・旧44記事のhold・ID/URL履歴・provider redirect・本番rollbackの成立は別。9 rasterは同bytesを残し、public/protection/compact recovery/代表復元SHAの既存条件を維持する。textのGit復元を実media復旧の証跡にしない。root package/lock/tsconfigは現役なので撤去対象ではない。

vendorは選択中の実体を残し、旧6版は固定main祖先97d69d2858bf26346cd57815d7f7697ae81af1aaから全pinを同一checkerで通常検証できる。既存treeの改変はfallbackで隠さず、差戻しには明示restoreとfilesystem selectが必要。[vendor所有表](../../vendor/README.md)を参照。新サーバー・鍵・ネットワーク取得は追加しない。

## 移行と再現コード

`tools/migration`は凍結baselineの再生成・再現・明示writer、`packages/site-validators`は同じbuilderと読取り比較を所有する。CLIとwriterは検証から検証結果をコピーせず共有builderを使う。移行writerは日常編集の入口ではなく、特にPhase5のmanual revision上書き拒否は維持する。Phase6のlocal encodingは一時sourceと生成物を書き込むため、checkerを含むIO orchestration全体をtools側に置く。

`tools/review`は過去の比較画面・入力ケースの再現、`tools/qa`は定常CI受入れ。`tools/assets`はfavicon/font/一時写真の明示生成で、通常buildへ自動追加しない。旧WordPress importer、statusだけを見る旧curl確認、CSP単独writerは廃止。CSPとmanifestの生成・検査は既存publication compilerに統一し、`security:check`のnpm名は維持する。
