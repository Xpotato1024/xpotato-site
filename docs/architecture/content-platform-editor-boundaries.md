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

`ops/`は現行`ops/`、`ops/ci/`を機能単位で統合する**目標**。GitHub Actions、root workspace設定、`schemas/generated`、`vendor/`、旧移行の署名済み履歴は理由なく移動しない。実ファイルの段階的移行ごとに現在の正本一覧を更新する。

### 依存方向

- `apps/site` → コンテンツデータ、共有契約・純粋処理、公開描画部品。
- `apps/editor` → 同じ共有契約・純粋処理。Astroの内部実装や`apps/site/src`を直接importしない。
- `ops` → データ・`packages`・明示されたアダプタ。CLIが処理を実行し、`packages`へ隠れたIOを押し込まない。
- `packages/site-validators` → 共通契約/処理・明示的なcontent reader。公開アプリのUI実装に逆依存しない。
- `packages`→`apps/site/src/shared/lib`、または`packages`↔`apps`の相互importを減らし、最終的に禁止する。移行中は実pathごとに例外と撤去条件を記録する。
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

**Git同期を実装した後の通常記事制作では、公開GitHub上の編集ブランチとDraft PRを標準経路とする。** 公開Git上のソース/旧PRの検索露出は、一般技術記事の制作における明示的な残余リスクとして受容する。未承認の記事はXpotatoの正式なHTML/検索/RSSには配信しない。機密性が必要な案件だけprivate経路を選ぶ。受注案件・未発表製品情報のprivate repositoryと将来のpressサブドメインを含む境界は[公開Git下書きとprivate案件サイト](public-git-drafts-and-private-press.md)に分離する。

## 現行コードでの移行対象

| 優先 | 現行path/依存 | 変更単位 | 検証・撤去条件 |
| --- | --- | --- | --- |
| R1 | `apps/site/src/features/discovery/model/catalog.ts` を`packages/site-validators/src/site-content.ts`等がimport | catalog/feedの純粋処理を`packages/portable-content`へ移設してvalidatorから直接利用 | catalog/feed回帰、TypeScript、Astro build、公開catalog一致。旧entrypointは全callsite移行後に撤去 |
| R2 | `components/content/`に記事・検索・ツール・部品が混在 | `features/articles`、`features/discovery`、`features/tools`、`shared/blocks`、`shared/shell` | route/HTML/メタ/ARIA/CSS、全部品の描画・操作 |
| R3 | `content/`と`content-registry/` | `content/`を表示アプリから独立。Astro loaderと既存readerを同じ正本へ | UUID/route/redirect、media/provenance、taxonomy/検索/日付、旧44記事holdの保存 |
| R4 | `ops/authoring`、`ops/media/publication`、`ops/build`、`ops/deployment`、`ops/qa` | `ops/`に処理を機能単位で再配置。共有pure logicは`packages`のまま | root scripts、workflows、snapshot、秘密情報と手動承認の境界 |
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

## 2026-11-16: 編集契約・Gitブランチ・下書き媒体・移行互換性の追加設計

次の区分を明確にする。**合意した方向**: (a) Markdown/MDX編集とブロック編集の両立、(b) CMSによるソースブランチ指定、(c) 下書き媒体は端末内、媒体取込は独立、(d) 共通部品のschema正本は共有、(e) 人間に無関係な監査を一律強制しない。**未実装/レビュー対象**: 認証付き同期、具体的な媒体preview/HEIC変換経路、公開用の軽量な人間稿ゲート、移行検証の自動化。既存の公開許可・契約を暗黙に緩めない。

### 編集UI: ブロックとソースの併用

- ブロック編集は通常の文章、Figure/Gallery、Steps、Callout、表、数式、Demo、ArticleEndnoteを対象にする。本文の正本はportable MDXであり、画面固有のHTML/JSONを第二正本にしない。
- 「ブロック編集」と「MDXソース」を同じ下書きに対する二つのビューとして用意する。ブロック編集だけでは表現できない許可済み構文は、破壊的な丸め込みをせずソース編集に残す。未対応を黙って消したり、書式を全体再生成して不要なdiffを増やしたりしない。
- schema/部品IDは`packages/content-contracts`、MDX構文と検証は`packages/portable-content`、HTML表示はサイト部品が所有。CMSで入力UIを生成しても、Astroコンポーネント内部のDOM/CSSを複製しない。
- 保存時にParse→Edit→Serialize→Parseの意味的な往復検証を行い、実Astroでのプレビューを公開前の最終確認とする。編集時の簡易previewと正式な描画previewは明確に区別する。

### CMSのGitソース選択と安全な書込み

`apps/editor`は、(1) **読み込み元リポジトリ・ブランチ（sourceRef）**、(2) **編集反映先ブランチ（targetRef）**、(3) **読み込み時base commit SHA**を管理する。ブランチ名だけを変えるとregistry/schema/本文が食い違う可能性があるため、表示と保存は同じ選択snapshotへ固定する。

