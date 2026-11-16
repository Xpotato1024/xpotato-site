---
status: proposed
owner: architecture
last_verified: 2026-11-16
basis:
  site_revision: 9748e6cfee6c3e38f79a9c6a18222c8087bc6ac6
---

# コンテンツ基盤と編集PWAの責務分離（再構成案）

## 目的と非目標

**目的**: 人間とAIが同じコンテンツ契約を利用して記事を容易に追加・更新できるよう、編集・描画・メディア・分類検索・配信の責務と依存方向を固定する。専用CMSは同一repositoryの静的PWAとして実装する。Astro/Cloudflare Workers Static Assets、Gitによる履歴、既存の公開審査・保護処理を維持する。

**非目標**: 外部CMSの増設、CMSからの無審査公開、全ページSPA化、既存Article Job/媒体保存の再実装、旧記事や本文の一括書換え、CIの必須検査の根拠なき省略。本書は提案であり、既存の正式公開・メディア永続化・Workers配備の承認を与えない。

作業順は (1) 正本/依存/検証の棚卸し、(2) 小さい移動と重複排除、(3) 記事データのアプリ外への独立、(4) 編集PWA。CMSを先に作って複雑な現行pathへのラッパーを増やさない。

## データと機能の所有者

| ドメイン | 目標所有者 | 正本と責務 | 所有しないもの |
| --- | --- | --- | --- |
| コンテンツ | `content/{articles,notes,projects,tools,pages}` | 各MDX、固定ContentId、タイトル、description、分類/タグID、本文。公開後の日付 | サイトのCSS、JS実装、Cloudflare object key、Article Jobの秘密入力 |
| コンテンツ登録 | `content/registry` | taxonomy、記事と媒体の論理的結合、公開来歴、redirect。現在のregistryを挙動不変で段階移設 | 画像の実byte、権限・token、実行コマンド |
| 契約と純粋処理 | `packages/content-contracts`、`packages/portable-content` | 共通型、MDX部品propsと安全性検証、導出catalogとselector。ブラウザ/Node双方で再利用可能なものを優先 | Astro UI、GitHub資格情報、ファイル移動やネットワーク書込み |
| 静的公開サイト | `apps/site/src/features`、`apps/site/src/shared` | Astro routes/SEO/discovery、見た目、共有blocks、header/footer等 | 記事執筆・PR実行・R2書込み |
| 編集画面 | `apps/editor` | スマホ/PC用PWA、下書き管理、共通block編集UI、preview、Git同期 | 公開判定、R2 credential、Article Jobの監査状態の捏造 |
| 記事制作 | `packages/article-pipeline` | 記事の状態・根拠・監査・候補と来歴の契約 | CMS UI、公開ページのレイアウト |
| メディア | `packages/media-ingest` + `ops/media` | 原本の正規化、variants、rights、A/B/C保存と確認を呼ぶ独立workflows | MDXの執筆、一般の画面描画 |
| ブラウザツール | `apps/site/src/features/tools` + `ops/browser-tools` | 紹介ページ、独立ソースの選択済み固定release/ライセンス/統合 | 原ツールのビジネスロジック複製、latest releaseの暗黙取得 |
| 検証・リリース | `ops/{ci,qa,build,deployment}` | CLI本体と検証・成果物形成・配信手順 | 記事の正本、UIコード |
| CIの入口 | `.github/workflows` | jobs、permissions、同一runの依存と承認境界 | 複数の実装されたvalidator |

`ops/`は現行`tools/`、`scripts/`を機能単位で統合する**目標**。GitHub Actions、root workspace設定、`schemas/generated`、`vendor/`、旧移行の署名済み履歴は理由なく移動しない。実ファイルの段階的移行ごとに現在の正本一覧を更新する。

### 依存方向

- `apps/site` → コンテンツデータ、共有契約・純粋処理、公開描画部品。
- `apps/editor` → 同じ共有契約・純粋処理。Astroの内部実装や`apps/site/src`を直接importしない。
- `ops` → データ・`packages`・明示されたアダプタ。CLIが処理を実行し、`packages`へ隠れたIOを押し込まない。
- `packages/site-validators` → 共通契約/処理・明示的なcontent reader。公開アプリのUI実装に逆依存しない。
- `packages`→`apps/site/src/lib`、または`packages`↔`apps`の相互importを減らし、最終的に禁止する。移行中は実pathごとに例外と撤去条件を記録する。
- `content`は実行コードをimportしない。記事本文は許可された意味的MDX部品だけを使う。

