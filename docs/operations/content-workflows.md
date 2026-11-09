---
status: canonical
owner: development
last_verified: 2026-11-02
---

# コンテンツ追加・更新の入口

作業コードの所有と旧資産の保留理由は[toolsの案内](../../tools/README.md)を参照する。通常編集は次の入口を使う。記事・画像の保存や公開、PRのReady・merge・配信の許可は、この手順の存在からは発生しない。

| 作業 | 最初の操作 | 人が編集する正本 | 自動生成されるもの |
|---|---|---|---|
| 記事追加 | `npm run site -- article init …` | `.local/article-jobs/<job>/working.md`、同Jobの根拠・図案 | ContentId、記事URL、候補、保存後のMDX/Registry/compact来歴 |
| メモ追加（未採用候補） | `npm run content -- note create …` | `apps/site/src/content/notes/<slug>.mdx`（必ず下書き） | UUID、既存schema・layoutのmetadata、公開時の共通discovery |
| ツール追加 | `npm run browser-tools:author -- create …` | 独立tool sourceのcore/UI/adapter、配置JSON | 固定artifactからのvendor/registry/wrapper/下書きページ |
| スタイル更新 | 対象に応じて`apps/site/src/styles/`を編集 | 下表のCSSと所有component | ビルドCSS、route別font、CSP、公開manifest |
| 固定ページ追加 | `npm run content -- page create …` | `apps/site/src/content/pages/<slug>.mdx`（必ず下書き） | UUID、共通layoutのmetadata、公開時の一覧・検索・sitemap |

`apps/site/src/content/`は配信用のportable MDX、`content-registry/`はID・分類・media・来歴の管理記録、`src/pages/`はAstro route実装。`.local/`の原稿・根拠・候補を公開contentへコピーしない。`docs/migration/`、`docs/audits/`、`docs/legacy/`は履歴であり、新記事の雛形にしない。

## 記事

```sh
npm run site -- article taxonomy list --collection blog
npm run site -- article init --collection blog --authoring human --title "見出し" --description "記事の説明" --category software --pub-date YYYY-MM-DD --reader-outcome "読後にできること"
npm run site -- article guide --job <job-id>
npm run site -- article validate --level draft --job <job-id>
npm run site -- article preview --draft --job <job-id>
```

開始結果の`workingPath`を編集する。`templates/content/article.md`は初期本文の正本で、節数や図数を強制する完成稿テンプレートではない。読者の疑問に合わせて置き換える。外部Markdownを使うなら`article draft import --job <job-id> --from <file.md>`。直接編集後は`article revise --job <job-id> --reason "変更理由"`で新しいattemptへ取り込む。

内部collectionの`blog`は記事schemaの安定IDであり、公開URLの旧構造ではない。記事・Registry・taxonomyの同じ型を表す。これを`articles`へ見た目だけでrenameするとmigration記録・Job・schema全体が変わるため、公開URLは`/articles/`へ統一したまま内部型は維持する。検索fixtureは`tests/fixtures/search/`に分離し、通常contentへ登録しない。

URL用slugは不要。UUIDv4 ContentIdから`/articles/<26文字ID>/`を導出し、タイトル・分類変更でも維持する。更新は`article init --content-id <既存UUID> --update-kind correction`で元記事・Registryを固定する。本文・画像・根拠が変わった範囲を再監査し、日付や無関係なコードだけで全面AI監査をやり直さない。

内容は`japanese-technical-blog`、Article Jobの執筆段階は`draft-japanese-technical-article`を使う。人間承認、出典対応、権利、原本→公開→保護の保存と照合、正式exportは[公開CI手順](article-media-publication-ci.md)に従う。fixture/mockのreceiptを実保存と呼ばない。公開日は実公開予定のJST、初回updatedDateは省略する。

## メモ（ADR-0068の実装候補・未採用）

Articlesは読者に向けて整えた記事、メモは日常の出来事・思いつき・途中の考えを気軽に残す場所。技術的な話題、長文、定型の節構成、画像は必須にしない。

```sh
npm run content -- note create --slug my-memo --title "短い見出し" --description "一覧に出す短い抜粋" --pub-date YYYY-MM-DD
```

この節の入口・feed参加設定はローカル実装候補であり、現行main/本番への採用を示さない。通常の公開承認とは別に、この候補のレビューを要する。