- ブランチ選択UIは閲覧・プレビューに必須。変更前に未保存データを独立下書きとして確定し、別ブランチへ暗黙の上書き/コピーをしない。データはrepo/ref/contentIdの組とローカルdraft IDで区別する。
- 原則mainは読取り専用、対象PR/編集ブランチへ書込み。targetRefを新規に作る場合もbase SHAを固定し、PRは選択baseへ向ける。main直push、既存ブランチへのforce pushは禁止。
- GitHub APIによるファイル更新には現行file blob SHAまたはbase tree/commit参照を使用し、保存直前にbranch headが変更されていれば競合として停止・diff提示・明示的な再適用を要求する。成功していない書込みを同期済みと表示しない。
- 公開repoのfeature branch・Draft PR・履歴は**秘密の保管先ではない**。ローカル私有下書きは端末内を既定とし、オンライン私有下書きが必要になれば、既存の認可済みprivate経路か別途設計したprivate storageを使う。ブランチ選択だけで私有化は達成しない。
- PWAに汎用GitHub書込みtokenを常設しない。認証/権限が設計・実装されるまではローカルexport/importまでであり、公開staticファイルへcredentialを組み込まない。
- **Git同期と媒体同期は別**。MDXだけをGitへ送っても未登録の端末内写真は別端末へ移らない。CMSは不足素材を明示し、プレビュー不能な状態を「完全同期」と表示しない。

### メディアの下書き→正規登録→公開の同一性

下書き作成時、本文の`assetId`（そのContentId内で一意の論理名）を確保し、原本ファイル名、端末内blob、R2 object keyと分離する。同じ意味の画像を差し替えた場合は論理assetIdを維持できる。別の意味の素材には別assetIdを発行する。

| ID/値 | 例 | 正本/役割 |
| --- | --- | --- |
| `contentId` | UUIDv4 | 記事の永続識別子 |
| `assetId` | `contact-setup` | MDXの`<Figure asset="contact-setup" />`が参照する論理ID |
| `localMediaId` | 端末内UUID | IndexedDB Blob/一時previewを識別。記事に埋め込まない |
| 元ファイル名・format | `IMG_0123.HEIC` | 著者に見せる入力情報。assetId/R2名にはしない |
| 元データSHA | SHA-256 | 取込時の同一性と差替え検知 |
| R2 object key | 正式変換結果のcontent-addressed path | Media Registry/配信のみが所有 |

**preview解決**: 同じ`contentId + assetId`を、下書き時はローカルの媒体候補レコードからIndexedDB Blob/対応形式のプレビュー派生物に解決し、正式公開時はMedia Registry経由の検証済み配信variantに解決する。本文MDXを書き換える必要はない。`blob:` URLは画面表示中だけ生成し、永続MDX/Registry/Gitへ保存しない。画面破棄時に安全に解放する。

**HEIC/HEIF**: `media-ingest-contract`はHEICを入力対象に含み、専用decoder toolchainによるorientation適用、EXIF/GPS除去、canonical WebPへの変換を規定。ただし現行A4ローカル候補preview経路は`HEIF`を対象外としている。したがって「SiteがHEICを既に全工程でサポート」と表示してはいけない。CMSでは原本を端末内に保持し、ブラウザが安全にdecodeできれば一時previewを生成。decodeできなければ未変換/preview保留として表示し、明示的な対応toolchain経路で変換する。HEICの任意オンライン変換サービスへ黙って送信しない。変換後の公開成果物はJPEG/WebP/AVIF等の規定形式を用いる。

**公開前と公開の境界**:
- 入力時: File/BlobをIndexedDB等に原形のまま保持。MIME/拡張子/実byteを確認し、ファイルサイズ、破損、向きと画像を確認。保存失敗時に成功扱いしない。
- 執筆時: ローカルプレビュー、alt/キャプション、素材出所と必要な権利確認。画像なし記事や未登録画像の草稿作成を妨げない。
- 公開準備: 独立媒体取り込みでprivacy-normalized canonical、variants、rights、画質・出典・実byte/hash、候補previewを確認。現在のA/B/C、本人レビュー・Environment・保護契約を維持する。
- 公開後: Media Registryの同じassetIdで配信物を解決。R2 object key/原本名を本文へ露出させない。未登録素材が残っているなら公開候補として通さない。
- 端末変更: ローカル素材を別端末に移す場合は、草稿と対象binary・hashを含む明示的なexport/import bundle、または将来認可される私有media syncを必要とする。Git文章だけでは完結しない。

**保管安全**: IndexedDBは端末とブラウザの保存容量/削除の影響を受ける。端末保存だけを耐久バックアップと呼ばず、明示export/import、保存容量監視、削除警告、復旧テストを提供する。ブラウザ内の入力データは本人操作以外の送信をしない。

### 監査の適用範囲と人間向けの軽量経路

検証を「基本的な機械的整合性」「該当する媒体の権利/プライバシー」「内容のリスク/AI出自に応じた追加確認」に区別する。**執筆者がhumanなら必ず全Article Job段階を通る**というUI/UXにしない。一方、AIを使って監査・書式・出典照合を代行できても、本人しか判断できない権利/出所の事実をAIが推定で承認しない。AI制作の来歴をhumanへ偽装しない。

現行の公開Blogはhero/social、rights/provenance、Article Jobの正式出版を要求する。軽量人間投稿、画像なし公開、SNSカードの共通自動生成などを許可するなら**現行の公開contractの変更と通常のレビューが別途必要**。本書はそのゲートを緩和しない。公開日の正本は引き続き正式export/実配信時に確定し、下書き入力へ先回りして強制しない。

### ファイル移設の互換性: 何を、なぜ検証するか

