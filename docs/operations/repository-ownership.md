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
| `apps/site/source-inputs` | 既存Git原画像9件の非配信入力とexact catalog | ホーム・媒体取込みが現物を読む。新規画像/秘密の保存先ではなく、public/protected receiptの代用でもない |
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

## 共通の追加・更新経路

PR141の追加変更は[ADR-0067](../design/adr/0067-common-content-lifecycle.md)。記事の初回限定guard、Prime専用migration/update CLI、閉じた紹介文hash候補を現役経路から撤去する。記事の作成・更新は同じJob/prepare/publish、toolの作成・更新は同じinstallerを使う。公開済み版にも別コマンドはない。

| 正本 | 所有と更新 |
|---|---|
| `apps/site/src/content/{blog,tools,pages}` | 配信用本文・編集metadata。`blog`は内部schema識別子、実記事URLは`/articles/` |
| `config/browser-tools/installations.json` | 全toolのpin、ID/slug/hydration、hostの表示・法的提供policy。本文/紹介文を重複保存しない |
| `config/browser-tools/public-admissions.json` | 全tool共通のexact公開pin。bounded runtime reviewを含む元reviewを照合 |
| `tools/authoring/browser-tool-installation.ts` | 全tool共通のtransaction、履歴、isolated npm lock、失敗復元。validatorは読取り・生成projection比較 |
| `packages/article-pipeline/src/publication/publication-revision.ts` | 公開更新の前版4file、Git祖先、ID/URL/recovery照合。新しい保存先ではない |
| `tests/fixtures/search/article.mdx` | 検索の日本語/英数字試験だけの合成記事。通常content/mediaへ登録しない |

旧44記事のhold、画像原本9件、固定Gitからの歴史復元は引き続き別の受入条件を持つ。共通化を本番cutoverや実保存済みの証明として扱わない。

## 旧rootと履歴コピーの撤去契約

再設計は[ADR-0066](../design/adr/0066-reproducible-repository-copy-retirement.md)。旧src113・3設定・SVG7とrobotsの正確な124 frozen UTF-8 blobを、公開cutoverから切り離して撤去できる。注釈付きtag927d1057の実object・baseline blob一致・同bytes復元・現行出力比較を要求し、未知pathは許可しない。PR141作業ブランチでは613 trackedファイルへの本人承認を受け、固定Gitとの全preimage一致確認後に対象124コピーを撤去済み。mainへの採用・配信は未実施。

rootの`src/`・`public/`・旧Astro/Tailwind/Wrangler設定は撤去済み。実公開・旧44記事のhold・ID/URL履歴・provider redirect・本番rollbackの成立は別。9 rasterは`apps/site/source-inputs`へ同bytesで移管し、将来の原bytes廃棄にはpublic/protection/compact recovery/代表復元SHAの既存条件を維持する。Git復元を実media復旧の証跡にしない。root package/lock/tsconfigは現役なので撤去対象ではない。

vendorは選択中の実体を残し、旧6版は固定main祖先97d69d2858bf26346cd57815d7f7697ae81af1aaから全pinを同一checkerで通常検証できる。既存treeの改変はfallbackで隠さず、差戻しには明示restoreとfilesystem selectが必要。[vendor所有表](../../vendor/README.md)を参照。新サーバー・鍵・ネットワーク取得は追加しない。

## 旧root原画像9件の移管対応

全path・SHA-256・bytesと採用済みrightsRefは[新サイトの入力catalog](../../apps/site/source-inputs/media/catalog.json)が正本。下表の新名はSHA先頭12桁の略記で、実file名は64桁。現在の読取りは新pathを使い、旧pathは固定Gitの来歴として保持する。