固定ページと同じ下書き生成処理が、既存の `noteFrontmatterSchema` に沿った UUID と `draft:true` を発行する。`subject` は日常向けのtaxonomy拡張 `everyday` が初期値。新メモには `feed:false` を明記する。RSS参加を希望するときだけ `--feed include` を指定し、生成結果の `feed:true` を通常公開レビューで確認する。`--feed exclude` または省略は非参加。いずれも下書きのままで、公開操作ではない。分類を選ぶときだけ `--subject <既存ID>`、タグを付けるときだけ `--tag <既存ID>` を使う。未知のIDは作らず拒否する。`description` が一覧・RSS・検索共通の抜粋になる。`templates/content/note.md` は短い書き出しだけで、dot のコメントを自動生成しない。

任意で本文の後に、既存の補足部品を使って採用したコメントを添えられる。

```mdx
<Callout kind="note" title="dot のひとこと（AIコメント）">

[本人が確認・採用した、短いユーモアのあるコメント]

</Callout>
```

ユーザー本文を主役とし、コメントは短く、本人を茶化しすぎないものにする。コメントなしでも成立する。ラベルでAIコメントと本文の書き手を区別する。コメントを追加・変更するときも同じMDX差分として本人が確認し、別のAPI・承認・公開経路は設けない。ブラウザーでのAI呼出しや自動コメント挿入はない。AI生成の重要な事実主張・画像を追加する場合は既存の根拠・権利・media条件を満たす。メモの名前でArticle Jobやtool installerの条件を回避しない。

表示名は「メモ」だが内部collectionは `notes`、詳細URLは `/notes/<slug>/` のまま。ContentId・既存URL・本文・公開状態を保持し、旧移行ノートを新規投稿として作り直さない。`wordpress-migration-playbook.mdx` は既存の歴史的公開記録、`infrastructure-foundation.mdx` は公開URLを持つ `noindex:true` fixtureのまま維持する。既存記事44件のdraft・publication holdも変更しない。

公開判断は共通catalogの `draft` / `noindex`、通常のPR・検証・手動配信に従う。メモ専用の公開コマンドはない。`draft:true` は詳細route・検索・RSS・sitemap・関連に出さず、`noindex:true` は既存契約どおり詳細URLを保ちdiscoveryから除外する。RSS設定の省略時は従来のBlog-only既定を維持し、既存Notesは参加しない。任意の共通 `feed` 設定は参加の意図だけを示し、明示trueでもdraft/noindex・日付なしは掲載しない。falseは掲載しない。参加項目だけを同じ `/rss.xml` に日付順・最大20件・抜粋で生成する。既存記録を新しい配信面へ自動参加させず、設定変更は通常レビューの差分として扱う。

## ツール

軽量同期ツールは既存の[作成契約](../contracts/browser-tool-authoring.md)と`templates/browser-tool-sync/`を使う。

```sh
npm run browser-tools:author -- create --directory <新規絶対path> --id <tool-id> --title "表示名" --license <SPDX> --license-file <LICENSE> --notice-file <NOTICE>
# 生成sourceへ移動し、指定toolchainでlockを作成・確認した後
npm ci --ignore-scripts
npm test
npm run build -- <新規の絶対出力path>
# xpotato-siteへ戻る
npm run browser-tools:author -- check --artifact <固定build出力>
npm run browser-tools:install -- plan --source <source> --artifact <artifact> --review <review.json> --release <release-id> --placement <placement.json>
# planの差分を確認してから、同じ引数でapply
npm run browser-tools:install -- check
```

配置JSONの正確な項目は`packages/site-validators/src/browser-tools/browser-tool-installation.ts`の`browserToolPlacementSchema`。ContentIdを一度発行し、slug/title/description、既存category/tags、pubDate、hydration、`draft:true`を指定する。独立レビューと固定source/artifactが必要で、fixture生成を正本レビューの代用にしない。新規・更新・公開済み更新は全tool同じplan/apply/checkを使う。更新は`--placement`を付けず現在artifactを`--replace-artifact`で固定し、公開済み版は新exact pinの`--admission`も渡す。紹介本文はMDXが正本でrelease更新では保持する。vendor、生成registry、package-lockを手書きしない。既存PrimeのGUIはtoolkit source側で更新し、公開releaseを正式installerで採用する。

## スタイル

| 範囲 | 編集先 | 読込み元 |
|---|---|---|
| 色・余白・共通layout | `src/styles/global.css` | `BaseLayout.astro` |
| 通常本文・code | `content.css`、`code.css` | `ContentLayout.astro` |
| 記事構造・図・印刷 | `article-structure.css`、`article-modules.css` | 本文layoutの必要なroute |
| ホーム・検索 | `home.css`、`search.css` | 各routeのlayout |
| ツール固有UI | 独立tool sourceのCSS | 固定artifactのhost wrapper |