同じ記事の本文/内容で`content`から`content/`へ移動しても、Astro glob loader、file-based entry id、相対asset resolver、検索index、RSS/関連記事、媒体Registry、URL/redirect、Tailwind source detection、CI file path判定が影響を受け得る。ディレクトリが綺麗になったことと公開の同等性は別。

移設前の固定commitで公開catalogと代表ページ・検索・媒体・認可済みrelease成果物を比較用に作り、同じNode/npm/lock/入力を使った移設後buildと照合する。保証するのは次の**意味的な不変条件**:

| 領域 | 必須の照合 |
| --- | --- |
| Identity/route | ContentId・公開URL・旧URL redirect・slug・公開/hold集合 |
| Editorial | タイトル・description・分類/タグ・公開日/更新日・本文・共通部品の指定 |
| SEO/discovery | canonical、OG/JSON-LD、sitemap、RSS、検索の文書集合と主要query、分類/目的/タグ一覧、関連記事、ホーム更新表示 |
| Media | `contentId/assetId`・Registryの媒体役割・rights/provenance・出典・配信URL/variant/SHA。誤再登録/公開しない |
| UI/interaction | 主要画面と320/390/1440px、図/式/表、font、レスポンシブ、ツール起動、CSS干渉、キーボード |
| Security/CI | private draft非混入、CSP、robots/noindex、build count、same-run artifact/hash、手動Environment/deploy gate |

ソースファイルの位置やビルドに伴うhash付きJS/CSSファイル名が変わるだけで**不適合とみなさない**。内容・表示・リンク・アクセス制御の不変性は保持し、差分を分類して説明する。以前の暗黙のimportやbase pathをcompatibility aliasで永久に増やさず、全callsiteを移した後に撤去する。

**移設前→移設後の順序**: 基準スナップショット → 正本の移動 → loader/reader/CLI/CI分類器の参照更新 → type/contract/build/ブラウザ比較 → 差分原因の確認 → alias撤去。既存の旧44記事hold、署名済み履歴、R2の実保存・公開承認状態を、移設によって勝手に変更しない。

### 決めたことと残る詳細設計

- 方針が確定したもの: Markdownとブロックエディタの両立、ブランチ指定可能なCMS、端末内での即時プレビューとオフライン編集、メディア正式取込の独立、共通部品契約の共有、Shadow DOMの延期（#218）。**下書き画像の非公開Draft R2同期は2026-11-16の料金確認を受けて目標設計として採用。実バケット/API作成、認証・予算ガードの実装とインフラ許可は別途必要**。
- 実装前に必要な検証/契約: (a) human軽量公開の最低権利・監査ルールとBlog hero/socialの扱い、(b) HEICの実機decode/一時previewと正式decoder bridge、(c) Git同期時のprivate保管先/認証/競合と媒体の別端末持ち運び、(d) 移設前後の比較試験。
- この追記は`status: proposed`の設計を精密化するもので、現行公開済み実装の機能や本番権限を増やさない。

## 2026-11-16 追記: 下書き段階でのR2保管案（検討中）

**設計目標として採用**。スマホとPCを行き来するCMSでは端末内保存のみより実用的であり、端末内プレビュー・オフラインを保ちつつ、認証後に未公開画像を非公開R2へ同期する。ただし、今回の追記は新しいR2 resourceやWorkerへの書込みを認可しない。

### 既存3領域と別の意味を持つ

- 現行A（private source）は**承認後のプライバシー正規化済みcanonical master**、B（public）は配信対象、C（protected）は公開byteの保護。Aは未審査原本の一般的な下書き置き場ではなく、Bはアップロードすると記事公開前でも公開アクセス可能、Cは一時下書き置き場ではない。
- **提案**: `private_draft_media`という独立storage classを設け、できれば専用の非公開R2 bucketに未審査HEIC/JPEG/PNG/GIF、プライベートなプレビュー派生物を保管する。専用の権限・保持期限・容量上限を持ち、既存A/B/Cの本番媒体credentialをCMSに流用しない。単なる同一bucketのprefix分離のみをセキュリティ境界と呼ばない。
- ドラフトの保存は「保存済み」であり、「画像の審査PASS」「配信許諾」「Media Registryの正式登録」「公開」を意味しない。R2 bucketの作成・binding・secret・controllerは`Xpotato-Server`側の別のインフラ承認を要する。

### 利用者の操作フローとID

1. 画像選択時に`draftId`、`contentId`、記事内で安定した`assetId`、端末内`localMediaId`を割当てる。ファイル名は表示用であり、URL/assetIdへ流用しない。ブラウザ内のBlobで即時プレビュー。
2. オンラインかつ本人認証済みになったら、専用下書きupload APIが`uploadId`に紐付く短命の許可を発行する。端末から私有R2へ非同期アップロードし、サーバー側でファイルのtype/bytes/size/hash・所有者/ドラフトとの結合を確認。クライアントへ永続R2 credentialを渡さない。アップロード中や未照合は「同期済み」と表示しない。
3. R2のドラフト用manifestで`draftId + assetId -> uploadId, sourceSha256, originalFormat, revision, previewStatus`を管理し、画像自体・原本名・非公開URLを公開MDX/Registry/Gitに入れない。実装時はmanifestの競合/複数端末編集・孤立uploadを検出し、atomic更新または検証可能なrevision制御を用意する。
4. 別端末は認証後にドラフトmanifestを取得し、アクセス権を確認して短命URLまたは認証付きread proxyで画像を表示する。HEICをブラウザが表示できない場合、独立した専用変換経路から**非公開のプレビューJPEG/WebP**を生成する。HEICの変換を通常の配信Workerで暗黙に可能とみなさない。
5. 正式公開候補は**元の私有下書きbyteを入力として**既存media-ingest・権利/個人情報確認・canonical/variant生成・承認・A/B/C保存を実施。同じ`contentId + assetId`を正式Media Registryへ登録し、MDXを変えない。媒体だけの先行公開許可は既存の別ゲートに従う。
6. 公開後または破棄後は、明示的な保持・回復・期限切れポリシーに基づいてドラフトbyteを整理する。参照中・オフライン作業中のデータを無確認で消さず、孤立upload/失敗/重複による容量増大を防ぐ。