### 部品のIDとスタイル

記事中の`Figure`・`Gallery`・`Steps`・`BarChart`・`ArticleEndnote`等の**部品種別ID**は、`semanticContentModulePropsSchemas`に紐付く共通の定義から選ぶ。画像/図の**asset ID**とは別。編集PWAは同じ部品スキーマに基づいてフォームと挿入コードを生成し、保存する本文はportable MDXのまま。特別な記事専用HTML/CSS/任意JSを要求しない。

部品の表示実装・関連CSS・テストを同じ機能の所有下に置く。Tailwind CSS 4をデザイントークンと汎用utilityの基盤とし、複雑な部品固有規則はその部品が所有するCSSに残す。すべての規則を1つの巨大なglobal.cssへ集約したり、部品ごとのCSSを無条件に複製したりしない。生成HTMLのclass名文字列を`ContentLayout`で検索する暗黙のCSS判定は、部品宣言または安全に定量確認した共通bundleへ置き換える。

`BaseLayout`はナビゲーション/メタ/共通shellのみ、記事詳細は`features/articles`、taxonomy/searchは`features/discovery`、特定ツールのPWA設定は`features/tools`が所有する。

## 作業ワークフロー（入口・入出力・承認）

| 入力/操作 | 共通処理 | 生成するもの | 権限/公開境界 |
| --- | --- | --- | --- |
| 人間の新規記事/改稿 | editor/CLI → draft contract → portable MDX検証 → 必要なArticle Job段階 | 非公開下書き・preview候補 | 新規IDは一度のみ発行。初稿に公開日を強制せず、正式公開時に決定 |
| AIの新規記事/改稿 | 同じdraft contract。producer種別と実証拠を保持し、正規intake・監査につなぐ | 同じportable MDXと候補 | AI本文をhuman稿と偽装しない。external disclosure条件を維持 |
| 画像/GIFの追加 | 独立メディア取込 → 権利・privacy・変換/照合 → 登録 | asset IDと表示用variant/参照 | 原byteやcredentialをGit本文へ入れない。R2登録/公開許可と記事公開は別 |
| 部品の挿入 | 共通schemaから部品種別・propsを選びMDXへ記述 | Figure/Steps/Chart等の参照 | 新部品はschema・renderer・CSS・testを一緒に更新 |
| 分類/SEO/検索 | 共通taxonomy + content catalogから導出 | 一覧、purpose/technology/category、全文索引、RSS、sitemap、related、OG/JSON-LD | 記事が手書き生成物や別のSEO正本を持たない |
| Browser Toolの追加/更新 | 独立repositoryの固定releaseをreview/sha/license照合してadopt | pin/lock/紹介MDX/描画wrapper | latest追従禁止。ビルド時取得は完全pinとoffline/復旧条件を満たす後に検討 |
| 公開前検証 | 当該候補と同じsource/asset → UI/SEO/link/accessibility/権利/契約/CI | approved candidate + PR用の固定差分 | 単なるpreview表示・CMS保存は公開承認ではない |
| 正式公開・配備 | 既存手動媒体保存/承認 → 正規export → main CI → production artifact → Wrangler | 追跡可能な公開revisionと配信物 | owner/main/Environment・readback・rollbackを維持。CMSから直接production呼出し禁止 |

### CMSを静的配信する場合

`apps/editor`は同一workspaceに含めるが、認証/権限を与えない単なる編集UIとして初期構築する。`/editor/`の静的PWAでIndexedDBに下書きを保存し、Service Worker scopeを`/editor/`に限定する。公開static assetに秘密の原稿、API token、private preview、R2 credentialを含めない。**配信先が同一であることは認証の代替ではない。** 最初の版はオフライン草稿作成とローカルエクスポートまで。Git同期は認証方式・非公開下書きの格納先・競合制御が成立してから有効化する。公開repoのブランチ/PRは非公開原稿の保存先にしない。

## 現行コードでの移行対象

