---
status: canonical
owner: development
last_verified: 2026-11-02
---

# コンテンツ追加・更新の入口

作業コードの所有と旧資産の保留理由は[toolsの案内](../../tools/README.md)を参照する。通常編集は次の4経路を使う。記事・画像の保存や公開、PRのReady・merge・配信の許可は、この手順の存在からは発生しない。

| 作業 | 最初の操作 | 人が編集する正本 | 自動生成されるもの |
|---|---|---|---|
| 記事追加 | `npm run site -- article init …` | `.local/article-jobs/<job>/working.md`、同Jobの根拠・図案 | ContentId、記事URL、候補、保存後のMDX/Registry/compact来歴 |
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

URL用slugは不要。UUIDv4 ContentIdから`/articles/<26文字ID>/`を導出し、タイトル・分類変更でも維持する。更新は`article init --content-id <既存UUID> --update-kind correction`で元記事・Registryを固定する。本文・画像・根拠が変わった範囲を再監査し、日付や無関係なコードだけで全面AI監査をやり直さない。

内容は`japanese-technical-blog`、Article Jobの執筆段階は`draft-japanese-technical-article`を使う。人間承認、出典対応、権利、原本→公開→保護の保存と照合、正式exportは[公開CI手順](article-media-publication-ci.md)に従う。fixture/mockのreceiptを実保存と呼ばない。公開日は実公開予定のJST、初回updatedDateは省略する。

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

配置JSONの正確な項目は`packages/site-validators/src/browser-tool-installation.ts`の`browserToolPlacementSchema`。ContentIdを一度発行し、slug/title/description、既存category/tags、pubDate、hydration、`draft:true`を指定する。独立レビューと固定source/artifactが必要で、fixture生成を正本レビューの代用にしない。更新は現在artifactを`--replace-artifact`で固定する。vendor、生成registry、package-lockを手書きしない。既存PrimeのGUIはtoolkit source側で更新し、公開releaseを正式installerで採用する。

## スタイル

| 範囲 | 編集先 | 読込み元 |
|---|---|---|
| 色・余白・共通layout | `src/styles/global.css` | `BaseLayout.astro` |
| 通常本文・code | `content.css`、`code.css` | `ContentLayout.astro` |
| 記事構造・図・印刷 | `article-structure.css`、`article-modules.css` | 本文layoutの必要なroute |
| ホーム・検索 | `home.css`、`search.css` | 各routeのlayout |
| ツール固有UI | 独立tool sourceのCSS | 固定artifactのhost wrapper |

パスは`apps/site/`基準。全ルートのglobal.cssへ専用規則を戻さない。生成font CSS・dist・CSP hashを直接編集しない。PC/狭幅・focus・必要なtheme/状態で前後を確認し、CSS raw/gzip予算も確認する。

## 固定ページ

```sh
npm run content -- page create --slug contact --title "お問い合わせ" --description "問い合わせ方法"
```

`templates/content/page.md`を使い、UUIDと`draft:true`付きMDXを生成する。既存ファイル、予約route、redirect、ContentId/route衝突、symlinkへの書込みを拒否する。`draft:false`にする前に本文・リンク・SEO・表示と公開範囲を確認する。小さい固定ページにArticle JobのAI監査やmedia基盤を無条件に要求しない。画像や重要な外部主張がある場合は、その権利・根拠条件を別途満たす。

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

編集入口やrouteの結合を変えたときは、Linuxの指定Node環境で`npm run content:smoke`も使える。新しい一時worktreeで実CLIから記事Jobと固定ページを作り、合成tool下書きとstyle変更を加えて実Astro buildする。下書き3種の非公開隔離、CSSの反映、合成固定ページだけのroute/manifest生成を検査し、一時worktreeを削除する。公開用artifactは作らず、providerアクセスも行わない。独立tool sourceの生成/installer自体は既存の`browser-tool-installation.test.ts`が一時workspaceで検証する。通常のrelease buildを二重実行するためのコマンドではない。

変更中は関連test/typecheckを先に実行し、同じ条件の有効な証拠を再利用する。最終CIは実buildの`_publication.json`を再生成照合し、配布package組立後も配信側と同じcompilerを通す。Candidateが検査を通ってもProduction適格にはならない。

SEOは`site-seo-review`、既存内容・スタイル更新は`update-site`が入口。4経路をまとめた新しい汎用frameworkは作らず、既存CLI・schema・layoutを使う。ダミーは一時workspace/private Jobで試験し、通常contentや本番公開へ混ぜない。