### API/Workerとセキュリティ境界

- **静的PWAだけでは安全なR2アップロード権限を発行できない**。バックエンドの本人認証と、下書き専用に権限を限定した操作が必要。専用Worker等の認証付きAPIから一時的なS3 presigned PUT/GET URLを発行する方式か、認証付きWorker proxyを比較する。Presigned URLは短命のbearer URLであり、完全な秘密文字列として扱う。S3ドメインへのブラウザ直接uploadにはCORS設定が必要。
- 既存の公開サイトWorkerはR2 bindingを持たない配備境界を前提としている。CMS都合で現在の配信Workerへ広範なR2 binding/秘密資格情報を加えず、下書き用APIは実行/credentialの境界を隔離する。新しい公開ホスト名は必須ではないが、backend executionとinfra設定は新たに必要になる。
- 未審査HEICにはGPS/EXIF等が残る可能性があるため、private draft bucketの読み書きは厳格な認可を要する。プレビューは非公開、`no-store`等を適用し、署名付きURL・raw byte・previewを検索/CI artifact/公開gitに記録しない。
- アップロード容量・枚数・継続時間・ファイル種別、レート制限、アクセス監査、失効、クリーンアップは運用要件。CORSは認証の代わりではない。

### 運用と段階導入

- 最初のローカルCMS版は端末内作業とexport/importで成立する。**最終設計では非公開R2への同期を採用**とし、画像が存在しない別端末でも下書き本文を破壊しない。
- 下書きのソースブランチの変更と、R2素材の更新は別のトランザクション。ブランチ変更で写真を勝手に参照解除・上書きせず、`draftId/assetId`とrevisionを用いて競合を示す。
- Private draft storageをGit Media Registryと第二の正本として並立させない。下書きのasset mappingは私有manifest、正式な公開Media Registryは承認後のpublished asset mappingを所有する、というライフサイクル境界を明示する。

## 2026-11-16 追記: AI制作・人間レビュー・安全な削除のためのDraft R2

下書き画像の**認証付き非公開R2同期を目標設計として優先する**。理由は単なるスマホ/PC同期ではなく、AIが制作した図版を人間が同じ固定入力で監査できること、採用/棄却の管理と公開媒体の削除権限を切り離せること。前節の「導入未決定」は、機能的な目標の是非ではなく、実際のbucket/auth/API/予算/運用の設計と採用承認が残る意味とする。

### 固定した候補をレビューする

- AI・人間は生成元を明示して未審査媒体をDraft領域へ登録し、`draftId + contentId + assetId + revision + sourceSha256`で候補を固定する。ファイル名や単なる最新URLでは同一性を証明しない。
- 記事の本文とメディアmanifestが参照する候補revisionを固定する。CMSで画像を差し替えたらrevisionを進め、以前のレビューと承認は新byteに自動継承しない。
- 認証されたプレビューはDraft R2の原本または権利・プライバシー条件を満たす**私有派生物**を参照するため、監査者の端末へ原本を置いたり、静的サイトの画像処理を毎回ローカル実行する必要がない。ただしAstro/MDXのレンダリングや候補HTMLの生成・検証は依然必要。
- 非公開画像の署名付き閲覧URL/一時cookie/bytesを、公開build成果物、公開HTML、Search Index、PR artifact、公開Gitの差分へ入れない。私有previewは認証されたprivate sessionに限定し、プレビューURLの取り扱いとCSPを検証する。
- AIへ画像を渡して監査支援する場合も、外部モデルに送るbyteの明示的な許可・external-AI disclosure契約を守る。Private Draft R2への登録はAIへの利用許可ではない。

### 削除の故障領域を分離する

- Draftと既存A（承認済みprivate canonical source）/B（公開配信）/C（保護済み復旧画像）は**別のstorage classと権限境界**を持つ。CMSのDraftアップロード/削除APIはA/B/CのWrite/Deleteを一切持たない。可能ならDraftを専用bucketとし、prefix分離のみを権限隔離の根拠としない。
- 棄却はまずmanifest内の`rejected`/不可視化状態として記録する。即時物理削除は既定にせず、復帰可能な保持期間と削除猶予を設ける。誤棄却・承認変更・別端末の遅延同期を考慮する。
- GCは単なる`draft/`一括掃除ではなく、`draftId/assetId/revision`の生存参照、レビュー中の候補、未完了の取り込み、承認前の保留、保持期限、認可した所有者を確認する。削除計画のdry-runと監査ログを用意し、実際の物理削除はDraft専用の限定worker/credentialsに委譲する。
- 採用媒体はDraftからA/B/Cへ**検証済みの新規保存**として昇格し、対応するcanonical/variant SHAとMedia Registryを確認する。未審査の原本を公開用R2へそのまま移動したり、公開済みobjectを上書きしたりしない。公開とreadbackが完了してもDraft原本の削除は別の保持/復旧ポリシーに従う。
- A/B/Cには現在の承認・読み戻し・保護・復旧契約を維持し、Draftの棄却/GCを通じた公開媒体削除を権限上不可能にする。配信済みMedia Registryの参照先変更は独立した正式更新工程でのみ行う。