パスは`apps/site/`基準。全ルートのglobal.cssへ専用規則を戻さない。生成font CSS・dist・CSP hashを直接編集しない。PC/狭幅・focus・必要なtheme/状態で前後を確認し、CSS raw/gzip予算も確認する。

ホーム制作物カルーセルのDraft変更は[ADR-0069](../design/adr/0069-home-project-carousel.md)を参照する。ホーム部品に対応する単一のbounded moduleだけを別計測し、他routeの専用JSゼロ条件を広げない。自動送り・循環・停止・少数データは同じdistの`release:interaction`で検査する。本番への採用・配信は別認可とする。

ヘッダーのガラス面、文字色、メニューの一体表示と開閉は `global.css` と全ページ共通の `mobile-menu.js` を正本とする。記事・検索・ツール・固定ページにも同じ変更が伝わる。`home.css` と `home-header.js` はホーム上端の写真との融合、固定配置、スクロール閾値だけを上書きし、通常スクロール時の材質遷移を0.7秒に保つ。メニューの開閉中はガラス面・前景色・パネルのフェードを0.2秒の同じカーブで同期し、閉じ終わるまでガラス面の高さを維持する。リンクの入口は従来の遅延表示を保ち、出口では現在の透明度を保持してパネルだけをフェードさせる。途中の閉じ直し・再オープン、Popoverとdetails fallback、reduced motionを検査し、`release:interaction`では実CSS transitionの途中と完了を採取し、記事・検索・ツール・サイト紹介・プライバシーページの共有面も確認する。共通JSは3298 raw / 1160 gzip bytes、ホーム専用JSは556 / 301 bytes。共通の上限は3400 / 1250 bytesに限定し、依存・動的コード禁止と静的ページのroute専用JSゼロを維持する。

## 固定ページ

```sh
npm run content -- page create --slug contact --title "お問い合わせ" --description "問い合わせ方法"
```

`templates/content/page.md`を使い、UUIDと`draft:true`付きMDXを生成する。既存ファイル、予約route、redirect、ContentId/route衝突、symlinkへの書込みを拒否する。`draft:false`にする前に本文・リンク・SEO・表示と公開範囲を確認する。小さい固定ページにArticle JobのAI監査やmedia基盤を無条件に要求しない。画像や重要な外部主張がある場合は、その権利・根拠条件を別途満たす。

## 問い合わせ・SNSの更新

`/contact/` は通常の固定ページCLIが発行したContentIdを持ち、`ContentLayout`で表示する。導入文は`content/pages/contact.mdx`、連絡先の静的表示は固定ページrouteから`ContactDetails.astro`へ接続する。記事向けMDX module APIは増やさない。ヘッダー・モバイル・フッターの問い合わせ入口は共通の`lib/site-config.ts`のnavigation（order 45）を使う。

ヘッダーはPCの`.desktop-navigation ul`と1180px以下のモバイル規則で配置する。それらに上書きされていた1000px以下の旧gap規則を取り除き、項目追加後も既存CSS予算を維持する。

`article-structure.css`の標準見出し装飾は本文直下のh2を対象にする。固定ページ部品内では`.content-h2`で明示的に共通の上罫線・紫マーカーへ参加し、文字サイズや領域の余白は部品側で主従を付ける。任意の入れ子h2/h3を無差別に装飾せず、Toolの`data-bt` namespaceも除外する。サイト紹介と記事の既存見出しの適用範囲・詳細スタイルは保持する。

メールを主領域として文字サイズ・余白・共通罫線で強調し、背景色や囲いによるカードにしない。Issue作成とSNSは下段の補助領域にまとめる。SNSプロフィールURLの正本は同じ設定の`socialLinks`。`SocialLinks.astro`がactiveだけを表示し、URL未指定のLinkedInは非リンクの「準備中」枠とする。将来は本人指定のURLで`id: "linkedin"`のactiveなSocialLinkを追加すると枠が実リンクに置き換わる。空href・仮アカウント・追跡queryは登録しない。プロフィール名はURLから導出する。SVGは装飾として読み上げから除外し、リンク名はサービス名とプロフィール名の可視テキストで伝える。Bootstrap Iconsの固定revisionとMIT noticeは`lib/social-icons.ts`と`public/licenses/bootstrap-icons-LICENSE.txt`に保持する。

