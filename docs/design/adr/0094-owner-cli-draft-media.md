---
status: proposed
owner: architecture
date: 2026-11-26
---

# ADR-0094: AIのDraft画像登録に既存GitHub認証を使うCLIを追加する

## 背景

ADR-0093の媒体引継ぎCLIは登録ファイルの生成までを担当し、実登録は所有者がログインしたCMSに依存していた。AIが画像を作成しても、利用中のブラウザーにCMSセッションがなければDraft R2へ登録できず、CMSには画像がない状態が残った。所有者は非公開Draftの読み書きを常時許可しており、2026-11-26に、CLIから実登録し毎回の認証を不要にする運用を求めた。

画像bytesだけをR2へ保存しても、Draftの画像ID対応・容量予約・revision・保持状態は更新されない。CMSと同じ業務処理を通す入口が必要である。

## 決定案

### 所有者のCLI認証を再利用する

`editor:media:register`は実行端末のGitHub CLIが管理する認証を利用する。`gh auth token --hostname github.com`の出力は子プロセスからメモリーへ受け取り、固定されたCMS originにだけ送る。値を引数・標準出力・レポート・設定ファイルへ残さず、リダイレクト先へ転送しない。CLI自身はlogin、scope追加、認証profileの切替を行わない。利用可能な認証がない場合はその不足を示し、既存認証を上書きしない。

専用APIはGitHubの`/user`から得た数値IDが設定済み所有者と一致することと、設定済みrepositoryの一致・所有者のpush権限を確認する。repositoryが公開されていることだけでは本人確認としない。repositoryのpush権限はユーザーの権限確認であり、提出されたtoken自体がGit書込みscopeを持つ証明ではない。CLI経路にGit書込み機能は与えない。

GitHub credentialは各requestの処理中にだけ使用し、API側へ永続化しない。受信tokenのGitHub権限そのものをDraft限定へ変更したとは扱わない。GitHub App限定のブラウザーsessionとは別のprincipalとし、既存のApp installation検査、Cookie・CSRF、Cloudflare Accessを維持する。

### 操作をDraft媒体に限定する

`/editor-api/cli/`はBearer認証だけを扱い、Cookieへのfallbackを持たない。受け付けるのは媒体manifestの照合・Draftの取得または作成・画像予約・画像upload・実bytes取得だけである。汎用のGit、分類、連載、添削変更、GC、公開A/B/Cや配信操作へ接続しない。

CLIは従来の登録ファイルを読み、全画像とpreviewのbytes・hash・寸法・媒体ポリシーを検査する。APIへは原稿と画像metadataの小さいmanifestを渡し、画像本体は一件ずつ送る。64 MiBまでの登録ファイル全体をWorkerへ送らない。

APIはrepository・ContentId・branch・path・固定commit・本文hash・`draft:true`・本文中の全画像参照を照合する。登録先は既存の`DraftStore`と`createDraftRecord`、`reserveMedia`、`uploadMedia`、`readMedia`を共用する。画像差替えの旧hash条件はrevisionとともにCAS内で検査し、予約時のsourceと条件をupload完了時にも維持する。CLI予約を通常のブラウザーuploadへ持ち込んで検査を省略できないようにする。

### 再取得してから完了とする

同じassetId・hashが保存済みなら、新しい画像を作らず実bytesを再取得して確認する。途中失敗後の再実行も保存済みの画像を再確認し、残りを続ける。`--verify-only`は新しいprocessから全参照画像を再取得し、作成・予約・uploadを行わない。

GitとR2をまたぐ原子的transactionは保証しない。upload直前と登録後にもGitの版を確認し、原稿や他端末の更新を検出した場合は成功とせず、既に成立した登録と未完了の処理を区別する。receiptは対象source、Draft ID、画像ID・hash・bytesと確認結果だけを残す。

## 代替案

| 方法 | 判断 |
| --- | --- |
| CMSへ毎回ログインして操作する | 人間の編集には維持する。AIの定例登録の唯一の入口にはしない。 |
| Cloudflare Accessのservice tokenを新設する | 自動化用の正式機能だが、新しいsecretとAccess policyを維持する必要がある。今回は既存GitHub認証で所有者を確認できるため追加しない。 |
| Cloudflare管理認証でR2へ直接登録する | 日常のDraft登録に管理権限を必要とし、CMS API以外のwriterを持つため採用しない。 |
| ブラウザーCookieを取り出す | sessionの寿命とブラウザー環境への依存を残すため採用しない。 |

## 所有者と検証

共有manifestは`editor-core`、認証とDraft操作は`editor-api`、CLIのIOと資格情報の取得は`ops/media`が所有する。provider resource・binding・secret・Access policyに変更はなく、既存CMS Server counterpartを維持する。操作手順は[CMS制作手順](../../operations/editor-workflow.md)に集約する。

本人以外・別repo・redirect・認証値の漏洩、原稿の不一致、画像hash・旧hash・revisionの競合、途中失敗後の再開、verify-onlyの書込み禁止を検証する。合成試験、実Draft保存・再取得、CMS画面での表示は別の確認結果として記録する。

## 外部仕様

- [GitHub CLIの認証管理](https://docs.github.com/en/github-cli/github-cli/authenticating-with-github-cli)
- [gh auth token](https://cli.github.com/manual/gh_auth_token)
- [Get the authenticated user](https://docs.github.com/en/rest/users/users#get-the-authenticated-user)
- [Cloudflare Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