### 実装前に検証すること

1. 同一のAI生成図/写真をスマホ・PCの認証済みプレビューで、同じassetId/revision/hashとして閲覧でき、公開ルートへ漏れない。
2. 別端末で差し替えた際、旧レビューを失効させ、競合と再確認の必要性を表示する。
3. CMSの資格情報・棄却処理がA/B/Cのobjectに対しWrite/Delete不可であることを、隔離環境の負例試験で確認する。
4. 棄却・復活・取り込み途中・オフライン参照・孤立媒体に対するGCの保守的動作を確認する。
5. Private previewがローカルrawの転送や公開site buildへの非公開画像byte混入を必要としないことを検証する。Webページそのもののbuildが不要になったという誤認はしない。

追加のR2 bucket、認証付きAPI、保持/削除権限、費用、`Xpotato-Server`のInfra契約、実環境での認可/テストは後続の個別設計と承認事項。現行Draft PRで実BucketやR2操作をしない。

## 2026-11-16 追記: 金銭的コストの検証と条件付き採用

**結論**: Cloudflareの2026-10-30更新R2公式料金と既存media registryの登録予定量から、個人サイト向け下書き画像の非公開R2 stagingは**設計上採用可能**。ただし現在のCloudflareアカウント全bucket実請求量は、このrepositoryからは読み取れない。無料運用の断言や自動リソース作成は行わない。採用はアプリ側の明示的な利用枠と既存A/B/Cから分離された権限を条件とする。

### 公式単価と適用条件