メールとIssue宛先の解決は`lib/contact.ts`。`deriveContactTargets`が`/tools/`と同じ公開catalogからタイトル・ContentIdを取得し、installer生成のactive binding/moduleと採用releaseの`source.repository`を結び付ける。ツール名や選択肢を別の手書き一覧にしない。GitHub sourceであることだけではIssues対応とせず、確認済みrepository capabilityだけを新規Issue宛先に使う。未確認・未設定・不明なbindingはメールへ案内する。2026-11-06に`xpotato-site`と`browser-prime-toolkit`の`has_issues:true`・非archive・`/issues/new`のログイン後復帰先を読み取り確認済み。両repoの全treeとowner共通`.github`にIssueテンプレートはなく、template queryなしの`/issues/new`へ進む。他repoを追加するときもIssues可否と新規URLを確認する。

`ContactIssuePicker.astro`は対象selectと明示的な作成リンクを表示する。選択だけで移動・送信しない。問い合わせページの長いGitHub向け説明は掲載しない。JSなし/未読込時は同じ生成結果のnative detailsとリンクが使える。小さい`/scripts/contact-issues.js`は`/contact/`限定で、pageshowと再選択に合わせてリンク・状態を同期する。専用runtime validatorがraw 2,000/gzip 900 bytes以下、単一module、fallback、source bytes一致、network/storage/自動navigation/importなしを検査する。一般固定ページのroute JSゼロ予算を変更せず個別計測する。入力値・結果・閲覧queryを宛先に付けず、メール送信API・外部フォーム・埋込みは使用しない。

`release:interaction`は最終distの問い合わせ表示、320/390/1181/1440px、200%文字、長いアドレスの折返し、selectのラベル・キーボード操作・再選択・状態同期、JSなしfallback、ツールからの遷移、宛先とLinkedIn未設定状態を検査する。外部リンクとmailtoのactivationはブラウザ内で捕捉し、実送信・Issue作成・SNS操作は行わない。既存の静的・discovery検証も同じbuildを使う。

## 共通の確認と公開境界

GitHub Actionsは一時出力先を設定済み。ローカルで下記の全体検証を行う前には、Phase 8の有限なloopback検査用に一度設定する。未設定なら検査は停止する。鍵やprovider設定ではない。

```powershell
$validationRoot = Join-Path ([IO.Path]::GetTempPath()) ("xpotato-validation-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $validationRoot | Out-Null
$env:XPOTATO_RELEASE_TEMP = $validationRoot
$env:XPOTATO_PHASE8_TEMP_ROOT = Join-Path $validationRoot "phase8"
```

Linuxなら`validation_root="$(mktemp -d -t xpotato-validation-XXXXXX)"`を作り、`XPOTATO_RELEASE_TEMP="$validation_root"`、`XPOTATO_PHASE8_TEMP_ROOT="$validation_root/phase8"`をexportする。WSLで全体検証する場合はLinux側checkout/依存を使うと共有filesystemの読取り負荷を避けられる。小さい対象testのために全体buildを重複実行しない。

```sh
npm run ci:source
npm run build
npm run ci:final
```

編集入口やrouteの結合を変えたときは、Linuxの指定Node環境で`npm run content:smoke`も使える。新しい一時worktreeで実CLIから記事Job・メモ・固定ページを作り、合成tool下書きとstyle変更を加えて実Astro buildする。下書き4種の非公開隔離、CSSの反映、合成固定ページとメモのroute/manifest生成、コメント有無、noindex隔離と共通discoveryを検査し、一時worktreeを削除する。公開用artifactは作らず、providerアクセスも行わない。独立tool sourceの生成/installerは`browser-tool-installation.test.ts`/`browser-tool-update.test.ts`が検証する。`npm run tools:smoke`は別の一時Site worktreeで同期型とWorker型の2toolを同じinstallerで新規登録・公開済み更新し、通常Astro build・manifest・CSP・静的検査・共通実dist受入れまで実行する。配信用artifactを作らず、実provider書込みも行わない。Chromeがある通常のrelease interactionは、その隔離出力で操作・取消・再実行・offline・Worker/URL解放・PC/狭幅PNGも確認する。実機mobile検証とは区別する。通常のrelease buildを二重実行するためのコマンドではない。

変更中は関連test/typecheckを先に実行し、同じ条件の有効な証拠を再利用する。最終CIは実buildの`_publication.json`を再生成照合し、配布package組立後も配信側と同じcompilerを通す。Candidateが検査を通ってもProduction適格にはならない。

SEOは`site-seo-review`、既存内容・スタイル更新は`update-site`が入口。編集入口をまとめた新しい汎用frameworkは作らず、既存CLI・schema・layoutを使う。ダミーは一時workspace/private Jobで試験し、通常contentや本番公開へ混ぜない。
