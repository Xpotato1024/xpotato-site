---
status: proposed
owner: operations
last_verified: 2026-11-18
---
# CMSをGitHubと非公開Draft R2へ接続する

## 現在の実測

2026-11-18の接続確認では、操作端末のWranglerは未認証、公開 `/editor/` と `/editor-api/session` は404。本人のCloudflare login、GitHub App作成/installation、保護されたSite配信は未実施。設定用コードの成功を接続完了として扱わない。

## 最初に実行するコマンド

固定Node/npmでSiteの統合済み版と、[Infrastructure Handoff](../architecture/infrastructure-handoff.md)のCMS専用Server revisionをcleanなcheckoutに用意する。Serverのmainが無関係な変更で進んでも、採用済みの固定版を使う。

```sh
npm ci
npm run editor:connect -- check --server-root /path/to/Xpotato-Server
npm run editor:connect -- connect --server-root /path/to/Xpotato-Server
npm run editor:connect -- verify --server-root /path/to/Xpotato-Server
```

`check` はprovider設定・本文・媒体を書き換えない読取り確認。`connect` は本人認可済みの初回リソース作成・API配備・App登録。`verify` は読取り再確認で、不完全なら終了コード2を返す。

Cloudflareのlogin画面とGitHubのApp作成画面は本人が操作する。初期設定で入力すべき権限・Callback・Webhook URLはnative Manifestから供給する。インストール対象は `Xpotato1024/xpotato-site` 一つだけを選択する。秘密値をチャット・Git・ブラウザの入力欄へ手動転記する必要はない。App登録結果は一時メモリから標準Wranglerのsecret bulkへ渡す。

元からあるWrangler sessionは終了しない。この操作が新しくloginした場合だけ終了時にlogoutする。強制終了で残った場合は同じprofileから `wrangler logout`。登録済みAppのsecretが一部だけ存在する場合は自動上書きせず、Serverの復旧手順へ戻る。

## 正本と所有者

Siteはコード・GitHub権限・固定Wrangler・認証APIを所有する。Serverの `inventory/desired/website-editor.json` と `tools/website_editor.mjs` が対象bucket/Worker/routeとprovider確認を所有する。実行時に両方のGit revisionを記録する。Serverコードを読み込む前にCMS専用pin・clean・mainへ統合済みであることを照合し、未マージ/汚れた作業ツリーから外部変更しない。

設定値を読むためにServerコードを実行するため、`--server-root`は信頼した本人repositoryのcheckoutだけを指定する。無関係なURLや第三者の作業ツリーを指定しない。Siteの公開配信・A/B/Cに使う従来のcross-repository pin/guardは変更せず、今回のCMS接続scopeと混同しない。

専用APIの配信設定はServerの値から `.local/editor-setup/wrangler.json` へ生成する。秘密値を含まず、Gitの正本にはしない。対象は同じホストの `/editor-api/*`。WorkerはDraft専用bucketだけをbindし、通常の公開Site WorkerとA/B/Cは操作しない。GCはfalse、cronなし、workers.dev/preview URLは無効。

## GitHub認証

AppはContents/Pull requestsのwrite、Actions/Checks/Metadataのreadだけを持つ。ChecksはPRのcheck-runs取得に必要。認証callbackは本人IDだけでなく、App ID、所有者、selected installation、一つの対象repository、最小権限を照合してからsessionを発行する。

GitHub tokenは暗号化HttpOnly cookieに保持し、ブラウザのJavaScript・localStorage・API応答・ログへ返さない。state+PKCE、same-origin+CSRF、作業ブランチ/本文パス制限を維持する。

## CMS画面の配信は別工程

CMSの静的シェルは通常SiteのProduction artifactに含まれる。 `/editor/` が404の場合、既存 `deploy-site.yml` のowner/main/manual/Environmentと復旧確認を通す。初回設定CLIが公開サイト全体を無条件にdeployすることはない。Shell/認証APIの両方が成立してから本人がログインする。

## 接続後の確認

CMSにGitHubと私有媒体の状態が別々に表示される。これは認証後の読取り検査であり、保存完了の証明ではない。本人が少量の試験記事と画像を作り、Git保存→Draft PR→正規Astroレビュー→別端末復元を確認する。競合時は本文が残ること、ログアウト後は私有画像を取得できないことも確認する。正式な記事公開は従来の別工程。

費用確認はアカウント全体のR2容量/操作数とWorkers実CPUが対象。設定レポートの `accountUsageVerified=false` を無料枠内の確認と取り違えない。自動でpaid planへ変更しない。Draft quota/保持期限はeditor-coreの値を使う。

## 開発検証

```sh
npm run editor:runtime
npm run editor:integration
```

前者は固定Wranglerの実bundleをworkerdとローカルR2で動かし、認可/CSRF、条件付きstate更新、画像byte一致、再起動後の永続化を確認する。外部ネットワークは拒否する。後者は実Chromiumと模擬GitHub/R2で人間→AI/PR/画像の操作を確認する。どちらも実アカウントの認証・実R2の保存・実iPhoneの証拠ではない。

実環境受入れはIssue #220へ記録する。操作コマンド、実行revision、成功/未完了範囲だけを残し、secretやcallback codeを記録しない。