2026-11-16確認。一次資料: [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)、[Storage Classes](https://developers.cloudflare.com/r2/buckets/storage-classes/)、[Object Lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)、[Cloudflare Billing Spend Management](https://developers.cloudflare.com/billing/manage/spend-management/)、[Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)。

| 項目 | Standard無料枠（月） | 超過単価・注意 |
| --- | --- | --- |
| Storage | **10 GB-month** | $0.015 / GB-month |
| Class A | **100万回** | $4.50 / 100万回。PUT/一部LISTなど |
| Class B | **1000万回** | $0.36 / 100万回。GET/HEADなど |
| Egress | 無料 | R2転送自体は無料。別の課金サービスと接続する場合は別 |
| DeleteObject | 無料 | ただし削除の安全性は料金とは別 |
| 追加bucket | **最初の10万bucket内なら無料** | 対象枠はアカウント内のbucket合算 |
| Standard minimum duration | **なし** | Infrequent Accessは無料枠なし、30日最低保持、取り出し課金もあるので採用しない |

Cloudflareは超過使用量をGB-month / 100万operation単位で**切り上げて請求**する。無料枠は**アカウントの全Standard R2利用量の合算**であり、新bucketに個別の10GB無料枠が増えるわけではない。R2 storageは請求期間の使用量の平均で評価され、単純な月間アップロード総バイト数とは異なる。

### 公開済み媒体台帳から分かること／分からないこと

2026-11-16のsite mainにある`content/registry/media/blog/`の2記事の登録内容を集計すると、論理asset 29件、重複hashを排除したcanonical master 29件 **約8.46 MB**、公開master+variants 153件 **約43.02 MB**。Protectedに同じpublic byte集合を一度保管する前提なら、原本＋public＋protectedの**登録予定合計は約94.49 MB**。これは**Git Registryに表れている対象だけの概算**であり、R2実使用量/履歴保持/他のbucket/保護コピーの実状態/請求画面の観測値を意味しない。現アカウントの消費量はCloudflare Dashboardまたは認可されたusage APIで別に確認する。

### 保守的な費用試算（ユーザーがサイズを指定していないため仮定）

仮定: Standard、30日間すべて保持、**既存Standard R2は合計2GB-month**、previewは原本と別byteとして計上、Operationsは既存利用と合わせて無料枠内、Workers実行料金や画像変換CPUは含めない。

| 仮想ケース | Draft画像とpreviewの追加GB | R2 Standard全体 | 超過storageの概算 |
| --- | ---: | ---: | ---: |
| 100枚×(5MB+0.5MB) | 0.55 GB | 2.55 GB | $0 |
| 500枚×(8MB+1MB) | 4.5 GB | 6.5 GB | $0 |
| 2,000枚×(8MB+1MB) | 18 GB | 20 GB | 約$0.15/月 |
| 5,000枚×(8MB+1MB) | 45 GB | 47 GB | 約$0.56/月 |

これらはアカウントの実利用数ではなく**仮定の容量計算**。百万operationの無料境界を越えると丸め課金のためClass Aが最初に$4.50、Class Bが$0.36となり得る（既存利用を含む）。小規模CMSの正常な画像操作はこれらの無料枠に比べて小さい見込みだが、無制限の再試行・一覧取得は避ける。

### 初期運用の推奨予算ガード

- Draft専用R2は**Standard**。アプリ側の**同時保持上限2 GB（10進GB）**を初期値として採用。旧案の「全画像共通で単独ファイル50 MiB」は不採用。画像の**取り込み元（最大24 MiB）**と、**最適化後のDraft保存object（通常写真4 MiB、技術図8 MiB、アニメーション8 MiB）**は別の上限とする。これは現行媒体処理の24 MiB上限に揃えた初期契約案で、HEICの実装済み全経路サポートを意味しない。通常外の大きな入力・保存は勝手に縮小やフレーム破棄をせず例外審査と別経路で扱う。下記「用途別保存上限」参照。
- 2GBをDraftでフル使用しても、ストレージ無料枠をアカウント全体で既に使い切っていた場合の**容量由来の追加請求は概ね$0.03/月**（Standard、GB単位の丸めを踏まえ、他サービス・他操作・為替/税を除く）。ただし実残量、API利用やWorker費用を確認しないまま**総額$0を保証しない**。
- Draft内の保存量が**75%（1.5GB）**で警告、**90%（1.8GB）**で古い棄却候補の整理提案。**100%（2GB）**では新規アップロードの署名発行を止め、既存の画像とレビューを維持する。新規アップロード・差替え前にreservationを確保し、並列uploadと失敗時の予約の解放・再計測を検証する。2GBはCloudflare側の強制上限ではなく、認証付きAPI側での予算制御。
- **棄却から30日間**は原則として復元可能にする。物理削除はDraft側のGC workerが参照・レビュー・取り込み状態を検証して行う。アクティブな下書きに一律30日のR2自動失効ルールは掛けない。孤立した未完了uploadには別の有限猶予と清掃を設定する。
- 同一hash画像の再アップロードを抑制できる範囲では重複保存を防ぎ、プレビュー用派生画像の解像度と容量を制限。大きなHEICやアニメーションの実データを繰り返しブラウザへ送らず、専用の小さいpreviewを使う。
- **Cloudflareには現在R2個別の強制支出上限を設定する機能はなく**、Workers/Durable Objectsのspending limitはR2使用料を含まない。Cloudflareのaccount-wide予算アラートと、Draftアプリ独自のquota/期限付きGCを併用する。アラートは課金を停止しない。
- 認証/署名URL発行のための軽量Workers APIはWorkers Free（公開料金で10万request/日、CPU 10ms/実行）が候補だが、認証実装とCPU予算が収まるかは別途検証する。Workers Paidへ移行する場合は**$5/月のアカウント基本料金**が加わる可能性があり、R2無料枠内だからシステム全体が必ず無料とは限らない。HEIC変換・非公開preview生成をFree Worker内で必ず実行できるとは仮定せず、別の処理環境で計測する。

### 結論と次の実装境界

**目標設計を採用**: Private Draft R2 staging + ローカル即時preview + 独立Media Pipeline + A/B/C公開媒体保護。上限2GB、Standard、限定署名、Draft専用資格情報/権限、棄却後30日復元・参照検証GCを初期予算/安全方針とする。

本書の`status: proposed`は維持。正規の設計/インフラ承認を省略して`Xpotato-Server`に新bucket/API/bindingを作成しない。実装前に(1)Cloudflareアカウント内の全Standard R2実使用量とA/B操作量、(2)採用する認証方式・Worker Free/Paidの必要性、(3)画像サイズとアップロード頻度の実測、(4)stagingの2GB quotaが正常に超過を拒否する試験、(5)公式料金が変更されていないこと、を検証する。実請求・予算ガード・公開の効果を確認してから配信する。

## 2026-11-16: CMS側の画像最適化と放置下書きの保管期限

**追加採用方針**: Xpotatoの画像は主として読者の理解を補助するため、CMS/AI制作側で**Draft R2へのアップロード前に用途別の画像最適化**を行う。入力原本の一律長期保管をDraft R2の標準とせず、レビューに必要な画質・ソース同一性・技術的証拠を守る。公開配信時のレスポンシブvariant最適化は従来どおりmedia-ingestが独立して実行する。画像取り込みの判断だけでサイト公開の権限が増えるわけではない。

### 2つの最適化を分ける

1. **Draft ingest**: 人間がCMSへ写真を追加した時、またはAIが図版を生成した時点で、共通のdraft-media profileを使って画像を分類し、必要に応じて寸法/形式を最適化する。スマホで対応codecをdecodeできない場合は私有の期限付き変換ワークフローを利用する。ブラウザ単独でHEICのdecodeを保証しない。
2. **Public delivery**: 編集後に採用された**固定したDraft入力byte**をcanonical sourceに正規化し、公開ページの描画幅/解像度に応じたAVIF/WebP/JPEG/PNGまたはanimation variantを生成し、既存のrights/review/A/B/C照合を経由して公開する。CMS圧縮済みの画像を「カメラ原本」「可逆な原画像」と表現しない。再エンコードによる画質劣化とlossless canonicalの容量増を計測し、必要に応じて原本保持例外または公開マスター処理を検討する。現行canonical/source契約を暗黙に緩めない。

### 媒体タイプ別の初期プロファイル候補

| 用途 | Draft時の選択 | 品質を守る条件 |
| --- | --- | --- |
| 通常のiPhone写真・装飾写真 | 長辺2560px以下、WebP品質80〜85を初期比較候補。出力byteが増加・画質不足なら自動採用せず入力維持・例外へ | 被写体、向き、色、質感、重要箇所の判読 |
| AI生成の説明用イラスト | 余剰解像度を削減し、文字/輪郭を比較してWebP等へ。必要な場合はlossless | AI原本のsource hash/producer記録と変換後shaを区別 |
| UI screenshot、図中の文字・数式・グラフ | 原則WebP lossless/最適化PNGまたはsanitized SVG。必要な原寸/倍率を維持 | 文字・目盛り・線の判読と実際の観測事実 |
| 透明背景・図解 | alphaを保持しWebP lossless/PNG/SVGなどから選択 | 透明度、輪郭、ラベル |
| animated GIF / WebP | animation専用の有界profileを利用。未対応形式は保留し、静止画に暗黙変換しない | frame count、delay、loop、順序と情報の意味、posterの対応 |

この2560px/quality 80〜85は**確定の一律変換ではなく、実画像で評価する初期候補**。特にHEICは既に高圧縮であり、WebPへ変えると逆にサイズが増える場合がある。技術的証拠となる写真や長期再処理が必要な素材は原本/可逆マスターの維持を優先する。全写真の無条件lossy圧縮は不可。

- Draftには原則「レビュー可能な編集用マスター」1個と必要な小型private previewのみ置き、多形式の公開variantは先行生成しない。撮影機器のGPS/EXIFを含む生入力は、例外を除きprivate Draft R2の長期保存対象としない。
- 入力の`sourceSha256`、採用済み`draftMasterSha256`、`transformProfileId/version`、幅/高さ、媒体種別、ロスの有無、原本保持の要否をmanifestへ記録。内容改変時はrevisionを進め、旧reviewを流用しない。原本を端末に残したか/消したかを明示し、不可逆な圧縮がその唯一の再処理元になる場合は保存前に明示する。
- プレビューが見えることと公開時の正しさは別。文字拡大/スマホ幅の判読、図の根拠、画像内テキスト、色、orientationを対象としたテストを設ける。
- **性能はR2の保存byteだけではない**。公開側は実際に配信される画像variantとsrcset/sizes、遅延読込、CLS/LCP、画像デコード、モバイル回線を計測する。ローカルpreviewだけ小さくして公開HTMLのダウンロードが重いままなら不合格。

### 下書きの状態・保管期限（運用初期値、導入前に検証）

下書き本文と媒体候補を同じ`draftId`で管理するが、本文の編集履歴・Media Registryの正式保存物・Article Jobの来歴保存とは別の保管契約を持つ。画像の個別`rejected`状態と、下書き全体の`inactive/archived`状態は混同しない。

| 対象・状態 | 初期ポリシー | 削除前の条件 |
| --- | --- | --- |
| 編集中・レビュー中・明示keep | 時間による一律削除なし | 編集/プレビュー/AI job/保留中は削除対象外 |
| 未編集30日 | CMS内で放置候補を通知 | メール通知に依存せず次回ログイン時にも表示 |
| 未編集60日 | `archived`へ自動移行。編集は再開で復帰 | アーカイブは物理削除ではない |
| 未編集90日 | `delete_candidate`として整理リストへ。30日の取り消し猶予を設ける | 固定preview/review/新しい更新/hold/Gitとの関連を確認 |
| 棄却画像 | 棄却後30日間復元可能 | 生きた下書き/参照/進行中の監査に必要なら削除不可 |
| 放棄された未完了upload | 失効/完了不能を確定して短期整理 | 有効な転送の誤削除を防ぐ |
| 正式公開済み記事の元Draft | 公開・A/B/C全byte readback・Git持続来歴が完成した後、Draftコピーだけを整理対象化 | 正式なcanonical source/public/protected/復旧証跡を一切削除しない |

物理削除は、候補IDとR2 object SHA、referencing drafts/media/AI job、pending review、retain/hold、本人権限、保管期限を照合する**GC専用の限定権限**で行う。アプリ側2GB quotaに近づく場合も、生きたデータを無断削除して空きを作らない。必要な場合は本人が候補を選択する。

**重要**: R2の標準Object Lifecycleは主としてobjectのアップロード/作成時点からの経過日数とprefix等で適用され、`draft.lastEditedAt`・レビュー状態・AIの未完了作業を解釈しない。活性Draftに対し一律90日expireを設定しない。定期的なアプリ側GCがmanifestの参照と状態を解決し、eligibleと証明したobjectだけを物理削除する。R2 Lifecycleは対象を限定したorphan/未完了uploadなどの**補助的な上限対策**にする。

### 実装の検証条件

- 人間CMSとAI画像制作が、用途分類・profile ID・容量検査・入力/編集マスターhashを共有し、別系統の同名アルゴリズムを持たない。
- HEIC、JPEG、PNG、細かい文字を含むグラフ、透過PNG、GIF/animated WebPについて、元サイズと変換後のbytes・画質・フレーム同一性を確認する。単純な圧縮率だけでPASSとしない。
- 画像マスター変換後の取り込みを既存canonical/公開メディア契約と突き合わせ、必要なら例外sourceの保持/公開改修を別PRで扱う。
- 長時間放置したDraft、復活したDraft、棄却画像、AIのレビュー中、複数端末・ブランチ競合、readback未完了の公開記事を用いて、GCが公開媒体を削除しない負例試験を行う。
- Cloudflare料金はStandardの10GB-month無料枠が**アカウント全体共有**であることを前提に、Draft+既存A/B/Cの総保存量、Class A/B、Workers/変換コストを計測する。Draft 2GBの上限は維持する。

本節は採用した**方向性と初期値の設計提案**であり、変換・期限処理・Cron/Worker/API・R2 Object Lifecycleの本番設定をまだ実装していない。

## 2026-11-16 追記: 50 MiB上限の撤回と静止画/GIFの別プロファイル

**決定**: Draft R2の汎用50 MiB/object制限を撤回。単なる原入力の受け入れ上限ではなく**R2に実際に残る最適化後byte**を制御する。静止画とanimationの上限・内容同一性は別に規定する。現在の公開Media Pipeline/A4の既存制限を黙って変更しない。

### 用途別保存上限（初期候補、実素材で検証後に固定）

| 種別 | ローカル入力/変換受付の初期上限 | Draft R2標準保存上限 | R2保存byteの目標 | 処理方針 |
| --- | ---: | ---: | ---: | --- |
| 写真・装飾的なAIイラスト | **24 MiB** | **4 MiB** | 1 MiB以下 | 長辺/画質比較。HEIC→WebPでかえって増えるなら実byte・画質で選択 |
| 技術図・UIスクリーンショット・根拠画像 | **24 MiB** | **8 MiB** | 2 MiB以下 | 元の意味に必要な解像度と文字/画素を維持。可逆マスターまたはSVGを優先 |
| GIF・animated WebP | **24 MiB** | **8 MiB** | 4 MiB以下 | 専用animation profile。フレーム時刻・再生内容・loopを保存し、静止画扱いや無断の間引きを禁止 |

「入力上限」は端末/一時変換境界の受入れ条件であり、24MiB原本をR2に保存してよいという意味ではない。JPEG/HEICの入力ファイルが24MiB以下でも展開時の画素数・メモリ・CPUが過大になり得るので、header/metadata検査と実処理限度を別途適用する。CMSの通常R2 upload APIは**変換後のbyte**に対して各保存上限を検証。上限超過時には、理由と実容量を示して明示的な再編集/例外審査へ進める。写真が1MiBに収まらないからといって無断で情報を削除しない。画像の原本保持が必要な例は別のprivate受入/保管契約を設け、lossy Draft masterを唯一の厳密証拠と呼ばない。

### アニメーションでの判断

- 現行実装/設計`packages/media-ingest/src/animation.ts` / `docs/operations/animated-article-media.md`では、入力最大24MiB・600 frames・総64Mi pixels・一巡120秒・各方向8192px以下。これらは**安全上限**であり、Draft/配信向け推奨容量ではない。現行デコード/アニメーション検証処理を再利用する。
- 通常のGIF入力は時間軸/全表示フレームを検証し、**lossless animated WebP**への変換を第一候補とする。元より大きくなる場合は元GIFをPrivate Draftに残す選択肢を比較し、公開用に再変換可能かを別途検証する。ファイル名と拡張子だけでは内容を確定せず、実bytesで検証する。
- **時間・フレーム意味の保存が必須**。勝手なfps低下、フレーム間引き、同一でないフレームの統合、速度変更、loop変更、単一静止画化は不可。既存の`assertAnimationPlaybackEquivalent`相当の時間軸上の画素同値を変換後に確認する。縮小する場合は入力を同じ寸法へ縮小した結果と比較する。
- GIFは人間が監査できる小さな**静止poster**を別に作り、再生停止/reduced-motion/JavaScript offで表示する。posterもDraftの総容量に算入する。技術的証拠が必要な場合は原本または復元可能な意味的データを別の承認されたprivate経路へ保持する。
- 大きな動きをlossless animated WebPで8MiB以下に収められない場合は、勝手に低fps化せず**容量超過・動画等の別方式を検討する対象**として報告する。WebM/MP4は配信効率で有利な例があるが、現在の正式Media Pipelineはvideo対象外なので本改修では実装しない。動画対応は別設計/別の公開契約変更。
- サムネイルやposterはDraftの私有previewである。公開前に無承認の静止ポスターを配信可能なURLへ出さない。

### 予算と試験

- 既存のDraft全体2GB quota/75%警告/90%整理提案/100%新規upload拒否、棄却30日復元、参照確認GC、A/B/C削除禁止は維持。全バケットのStandard 10GB-month無料枠とAPI料金は別途アカウント合算で検証する。
- 実測ケース: iPhoneの10MB超HEIC、AIイラスト、文字入り技術図、透過図、シミュレーションの短いストロボGIF、長く大きなGIF、アニメーションの時間軸の破壊ケース。入力サイズ・R2マスターサイズ・private preview・最終公開variant・モバイル転送量・目視の判読を比較する。大きな変換後object、壊れた入力、展開爆弾、情報損失、同一hash再送、超過quotaを安全に拒否。
- 入力形式の判定・実際のpixel/timing/hashと処理profileは`packages/media-ingest`が所有、CMSは同じ変換API/契約を利用する。24MiB/4MiB/8MiBという値が文書とコードで二重SoTにならないよう、採用時に一つのmachine-readable policyを作り、この節を**目標値と理由の記録**へ変える。

本節は**設計変更のみ**。実バケット・アップロードAPI・encoder・GIF Media Registry・下書きGC・本番配信は改変しない。