| 優先 | 現行path/依存 | 変更単位 | 検証・撤去条件 |
| --- | --- | --- | --- |
| R1 | `apps/site/src/lib/discovery/catalog.ts` を`packages/site-validators/src/site-content.ts`等がimport | catalog/feedの純粋処理を`packages/portable-content`へ移設してvalidatorから直接利用 | catalog/feed回帰、TypeScript、Astro build、公開catalog一致。旧entrypointは全callsite移行後に撤去 |
| R2 | `components/content/`に記事・検索・ツール・部品が混在 | `features/articles`、`features/discovery`、`features/tools`、`shared/blocks`、`shared/shell` | route/HTML/メタ/ARIA/CSS、全部品の描画・操作 |
| R3 | `apps/site/src/content/`と`content-registry/` | `content/`を表示アプリから独立。Astro loaderと既存readerを同じ正本へ | UUID/route/redirect、media/provenance、taxonomy/検索/日付、旧44記事holdの保存 |
| R4 | `tools/authoring`、`tools/publication`、`tools/build`、`scripts/release`、`tools/qa` | `ops/`に処理を機能単位で再配置。共有pure logicは`packages`のまま | root scripts、workflows、snapshot、秘密情報と手動承認の境界 |
| R5 | CMSが未実装 | `apps/editor/`にPWA。共通契約/部品manifestを共有 | iPhone/PC、offline reopen/保存喪失、同期競合、MDX往復、無認証のGit/R2更新拒否 |
| R6 | `vendor/browser-tools`と配布済みrelease pin | 安全な取得・キャッシュ方式を実験し、現行vendor方式と比較 | pin/hash/license一致、cache miss時、GitHub障害時、復元/rollback |

R1は配備や表示の変更を伴わない小さい初期PRとする。R2〜R6はそれぞれ独立PR、既存検証済み工程を再利用し、変更した範囲を明示する。

## CIの実行・並列化契約

**観測済みベースライン**: `.github/workflows/ci.yml`は`scope`の後、`source-validation`・`publication-fixtures`・`common-tool`・`producer`を並列開始し、`producer`が同runの独立gate成功を確認して**ビルド1回のimmutable release package**を固定する。Windows consumerはそのartifactを検証。公開ブラウザsuiteは7領域を並行実行。従って「これから並列化を初導入する」という理解は誤り。

**次の改善**: 長い`ci:source:preflight`内の相互独立checksと、producerのbuild前/後検証をDAG化する。機能別fixtureを実測のcritical pathに沿って独立並行実行するが、同じ入力を使うchecksをむやみに別jobへ分けて毎回`npm ci`の時間を増やさない。最終公開成果物を読む検証は**同一build artifactを共有**。新検証は既存の相応のsuite/グループへ統合し、ただの追加直列`&&`で全CIの待ち時間を増やさない。

- 分類`ci-impact.mjs`は**shadowのみ**。単なるpath一致で必須検証をskipしない。README等のprose-only既存例外は維持。
- 各job/suiteのstart/end、queue、cold/warm、最長経路を実計測し、全チェック時間の合計ではなく全CI wall timeで評価する。
- PRの対象機能に閉じた検証と、main/releaseで必須のcross-feature統合E2Eを区別。変更影響が証明されないときはfull fallback。
- 同一run/attempt/SHAの必須結果、package hash、Windows consumer、媒体権限、production Environment、手動deploy/readbackのgateは緩めない。
- 並列実行で共用書込みdirectory、cache key、port、固定fixtureを競合させない。fixtureは各job/runner tempに隔離する。
- 基準として2026-11-16の成功実行`43831335629`は作成から終了まで7分35秒。改善は同じ環境の複数実行で比較する。

## 完了条件

1. 新規記事を人間がGUI/CLIで作り、画像なし・画像あり・表/式/図/手順・エンドノートをプレビューできる。AIも同じ形式で作成できる。
2. 本文に記事固有CSS、ビルド専用paths、R2 object key、SEO生成物を記載しない。部品は許可されたID/propsだけで表現できる。
3. Article Job、Media Registry、R2登録、search/tag/purpose/category、公開とrollbackの単一正本を損なわない。
4. 既存の公開URL/ContentId、indexable集合、日付、タグ分類、SEO、本文表示、主要viewport、媒体参照、権利/来歴、旧記事holdが予期せず変化しない。
5. `packages`は`apps`へ逆importしない。例外が残る場合は所有者・理由・撤去PRを記録する。
6. CIの検査網/同一run gateを保ち、導入後のwall time・最長経路の増加を測定し、既定の並列化とビルド1回を維持する。

## この提案の扱い

本書は作業の境界/順序の合意候補で、ディレクトリ全面移設や本番配信の即時許可ではない。既存仕様との差分は小さいPRにし、個々の検証・レビュー・承認を通して順次採用する。履歴証跡/署名済みrecordを新pathに書き換えて整合したように見せない。
