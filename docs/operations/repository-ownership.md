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

## 旧rootを残す正確な理由

旧`src/`113ファイル、`public/`17ファイル、`astro.config.mjs`・`tailwind.config.mjs`・`wrangler.jsonc`は、凍結commit `927d105713561309fc5e2374396f86646b5aeb2a`とbytes同一。現行build/deployはこれらを読まない。inventory/reproductionは`legacy-pre-vnext-2026-08-28`を検証してGit objectから読み、ホーム写真も同commitのGit blobから読む。したがって**現行実行に必要だから保持しているわけではない**。

ただし現契約には次の明示条件があり、この整理では未成立を成立扱いしない。

- [移行計画Phase10](../migration/greenfield-rebuild-plan.md)は、content/media/route/provider readinessとrollbackの後に旧src・framework/deploy設定・旧rasterを除去すると定める。
- [design-statusのcutover gate](../architecture/design-status.md)も同条件を維持。旧44記事のhold、provider redirect、最終cutover/rollback受入れは、新しい1記事の公開完了とは別のもの。
- [media recovery契約](../contracts/media-recovery-contract.md)は旧Git raster削除前に、public object、full protection receipt、compact recovery binding、representative restoreと復元SHA一致を要求する。旧publicには9 raster・7 SVG・robotsがあり、固定Git保存だけではrasterのこの条件を代用できない。

確認したGit記録には、旧44記事を含む最終cutover/rollbackと旧mediaのprotected restore完了証跡がない。現在の保持ownerはlegacy migrationで、通常編集先はapps/siteだけ。`.local`のprivate写真や架空のreceiptを証跡として採用しない。

旧rootを消す次操作は、(a)未完の旧コンテンツ/画像/転送/復旧の受入れを閉じるか、(b)**未使用text/configのworking-tree除去を公開cutoverから分離する契約改訂**を明示reviewすること。後者でもraster保全条件は独立に残る。この整理PRはその条件を勝手に緩和せず、全量をarchive/old-srcへ複製もしない。

## 移行と再現コード

`tools/migration`は凍結baselineの再生成・再現・明示writer、`packages/site-validators`は同じbuilderと読取り比較を所有する。CLIとwriterは検証から検証結果をコピーせず共有builderを使う。移行writerは日常編集の入口ではなく、特にPhase5のmanual revision上書き拒否は維持する。Phase6のlocal encodingは一時sourceと生成物を書き込むため、checkerを含むIO orchestration全体をtools側に置く。

`tools/review`は過去の比較画面・入力ケースの再現、`tools/qa`は定常CI受入れ。`tools/assets`はfavicon/font/一時写真の明示生成で、通常buildへ自動追加しない。旧WordPress importer、statusだけを見る旧curl確認、CSP単独writerは廃止。CSPとmanifestの生成・検査は既存publication compilerに統一し、`security:check`のnpm名は維持する。