| 旧public相対path | 新sha256名（略記） | 新所有での用途 | 既存ContentId / asset |
|---|---|---|---|
| images/projects/meidaisai-overview.png | a8ac62ef3267.png | migration-ingest-input | d87ec77e-e24e-4c5f-a5fe-a271eb6fc8da/overview |
| images/projects/syu-katsu-management-overview.png | 970bf70f5b07.png | migration-ingest-input | 80b540c6-cddc-4214-8d96-61b70a86787a/overview |
| images/projects/xpotato-site-overview.png | 4a6b1bbeec56.png | migration-ingest-input | 325e1e0e-acd3-469f-a27d-476cf84b48fc/overview |
| images/ui/hero-workshop-stage.jpg | 1daf2c4eb051.jpg | homepage-build-input | daf04736-9b1b-49c7-8942-1e1545a4b985/home-workshop |
| wp-content/uploads/2025/09/img_4844.jpg | 7775a57cab8c.jpg | unassigned-original | 未割当。ID・権利・公開を推定しない |
| wp-content/uploads/2025/09/img_7.jpg | 8b11314fa316.jpg | migration-ingest-input | 94147d1b-338e-4e03-aa25-595558a513dd/inline-01 |
| wp-content/uploads/2025/09/img_8.png | cc1d7e042038.png | migration-ingest-input | 94147d1b-338e-4e03-aa25-595558a513dd/inline-03 |
| wp-content/uploads/2025/09/img_9.png | add8d8445245.png | migration-ingest-input | 94147d1b-338e-4e03-aa25-595558a513dd/inline-02 |
| wp-content/uploads/2025/10/19EBD197-78A0-4E6A-82A4-7365DF22AF13.png | 433f9ac6ff86.png | replaced-original | f202daa7-cb5c-4dd3-8b17-7bb6b1feefae/inline-01（置換先。原画面の再採用ではない） |

前半のmigration-ingest-input6件の権利記録は採用済みPhase6 candidateを参照し、raw inventoryの当初pendingを現在の判定に使わない。ConoHa画面は採用済み自作SVGへの置換を維持し、原画面の公開へ戻さない。未割当画像は保全入力として保持し、架空の所属を作らない。

9件は正確な固定Git集合から検査し、catalog改変・別bytes・欠損・symlink・旧rootへのコピーを拒否する。両Git gateの例外は実測したold/newの同bytes移管だけ。directory全体のraster追加を許可しない。最終distは原bytesのSHAとsource-inputs pathを拒否し、通常画像は既存ingest/variant/保存契約で扱う。実R2保存・保護・復旧は今回実施せず、原bytes廃棄の条件も維持する。

## hidden supportと残す現行構造

rootの隠しsupportも確認した。旧src/public・旧3設定・旧版vendor directoryは存在しない。.gitattributesは歴史版別のpath列挙を廃止し、選択/明示復元した固定配布物の同じlicenseファイルへ作用する規則へ整理した。hash検証は維持する。.gitignoreのtmp/とOS metadataは非追跡scratchの保護であり、旧サイト入力ではない。

.node-versionと.nvmrcは同じ現行24.22.1をtoolchain検査が要求する。package/lock・tsconfig・Vitestはworkspace全体用、.agentsと.githubは現行手順/CI。.gitは履歴、.localは非公開Jobと検証記録、node_modulesは生成依存。これらを旧構造と誤認して削除しない。tests/fixtures/migrationとdocsの過去記録は固定revisionの再現/監査用で、旧rootの実行実装ではない。

## 移行と再現コード

`tools/migration`は凍結baselineの再生成・再現・明示writer、`packages/site-validators`は同じbuilderと読取り比較を所有する。CLIとwriterは検証から検証結果をコピーせず共有builderを使う。移行writerは日常編集の入口ではなく、特にPhase5のmanual revision上書き拒否は維持する。Phase6のlocal encodingは一時sourceと生成物を書き込むため、checkerを含むIO orchestration全体をtools側に置く。

`tools/review`は過去の比較画面・入力ケースの再現、`tools/qa`は定常CI受入れ。`tools/assets`はfavicon/font/一時写真の明示生成で、通常buildへ自動追加しない。旧WordPress importer、statusだけを見る旧curl確認、CSP単独writerは廃止。CSPとmanifestの生成・検査は既存publication compilerに統一し、`security:check`のnpm名は維持する。
